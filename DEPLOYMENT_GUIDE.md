# Newsletter Scraper Platform - Production Deployment Guide

## 🚀 Complete Deployment Checklist

This guide will walk you through deploying the Newsletter Scraper Platform to production step by step.

---

## 📋 Pre-Deployment Requirements

### Infrastructure Requirements
- [x] **Server**: Linux server with Node.js 18+ (2+ GB RAM, 20+ GB storage)
- [x] **Database**: Supabase PostgreSQL instance
- [x] **Redis**: Redis server for queue processing
- [x] **Domain**: SSL-enabled domain name
- [x] **Email Service**: SendGrid account for webhook processing

### Service Accounts Required
- [x] **Google OAuth**: Google Cloud Console project
- [x] **Microsoft OAuth**: Azure Active Directory app
- [x] **OpenAI**: API key for AI summarization
- [x] **Supabase**: Project with service role key

---

## 🔧 Step 1: Environment Setup

### 1.1 Clone and Prepare Repository
```bash
git clone <your-repo-url>
cd newsletter-scraper
```

### 1.2 Configure Production Environment
1. Copy the production environment template:
   ```bash
   cp .env.production .env
   ```

2. Edit `.env` with your production values:
   ```bash
   nano .env
   ```

3. **Required Environment Variables:**
   ```bash
   # Core Application
   NODE_ENV=production
   PORT=3000
   FRONTEND_URL=https://your-domain.com
   
   # Database (Supabase)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Security
   JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
   ENCRYPTION_KEY=your-32-character-encryption-key
   
   # OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   MICROSOFT_CLIENT_ID=your-microsoft-client-id
   MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
   
   # External Services
   SENDGRID_WEBHOOK_SECRET=your-sendgrid-webhook-secret
   OPENAI_API_KEY=your-openai-api-key
   REDIS_HOST=your-redis-host
   REDIS_PASSWORD=your-redis-password
   ```

---

## 🗄️ Step 2: Database Configuration

### 2.1 Set Up Supabase Project
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your keys
3. Run the database setup script in Supabase SQL Editor:
   ```sql
   -- Copy contents from database/production-setup.sql
   ```

### 2.2 Create Database Tables
```bash
# Run table creation script
node database/create-tables.js
```

### 2.3 Verify Database Connection
```bash
node -e "
require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');
supabaseAdmin.from('users').select('count', { count: 'exact' }).then(console.log);
"
```

---

## 🔐 Step 3: External Service Setup

### 3.1 Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-domain.com/auth/google/callback`

### 3.2 Microsoft OAuth Setup
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Create new registration
4. Add redirect URI:
   - `https://your-domain.com/auth/microsoft/callback`
5. Generate client secret

### 3.3 SendGrid Configuration
1. Create SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Set up Inbound Parse webhook:
   - URL: `https://your-domain.com/api/webhooks/email/sendgrid`
   - Check "POST the raw, full MIME message"
3. Configure Event Webhook:
   - URL: `https://your-domain.com/api/webhooks/email/events`
   - Select events: bounce, dropped, spam_report, unsubscribe

### 3.4 OpenAI API Setup
1. Create account at [openai.com](https://openai.com)
2. Generate API key
3. Set up billing and usage limits

---

## 🚢 Step 4: Deployment Options

Choose one of the following deployment methods:

### Option A: Automated Deployment Script
```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh production
```

### Option B: Docker Deployment
```bash
# Build and start with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### Option C: Manual Deployment
```bash
# Install dependencies
npm ci --only=production

# Build frontend
cd frontend && npm ci && npm run build && cd ..

# Copy frontend build
cp -r frontend/build public

# Start with PM2 (recommended)
npm install -g pm2
pm2 start src/server.js --name newsletter-scraper
pm2 save
pm2 startup
```

---

## 🔍 Step 5: Verification & Testing

### 5.1 Health Check
```bash
# Check application health
curl https://your-domain.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0"
}
```

### 5.2 API Testing
```bash
# Test API endpoints
curl https://your-domain.com/api/sources
curl https://your-domain.com/api/items
```

### 5.3 OAuth Testing
1. Visit `https://your-domain.com`
2. Click "Sign in with Google" or "Sign in with Microsoft"
3. Verify successful authentication

### 5.4 Webhook Testing
```bash
# Test SendGrid webhook (use test payload)
curl -X POST https://your-domain.com/api/webhooks/email/sendgrid \
  -H "Content-Type: application/json" \
  -H "X-Signature: test" \
  -H "X-Timestamp: $(date +%s)" \
  -d '{
    "envelope": {"to": ["test@newsletters.app"]},
    "email": "test email content"
  }'
```

---

## 📊 Step 6: Monitoring Setup

### 6.1 Application Monitoring
```bash
# View application logs
pm2 logs newsletter-scraper

# Monitor process status
pm2 monit
```

### 6.2 Database Monitoring
```sql
-- Check system health in Supabase
SELECT * FROM system_health;

-- Check user statistics
SELECT * FROM user_statistics LIMIT 10;
```

### 6.3 Redis Monitoring
```bash
# Check Redis connection
redis-cli ping

# Monitor queue status
curl https://your-domain.com/api/webhooks/email/stats
```

---

## 🔒 Step 7: Security Hardening

### 7.1 SSL/TLS Configuration
1. Install SSL certificate (Let's Encrypt recommended)
2. Configure nginx with SSL settings (see nginx.conf)
3. Enable HTTP to HTTPS redirect

### 7.2 Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP (redirect)
ufw allow 443   # HTTPS
ufw enable
```

### 7.3 Rate Limiting
- Configure rate limits in nginx.conf
- Monitor rate limit violations in logs

---

## 📈 Step 8: Performance Optimization

### 8.1 Database Optimization
```sql
-- Create additional indexes for performance
CREATE INDEX CONCURRENTLY idx_items_user_published ON items (user_id, published_at DESC);

-- Update statistics
ANALYZE;
```

### 8.2 Redis Optimization
```bash
# Configure Redis persistence
echo "save 900 1" >> redis.conf
echo "save 300 10" >> redis.conf
echo "save 60 10000" >> redis.conf
```

### 8.3 Application Optimization
- Enable gzip compression (configured in nginx.conf)
- Set up CDN for static assets
- Configure caching headers

---

## 🔄 Step 9: Backup Strategy

### 9.1 Database Backups
```bash
# Set up automated Supabase backups (available in dashboard)
# Or use pg_dump for custom backups
```

### 9.2 Application Backups
```bash
# Create backup script
#!/bin/bash
tar -czf newsletter-backup-$(date +%Y%m%d).tar.gz \
  src/ public/ package*.json .env
```

### 9.3 Redis Backups
```bash
# Configure Redis persistence
echo "appendonly yes" >> redis.conf
```

---

## 📋 Step 10: Post-Deployment Tasks

### 10.1 User Documentation
- [ ] Create user onboarding guide
- [ ] Set up help documentation
- [ ] Configure support email

### 10.2 Monitoring & Alerting
- [ ] Set up uptime monitoring (Pingdom, UptimeRobot)
- [ ] Configure error alerting (Sentry)
- [ ] Set up performance monitoring (New Relic, DataDog)

### 10.3 Maintenance Schedule
- [ ] Weekly log rotation
- [ ] Monthly security updates
- [ ] Quarterly database maintenance

---

## 🆘 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs newsletter-scraper

# Common fixes:
# 1. Verify environment variables
# 2. Check database connectivity
# 3. Ensure Redis is running
```

#### Database Connection Issues
```bash
# Test connection
node -e "require('./src/config/supabase')"

# Check Supabase status
curl https://status.supabase.com
```

#### OAuth Not Working
1. Verify redirect URIs match exactly
2. Check client IDs and secrets
3. Ensure SSL is properly configured

#### Webhook Issues
1. Check SendGrid webhook configuration
2. Verify webhook secret matches
3. Test with SendGrid webhook tester

---

## 📞 Support

### Emergency Contacts
- Database: Supabase Support
- Email: SendGrid Support  
- Infrastructure: Your hosting provider

### Useful Commands
```bash
# Restart application
pm2 restart newsletter-scraper

# Check system resources
htop
df -h
free -h

# View real-time logs
tail -f /var/log/nginx/access.log
pm2 logs newsletter-scraper --lines 100
```

---

## 🎉 Deployment Complete!

Your Newsletter Scraper Platform is now live and ready for users!

**Final Checklist:**
- [x] Application running and healthy
- [x] Database configured and secured
- [x] SSL certificate installed
- [x] OAuth integrations working
- [x] Webhooks configured and tested
- [x] Monitoring in place
- [x] Backups configured

**Next Steps:**
1. Launch to beta users
2. Monitor performance and errors
3. Gather user feedback
4. Plan feature updates

🚀 **Congratulations on your successful deployment!**