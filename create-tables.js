require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  console.log('🗄️  Creating database tables manually...');
  
  try {
    // Create users table first
    console.log('Creating users table...');
    const usersResult = await supabase.rpc('exec', {
      query: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          is_email_verified BOOLEAN DEFAULT false,
          preferences JSONB DEFAULT '{"aiSummaries": false, "emailNotifications": true, "theme": "light"}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (usersResult.error) {
      console.log('Direct SQL execution not available. You need to run the schema manually.');
      console.log('');
      console.log('📋 Please go to your Supabase dashboard:');
      console.log('1. Go to https://tixqmrziktpzbjbdguhy.supabase.co');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the contents of database/schema.sql');
      console.log('');
      console.log('Or copy and paste this basic schema:');
      console.log('');
      console.log(`
-- Basic schema for Newsletter Scraper
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_email_verified BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{"aiSummaries": false, "emailNotifications": true, "theme": "light"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  configuration JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sync_status VARCHAR(20) DEFAULT 'pending',
  sync_error TEXT,
  item_count INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  raw_content TEXT,
  url VARCHAR(1000),
  published_at TIMESTAMP WITH TIME ZONE,
  normalized_hash VARCHAR(64) NOT NULL,
  fingerprint VARCHAR(8) NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);
      `);
      
      return;
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTables();