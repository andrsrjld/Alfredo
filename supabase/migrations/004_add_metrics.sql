ALTER TABLE server_status ADD COLUMN IF NOT EXISTS cpu_usage FLOAT;
ALTER TABLE server_status ADD COLUMN IF NOT EXISTS memory_usage FLOAT;
ALTER TABLE server_status ADD COLUMN IF NOT EXISTS disk_usage FLOAT;
ALTER TABLE server_status ADD COLUMN IF NOT EXISTS uptime_hours FLOAT;

CREATE TABLE IF NOT EXISTS container_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_name TEXT NOT NULL REFERENCES server_status(server_name) ON DELETE CASCADE,
    container_name TEXT NOT NULL,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    uptime TEXT,
    ports TEXT,
    error_log TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(server_name, container_name)
);

ALTER TABLE container_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON container_status FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_container_status_server_name ON container_status (server_name);
CREATE INDEX IF NOT EXISTS idx_container_status_container_name ON container_status USING gin (container_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_container_status_image ON container_status USING gin (image gin_trgm_ops);