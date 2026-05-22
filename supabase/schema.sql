-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Table: project_status
CREATE TABLE IF NOT EXISTS project_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_name TEXT UNIQUE NOT NULL,
    project_group TEXT,
    branch TEXT,
    commit_msg TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'running', 'canceled')),
    error_detail TEXT,
    gitlab_project_id TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: server_status
CREATE TABLE IF NOT EXISTS server_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_name TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    status TEXT CHECK (status IN ('online', 'offline', 'high_load')),
    notes TEXT,
    ping_secret TEXT UNIQUE,
    last_ping TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: chat_logs
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pm_number TEXT NOT NULL,
    pm_message TEXT NOT NULL,
    bot_reply TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: whitelisted_pms
CREATE TABLE IF NOT EXISTS whitelisted_pms (
    phone_number TEXT PRIMARY KEY,
    pm_name TEXT
);

-- 5. Table: app_settings (for dashboard config)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE project_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelisted_pms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users full access
CREATE POLICY "Allow authenticated full access" ON project_status FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON server_status FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON chat_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON whitelisted_pms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_project_status_repo_name ON project_status USING gin (repo_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_server_status_name ON server_status USING gin (server_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chat_logs_pm ON chat_logs (pm_number, created_at DESC);