-- Migration: Add per-server ping_secret, pipeline error_detail, gitlab_project_id
-- Run: psql "$DATABASE_URL" -f supabase/migrations/001_add_columns.sql

ALTER TABLE server_status ADD COLUMN IF NOT EXISTS ping_secret TEXT UNIQUE;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS error_detail TEXT;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS gitlab_project_id TEXT;