# Supabase Migration Setup Guide

This guide will help you set up Supabase for the Newsletter Scraper project.

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Set project name: `newsletter-scraper`
5. Set database password (save this!)
6. Choose region closest to you
7. Click "Create new project"

### 2. Get API Keys

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy the following to your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set up Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Copy and paste the entire content from `supabase/schema.sql`
4. Click "Run" to execute the schema

### 4. Configure Environment Variables

Update your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Keep your existing OAuth settings
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
# ... etc
```

### 5. Test Connection

```bash
npm run dev
```

You should see:
```
✅ Supabase connection established successfully
🚀 Newsletter Scraper API server running on port 3000
```

## 🗄️ Database Schema Overview

The migration creates these tables:

- **users** - User accounts with preferences
- **oauth_credentials** - Encrypted OAuth tokens  
- **sources** - Newsletter sources (Gmail, Outlook, RSS, etc.)
- **items** - Newsletter content (for future stories)
- **summaries** - AI-generated summaries (for future stories)
- **exports** - Export jobs (for future stories)
- **jobs** - Background job processing

## 🔒 Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their own data
- Service role can access all data (for server operations)

### Data Protection
- OAuth tokens are encrypted before storage
- User passwords are hashed with bcrypt
- API keys are never exposed to clients

## 🧪 Testing the Setup

### Test User Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

## 📊 Monitoring & Analytics

In your Supabase dashboard, you can:

- **Database** → View tables and data
- **Authentication** → Monitor user sign-ups
- **Storage** → Manage file uploads (for future features)
- **Edge Functions** → Deploy serverless functions
- **Logs** → View real-time logs
- **Reports** → Database performance metrics

## 🔧 Advanced Configuration

### Real-time Features (Future Enhancement)
Supabase provides real-time subscriptions for live updates:

```javascript
// Example: Listen for new newsletter items
const subscription = supabase
  .channel('newsletter-items')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'items'
  }, (payload) => {
    console.log('New newsletter item:', payload.new)
  })
  .subscribe()
```

### Edge Functions (Future Enhancement)
Deploy serverless functions for:
- Email parsing
- AI summarization
- Export processing
- Webhook handling

## 🆘 Troubleshooting

### Connection Issues
1. Check your `.env` file for correct URLs and keys
2. Ensure your Supabase project is active
3. Verify network connectivity

### Schema Issues
1. Check SQL Editor for error messages
2. Ensure all SQL commands executed successfully
3. Verify tables exist in Database → Tables

### Authentication Issues
1. Check API keys are correct
2. Verify RLS policies are applied
3. Test with service role key first

## 📈 Migration Benefits

### Vs. Local PostgreSQL:
- ✅ No local database setup required
- ✅ Built-in authentication system
- ✅ Real-time capabilities
- ✅ Automatic backups
- ✅ Scalable infrastructure
- ✅ Built-in API generation
- ✅ Row Level Security
- ✅ Dashboard and monitoring

### Development Speed:
- ⚡ Instant database provisioning
- ⚡ Auto-generated REST APIs
- ⚡ Built-in user management
- ⚡ Real-time subscriptions ready
- ⚡ File storage included