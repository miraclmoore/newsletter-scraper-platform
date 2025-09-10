#!/bin/bash

# Newsletter Scraper Platform - Production Deployment Script
# Usage: ./deploy.sh [environment]

set -e  # Exit on any error

ENVIRONMENT=${1:-production}
PROJECT_NAME="newsletter-scraper"
BUILD_DIR="dist"

echo "🚀 Starting deployment for Newsletter Scraper Platform..."
echo "📊 Environment: $ENVIRONMENT"
echo "📁 Project: $PROJECT_NAME"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking deployment dependencies..."
    
    command -v node >/dev/null 2>&1 || { print_error "Node.js is required but not installed. Aborting."; exit 1; }
    command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed. Aborting."; exit 1; }
    
    NODE_VERSION=$(node --version)
    print_success "Node.js version: $NODE_VERSION"
    
    NPM_VERSION=$(npm --version)
    print_success "npm version: $NPM_VERSION"
}

# Validate environment configuration
validate_environment() {
    print_status "Validating environment configuration..."
    
    ENV_FILE=".env.$ENVIRONMENT"
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found!"
        print_status "Please create $ENV_FILE with your production configuration."
        exit 1
    fi
    
    print_success "Environment file $ENV_FILE found"
    
    # Check for required environment variables
    source "$ENV_FILE"
    
    REQUIRED_VARS=(
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY" 
        "SUPABASE_SERVICE_ROLE_KEY"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "FRONTEND_URL"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set!"
            exit 1
        fi
    done
    
    print_success "All required environment variables are set"
}

# Install dependencies
install_dependencies() {
    print_status "Installing production dependencies..."
    
    # Backend dependencies
    npm ci --only=production
    print_success "Backend dependencies installed"
    
    # Frontend dependencies (if exists)
    if [ -d "frontend" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm ci --only=production
        cd ..
        print_success "Frontend dependencies installed"
    fi
}

# Build frontend
build_frontend() {
    if [ -d "frontend" ]; then
        print_status "Building frontend for production..."
        
        cd frontend
        
        # Set production environment variables for build
        export NODE_ENV=production
        export REACT_APP_API_URL="$FRONTEND_URL"
        
        npm run build
        
        if [ $? -eq 0 ]; then
            print_success "Frontend built successfully"
        else
            print_error "Frontend build failed!"
            exit 1
        fi
        
        cd ..
        
        # Copy build files to backend public directory
        if [ -d "frontend/build" ]; then
            print_status "Copying frontend build files..."
            rm -rf public
            cp -r frontend/build public
            print_success "Frontend files copied to public directory"
        fi
    else
        print_warning "No frontend directory found, skipping frontend build"
    fi
}

# Run tests
run_tests() {
    print_status "Running production test suite..."
    
    # Set test environment
    export NODE_ENV=test
    
    # Run tests with timeout to prevent hanging
    timeout 300 npm test -- --passWithNoTests --ci --coverage=false --maxWorkers=2
    
    if [ $? -eq 0 ]; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed, but continuing with deployment"
    fi
}

# Database setup
setup_database() {
    print_status "Setting up database..."
    
    # Test database connection
    node -e "
        require('dotenv').config({ path: '.env.$ENVIRONMENT' });
        const { supabaseAdmin } = require('./src/config/supabase');
        
        (async () => {
            try {
                const { data, error } = await supabaseAdmin
                    .from('users')
                    .select('count', { count: 'exact' })
                    .limit(1);
                
                if (error) throw error;
                console.log('✅ Database connection successful');
                process.exit(0);
            } catch (err) {
                console.error('❌ Database connection failed:', err.message);
                process.exit(1);
            }
        })();
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Database connection verified"
    else
        print_error "Database connection failed!"
        exit 1
    fi
}

# Start application
start_application() {
    print_status "Starting application..."
    
    # Copy environment file
    cp ".env.$ENVIRONMENT" .env
    
    # Use PM2 if available, otherwise use node directly
    if command -v pm2 >/dev/null 2>&1; then
        print_status "Using PM2 for process management..."
        
        # Stop existing process
        pm2 stop "$PROJECT_NAME" 2>/dev/null || true
        pm2 delete "$PROJECT_NAME" 2>/dev/null || true
        
        # Start new process
        pm2 start src/server.js --name "$PROJECT_NAME" --env production
        pm2 save
        
        print_success "Application started with PM2"
        pm2 status
    else
        print_warning "PM2 not found, starting with node directly"
        print_status "For production, consider installing PM2: npm install -g pm2"
        
        # Start in background
        NODE_ENV=$ENVIRONMENT nohup node src/server.js > app.log 2>&1 &
        APP_PID=$!
        
        # Wait a moment and check if process is still running
        sleep 3
        if kill -0 $APP_PID 2>/dev/null; then
            print_success "Application started successfully (PID: $APP_PID)"
            echo $APP_PID > app.pid
        else
            print_error "Application failed to start"
            exit 1
        fi
    fi
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Wait for application to start
    sleep 5
    
    # Health check with timeout
    HEALTH_URL="http://localhost:${PORT:-3000}/health"
    
    for i in {1..10}; do
        if curl -f -s "$HEALTH_URL" >/dev/null; then
            print_success "Health check passed"
            curl -s "$HEALTH_URL" | head -3
            return 0
        fi
        print_status "Waiting for application to be ready... ($i/10)"
        sleep 3
    done
    
    print_error "Health check failed after 30 seconds"
    return 1
}

# Deployment summary
deployment_summary() {
    echo ""
    echo "🎉 Deployment Summary"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Application: $PROJECT_NAME"
    echo "Status: Ready for use"
    echo ""
    echo "📍 Endpoints:"
    echo "  Health Check: http://localhost:${PORT:-3000}/health"
    echo "  API Base: http://localhost:${PORT:-3000}/api"
    echo "  Frontend: http://localhost:${PORT:-3000}"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Configure your domain and SSL certificate"
    echo "  2. Set up monitoring and alerting"
    echo "  3. Configure backup strategies"
    echo "  4. Test OAuth integrations"
    echo "  5. Set up SendGrid webhook endpoints"
    echo ""
    echo "📚 Documentation:"
    echo "  - Deployment Guide: DEPLOYMENT_READY.md"
    echo "  - API Documentation: Available at /api endpoint"
    echo ""
}

# Main deployment flow
main() {
    echo "Newsletter Scraper Platform - Production Deployment"
    echo "=================================================="
    
    check_dependencies
    validate_environment
    install_dependencies
    build_frontend
    run_tests
    setup_database
    start_application
    
    if health_check; then
        print_success "🚀 Deployment completed successfully!"
        deployment_summary
    else
        print_error "❌ Deployment failed during health check"
        exit 1
    fi
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main deployment
main "$@"