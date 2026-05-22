-- Migration: Add group chat support
-- Run: psql "$DATABASE_URL" -f supabase/migrations/002_add_group_support.sql

ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS group_id TEXT;