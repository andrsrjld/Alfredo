-- Migration 007: Message buffer for debounce/consolidation
-- Groups rapid-fire messages from same sender into single LLM reply

CREATE TABLE IF NOT EXISTS message_buffer (
    pm_number TEXT PRIMARY KEY,
    messages JSONB NOT NULL DEFAULT '[]',
    reply_target TEXT NOT NULL,
    first_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_group BOOLEAN DEFAULT false,
    group_id TEXT,
    participant TEXT
);

-- RLS
ALTER TABLE message_buffer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON message_buffer FOR ALL USING (auth.role() = 'authenticated');

-- Index for cron flush query
CREATE INDEX IF NOT EXISTS idx_message_buffer_last_message ON message_buffer (last_message_at);

-- pg_cron job: flush expired buffers every 10 seconds
-- Requires pg_cron + pg_net extensions enabled
-- Secret stored in app_settings -> system_config -> buffer_flush_cron_secret
-- Insert via Supabase SQL Editor: INSERT INTO app_settings (key, value) VALUES ('system_config', '{"buffer_flush_cron_secret": "YOUR_SECRET"}') ON CONFLICT (key) DO UPDATE SET value = app_settings.value || '{"buffer_flush_cron_secret": "YOUR_SECRET"}';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'flush-message-buffers',
            '10 seconds',
            $$
            SELECT
                net.http_post(
                    url := 'https://alfredo-pi.vercel.app/api/cron/flush-buffers',
                    body := '{}'::jsonb,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || (SELECT value->>'buffer_flush_cron_secret' FROM app_settings WHERE key = 'system_config')
                    )
                )
            WHERE EXISTS (
                SELECT 1 FROM message_buffer
                WHERE last_message_at < NOW() - INTERVAL '15 seconds'
            )
            $$
        );
    END IF;
END $$;
