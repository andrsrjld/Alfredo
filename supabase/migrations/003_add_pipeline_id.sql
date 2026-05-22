ALTER TABLE project_status ADD COLUMN IF NOT EXISTS pipeline_id TEXT;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS gitlab_event_time TIMESTAMPTZ;

ALTER TABLE project_status DROP CONSTRAINT IF EXISTS project_status_status_check;
ALTER TABLE project_status ADD CONSTRAINT project_status_status_check CHECK (status IN ('success', 'failed', 'running', 'canceled', 'pending', 'skipped', 'manual', 'created'));

CREATE INDEX IF NOT EXISTS idx_project_status_pipeline_id ON project_status (pipeline_id);