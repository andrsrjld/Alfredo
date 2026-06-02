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
    status TEXT CHECK (status IN ('success', 'failed', 'running', 'canceled', 'pending', 'skipped', 'manual', 'created')),
    error_detail TEXT,
    gitlab_project_id TEXT,
    pipeline_id TEXT,
    gitlab_event_time TIMESTAMPTZ,
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
    ssh_host TEXT,
    ssh_port INTEGER DEFAULT 22 CHECK (ssh_port > 0 AND ssh_port <= 65535),
    ssh_username TEXT,
    ssh_auth_type TEXT CHECK (ssh_auth_type IN ('key', 'password', 'key_password')),
    ssh_private_key_encrypted TEXT,
    ssh_passphrase_encrypted TEXT,
    ssh_password_encrypted TEXT,
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
    pm_name TEXT,
    is_active BOOLEAN DEFAULT false,
    ops_role TEXT NOT NULL DEFAULT 'viewer' CHECK (ops_role IN ('viewer', 'operator', 'admin'))
);

-- 6. Table: server_services
CREATE TABLE IF NOT EXISTS server_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_name TEXT NOT NULL REFERENCES server_status(server_name) ON DELETE CASCADE ON UPDATE CASCADE,
    service_name TEXT NOT NULL,
    description TEXT,
    load_state TEXT,
    active_state TEXT,
    sub_state TEXT,
    is_allowed BOOLEAN NOT NULL DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(server_name, service_name)
);

-- 7. Table: ops_commands
CREATE TABLE IF NOT EXISTS ops_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_phone TEXT NOT NULL,
    requester_name TEXT,
    requester_role TEXT NOT NULL DEFAULT 'viewer' CHECK (requester_role IN ('viewer', 'operator', 'admin')),
    server_name TEXT NOT NULL REFERENCES server_status(server_name) ON DELETE CASCADE ON UPDATE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('container', 'service')),
    target_name TEXT,
    action TEXT NOT NULL CHECK (action IN ('list', 'logs', 'status', 'start', 'stop', 'restart')),
    status TEXT NOT NULL CHECK (status IN ('pending_confirmation', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired')),
    tail INTEGER,
    confirmation_expires_at TIMESTAMPTZ,
    output TEXT,
    error TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- 8. Table: push_devices
CREATE TABLE IF NOT EXISTS push_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    fcm_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
    app_version TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Table: notification_events
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dedupe_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE server_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users full access
CREATE POLICY "Allow authenticated full access" ON project_status FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON server_status FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON chat_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON whitelisted_pms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON app_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON server_services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON ops_commands FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON push_devices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access" ON notification_events FOR ALL USING (auth.role() = 'authenticated');

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_project_status_repo_name ON project_status USING gin (repo_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_server_status_name ON server_status USING gin (server_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chat_logs_pm ON chat_logs (pm_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_services_server_name ON server_services (server_name);
CREATE INDEX IF NOT EXISTS idx_server_services_service_name ON server_services USING gin (service_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ops_commands_server_status ON ops_commands (server_name, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_commands_requester ON ops_commands (requester_phone, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type_target ON notification_events (event_type, target, sent_at DESC);
