-- Newsletter Scraper Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    forwarding_address VARCHAR(255) UNIQUE,
    preferences JSONB DEFAULT '{"aiSummaries": false, "emailNotifications": true, "theme": "light"}'::jsonb,
    is_email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_forwarding_address ON users(forwarding_address);

-- OAuth credentials table
CREATE TABLE oauth_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    provider_user_id VARCHAR(255) NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Create indexes for oauth_credentials table
CREATE INDEX idx_oauth_credentials_user_id ON oauth_credentials(user_id);
CREATE INDEX idx_oauth_credentials_provider ON oauth_credentials(provider);
CREATE INDEX idx_oauth_credentials_provider_user_id ON oauth_credentials(provider_user_id);

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('gmail', 'outlook', 'rss', 'forwarding')),
    name VARCHAR(255) NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
    error_message TEXT,
    item_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sources table
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_user_type ON sources(user_id, type);
CREATE INDEX idx_sources_active ON sources(is_active);
CREATE INDEX idx_sources_last_sync ON sources(last_sync_at);
CREATE INDEX idx_sources_sync_status ON sources(sync_status);

-- Items table (for future stories - newsletter content)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT,
    raw_content TEXT,
    url VARCHAR(1000),
    published_at TIMESTAMP WITH TIME ZONE,
    normalized_hash VARCHAR(64) UNIQUE, -- For deduplication
    fingerprint VARCHAR(32), -- For near-duplicate detection
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for items table
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_source_id ON items(source_id);
CREATE INDEX idx_items_normalized_hash ON items(normalized_hash);
CREATE INDEX idx_items_published_at ON items(published_at);
CREATE INDEX idx_items_is_read ON items(is_read);
CREATE INDEX idx_items_created_at ON items(created_at);

-- Full-text search index for items
CREATE INDEX idx_items_search ON items USING GIN (to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Summaries table (for AI summaries - future story)
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    headline VARCHAR(500),
    bullets TEXT[],
    model_version VARCHAR(50),
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(item_id)
);

-- Create indexes for summaries table
CREATE INDEX idx_summaries_item_id ON summaries(item_id);

-- Exports table (for export functionality - future story)
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(50) NOT NULL CHECK (format IN ('markdown', 'csv', 'notion')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path VARCHAR(500),
    item_count INTEGER,
    filters JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for exports table
CREATE INDEX idx_exports_user_id ON exports(user_id);
CREATE INDEX idx_exports_status ON exports(status);

-- Jobs table (for background processing)
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for jobs table
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_scheduled_at ON jobs(scheduled_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_credentials_updated_at BEFORE UPDATE ON oauth_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exports_updated_at BEFORE UPDATE ON exports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own oauth credentials" ON oauth_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own oauth credentials" ON oauth_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own oauth credentials" ON oauth_credentials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own oauth credentials" ON oauth_credentials FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sources" ON sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON sources FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own items" ON items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items" ON items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items" ON items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own summaries" ON summaries FOR SELECT USING (auth.uid() = (SELECT user_id FROM items WHERE items.id = item_id));
CREATE POLICY "Users can insert own summaries" ON summaries FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM items WHERE items.id = item_id));
CREATE POLICY "Users can update own summaries" ON summaries FOR UPDATE USING (auth.uid() = (SELECT user_id FROM items WHERE items.id = item_id));
CREATE POLICY "Users can delete own summaries" ON summaries FOR DELETE USING (auth.uid() = (SELECT user_id FROM items WHERE items.id = item_id));

CREATE POLICY "Users can view own exports" ON exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exports" ON exports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON exports FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all data (for server-side operations)
CREATE POLICY "Service role can access all users" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all oauth_credentials" ON oauth_credentials FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all sources" ON sources FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all items" ON items FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all summaries" ON summaries FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all exports" ON exports FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can access all jobs" ON jobs FOR ALL TO service_role USING (true);