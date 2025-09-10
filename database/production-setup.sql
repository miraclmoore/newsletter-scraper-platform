-- Newsletter Scraper Platform - Production Database Setup
-- Run this script in your Supabase SQL editor for production setup

-- ====================
-- ENABLE ROW LEVEL SECURITY
-- ====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- ====================
-- ROW LEVEL SECURITY POLICIES
-- ====================

-- Users table policies
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Sources table policies
CREATE POLICY "Users can view own sources" ON sources
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sources" ON sources
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sources" ON sources
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sources" ON sources
    FOR DELETE USING (auth.uid() = user_id);

-- Items table policies
CREATE POLICY "Users can view own items" ON items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items" ON items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items" ON items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items" ON items
    FOR DELETE USING (auth.uid() = user_id);

-- Summaries table policies
CREATE POLICY "Users can view own summaries" ON summaries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries" ON summaries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries" ON summaries
    FOR UPDATE USING (auth.uid() = user_id);

-- ====================
-- PERFORMANCE INDEXES
-- ====================

-- User-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_forwarding_address ON users (forwarding_address);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users (created_at);

-- Source-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_user_id ON sources (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_type ON sources (type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_active ON sources (is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_url ON sources (url);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_last_polled ON sources (last_polled_at);

-- Item-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_user_id ON items (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_source_id ON items (source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_published_at ON items (published_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_normalized_hash ON items (normalized_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_status ON items (status);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_user_published ON items (user_id, published_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_user_source ON items (user_id, source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_user_status ON items (user_id, status);

-- Summary-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_user_id ON summaries (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_item_id ON summaries (item_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_content_hash ON summaries (content_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_model_version ON summaries (model_version);

-- ====================
-- FUNCTIONS AND TRIGGERS
-- ====================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_summaries_updated_at ON summaries;
CREATE TRIGGER update_summaries_updated_at
    BEFORE UPDATE ON summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- STATISTICS AND MAINTENANCE
-- ====================

-- Update table statistics
ANALYZE users;
ANALYZE sources;
ANALYZE items;
ANALYZE summaries;

-- ====================
-- BACKUP AND ARCHIVAL SETUP
-- ====================

-- Create partition for items table by month (for better performance with large datasets)
-- This is optional but recommended for high-volume installations

-- Function to create monthly partitions for items
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    start_month text;
    end_date date;
BEGIN
    start_month := to_char(start_date, 'YYYY_MM');
    partition_name := table_name || '_' || start_month;
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                    FOR VALUES FROM (%L) TO (%L)',
                    partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- ====================
-- MONITORING VIEWS
-- ====================

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    COUNT(DISTINCT s.id) as source_count,
    COUNT(DISTINCT i.id) as item_count,
    COUNT(DISTINCT sm.id) as summary_count,
    MAX(i.created_at) as last_item_at
FROM users u
LEFT JOIN sources s ON u.id = s.user_id AND s.is_active = true
LEFT JOIN items i ON u.id = i.user_id
LEFT JOIN summaries sm ON u.id = sm.user_id
GROUP BY u.id, u.email, u.created_at;

-- View for system health monitoring
CREATE OR REPLACE VIEW system_health AS
SELECT 
    'total_users' as metric,
    COUNT(*)::text as value
FROM users
UNION ALL
SELECT 
    'active_sources' as metric,
    COUNT(*)::text as value
FROM sources WHERE is_active = true
UNION ALL
SELECT 
    'total_items' as metric,
    COUNT(*)::text as value
FROM items
UNION ALL
SELECT 
    'items_today' as metric,
    COUNT(*)::text as value
FROM items WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'summaries_generated' as metric,
    COUNT(*)::text as value
FROM summaries;

-- ====================
-- SECURITY SETTINGS
-- ====================

-- Create read-only role for monitoring
CREATE ROLE newsletter_monitor;
GRANT SELECT ON user_statistics, system_health TO newsletter_monitor;

-- Create application role with limited permissions
CREATE ROLE newsletter_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sources, items, summaries TO newsletter_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO newsletter_app;

-- ====================
-- CLEANUP PROCEDURES
-- ====================

-- Function to cleanup old data (run as scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete items older than 2 years
    DELETE FROM items 
    WHERE created_at < CURRENT_DATE - INTERVAL '2 years';
    
    -- Delete orphaned summaries
    DELETE FROM summaries 
    WHERE item_id NOT IN (SELECT id FROM items);
    
    -- Update statistics after cleanup
    ANALYZE items;
    ANALYZE summaries;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- COMPLETION MESSAGE
-- ====================

DO $$
BEGIN
    RAISE NOTICE 'Newsletter Scraper production database setup completed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify RLS policies are working correctly';
    RAISE NOTICE '2. Set up automated backups';
    RAISE NOTICE '3. Configure monitoring alerts';
    RAISE NOTICE '4. Test application connectivity';
END $$;