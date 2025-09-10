-- Newsletter Scraper Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable for OAuth-only users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_email_verified BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{"aiSummaries": false, "emailNotifications": true, "theme": "light"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sources table
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'rss', 'gmail', 'outlook', 'forwarding'
    name VARCHAR(255) NOT NULL,
    configuration JSONB DEFAULT '{}', -- Type-specific configuration (urls, credentials, etc)
    metadata JSONB DEFAULT '{}', -- Sync metadata, error info, etc
    is_active BOOLEAN DEFAULT true,
    sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
    sync_error TEXT,
    item_count INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    raw_content TEXT, -- Original HTML/raw content
    url VARCHAR(1000),
    published_at TIMESTAMP WITH TIME ZONE,
    normalized_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for exact duplicate detection
    fingerprint VARCHAR(8) NOT NULL, -- Shorter hash for similarity detection
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- Additional metadata (author, tags, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth credentials table (for Gmail/Outlook)
CREATE TABLE IF NOT EXISTS oauth_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL, -- 'gmail', 'outlook'
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    iv VARCHAR(32) NOT NULL, -- Initialization vector for encryption
    auth_tag VARCHAR(32) NOT NULL, -- Authentication tag for encryption
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_sync_status ON sources(sync_status);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_source_id ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_normalized_hash ON items(normalized_hash);
CREATE INDEX IF NOT EXISTS idx_items_fingerprint ON items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at);
CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read);
CREATE INDEX IF NOT EXISTS idx_oauth_credentials_user_provider ON oauth_credentials(user_id, provider);

-- Full-text search index for items
CREATE INDEX IF NOT EXISTS idx_items_content_search ON items USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_credentials_updated_at BEFORE UPDATE ON oauth_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Sources policies
CREATE POLICY "Users can view own sources" ON sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON sources FOR DELETE USING (auth.uid() = user_id);

-- Items policies
CREATE POLICY "Users can view own items" ON items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON items FOR DELETE USING (auth.uid() = user_id);

-- OAuth credentials policies
CREATE POLICY "Users can view own oauth credentials" ON oauth_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own oauth credentials" ON oauth_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own oauth credentials" ON oauth_credentials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own oauth credentials" ON oauth_credentials FOR DELETE USING (auth.uid() = user_id);