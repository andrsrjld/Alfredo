-- Migration 007: Ops command queue, SSH setup metadata, roles, and mobile push

ALTER TABLE whitelisted_pms
  ADD COLUMN IF NOT EXISTS ops_role TEXT NOT NULL DEFAULT 'viewer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whitelisted_pms_ops_role_check'
  ) THEN
    ALTER TABLE whitelisted_pms
      ADD CONSTRAINT whitelisted_pms_ops_role_check
      CHECK (ops_role IN ('viewer', 'operator', 'admin'));
  END IF;
END $$;

ALTER TABLE server_status
  ADD COLUMN IF NOT EXISTS ssh_host TEXT,
  ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22,
  ADD COLUMN IF NOT EXISTS ssh_username TEXT,
  ADD COLUMN IF NOT EXISTS ssh_auth_type TEXT,
  ADD COLUMN IF NOT EXISTS ssh_private_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ssh_passphrase_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ssh_password_encrypted TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'server_status_ssh_port_check'
  ) THEN
    ALTER TABLE server_status
      ADD CONSTRAINT server_status_ssh_port_check
      CHECK (ssh_port IS NULL OR (ssh_port > 0 AND ssh_port <= 65535));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'server_status_ssh_auth_type_check'
  ) THEN
    ALTER TABLE server_status
      ADD CONSTRAINT server_status_ssh_auth_type_check
      CHECK (ssh_auth_type IS NULL OR ssh_auth_type IN ('key', 'password', 'key_password'));
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS push_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    fcm_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
    app_version TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dedupe_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE server_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'server_services' AND policyname = 'Allow authenticated full access') THEN
    CREATE POLICY "Allow authenticated full access" ON server_services FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ops_commands' AND policyname = 'Allow authenticated full access') THEN
    CREATE POLICY "Allow authenticated full access" ON ops_commands FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_devices' AND policyname = 'Allow authenticated full access') THEN
    CREATE POLICY "Allow authenticated full access" ON push_devices FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_events' AND policyname = 'Allow authenticated full access') THEN
    CREATE POLICY "Allow authenticated full access" ON notification_events FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_server_services_server_name ON server_services (server_name);
CREATE INDEX IF NOT EXISTS idx_server_services_service_name ON server_services USING gin (service_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ops_commands_server_status ON ops_commands (server_name, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_commands_requester ON ops_commands (requester_phone, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type_target ON notification_events (event_type, target, sent_at DESC);
