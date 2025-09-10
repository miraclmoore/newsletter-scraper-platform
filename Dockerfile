# Newsletter Scraper Platform - Production Dockerfile

# Build stage for frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Add metadata
LABEL maintainer="Newsletter Scraper Platform"
LABEL version="1.0.0"
LABEL description="Newsletter aggregation platform with AI summarization"

# Install system dependencies
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S newsletter && \
    adduser -S newsletter -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy application source
COPY src/ ./src/
COPY .env.production ./.env

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/build ./public

# Create directories for logs and uploads
RUN mkdir -p logs uploads && \
    chown -R newsletter:newsletter /app

# Switch to non-root user
USER newsletter

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "src/server.js"]

# Development stage (optional)
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies including dev
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000
EXPOSE 3001

CMD ["npm", "run", "dev"]