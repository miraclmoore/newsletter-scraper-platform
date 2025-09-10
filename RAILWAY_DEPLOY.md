# 🚄 Railway Deployment Guide

## Quick Deploy to Railway (15 minutes)

### Prerequisites
- GitHub account
- Railway account (sign up at [railway.app](https://railway.app))
- Your Newsletter Scraper Platform repository

### Step 1: Push to GitHub

1. **Create a new GitHub repository** (if you haven't already)
   - Go to [github.com](https://github.com) 
   - Create new repository: `newsletter-scraper`
   - Don't initialize with README (we have everything ready)

2. **Push your code**
   ```bash
   # In your project directory
   git init
   git add .
   git commit -m "Initial commit - Newsletter Scraper Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/newsletter-scraper.git
   git push -u origin main
   ```

### Step 2: Deploy to Railway

1. **Visit [railway.app](https://railway.app)**
   - Sign up/login with your GitHub account
   - Click "Start a New Project"

2. **Deploy from GitHub**
   - Select "Deploy from GitHub repo"
   - Choose your `newsletter-scraper` repository
   - Railway will automatically detect it's a Node.js project

3. **Railway will automatically:**
   - ✅ Detect Node.js and install dependencies
   - ✅ Use our `railway.json` configuration
   - ✅ Set up health checks on `/health`
   - ✅ Provide HTTPS domain automatically

### Step 3: Configure Environment Variables

In Railway dashboard, go to your project > Variables tab:

```bash
# Core Application
NODE_ENV=production
PORT=3000

# Your existing Supabase credentials (from your .env)
SUPABASE_URL=https://tixqmrziktpzbjbdguhy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Security (generate new values for production)
JWT_SECRET=your-production-jwt-secret-32-characters-min
ENCRYPTION_KEY=your-production-32-character-key

# OAuth (replace with your production credentials)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Services (add when ready)
SENDGRID_WEBHOOK_SECRET=your-sendgrid-secret
OPENAI_API_KEY=your-openai-key

# Redis (Railway can provide this)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Disable RSS polling initially
RSS_POLLING_ENABLED=false
```

### Step 4: Add Redis Database

1. **In Railway dashboard:**
   - Click "New" > "Database" > "Add Redis"
   - Railway will automatically provide connection details
   - Copy the Redis connection details to your environment variables

### Step 5: Deploy & Verify

1. **Railway will automatically deploy** after you set variables
2. **Get your public URL** from Railway dashboard  
3. **Test your deployment:**
   - Visit `https://your-app.railway.app/health`
   - Should see: `{"status":"healthy","timestamp":"...","version":"1.0.0"}`
   - Visit `https://your-app.railway.app` to see your dashboard

### Step 6: Custom Domain (Optional)

1. **In Railway dashboard > Settings > Domains**
2. **Add your custom domain**
3. **Configure DNS** as instructed by Railway
4. **SSL is automatic!**

## 🎉 You're Live!

Your Newsletter Scraper Platform is now running in production with:
- ✅ Automatic HTTPS
- ✅ Health monitoring  
- ✅ Auto-scaling
- ✅ Redis database
- ✅ Environment variables secured
- ✅ GitHub integration for easy updates

## Next Steps After Deployment

1. **Set up external services:**
   - Configure SendGrid webhook endpoint
   - Set up OAuth credentials with your production domain
   - Add OpenAI API key for AI features

2. **Test production features:**
   - Email webhook processing
   - OAuth authentication flows
   - Export functionality

3. **Monitor and maintain:**
   - Check Railway logs for any issues
   - Monitor health endpoints
   - Set up alerts if needed

## Troubleshooting

- **Build fails?** Check Railway logs in dashboard
- **App crashes?** Verify all environment variables are set
- **Database issues?** Confirm Supabase connection details
- **Need help?** Railway has excellent Discord support community

---

**Total deployment time: ~15 minutes** ⚡

Your Newsletter Scraper Platform will be live at: `https://your-app.railway.app`