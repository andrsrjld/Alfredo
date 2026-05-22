ALTER TABLE project_status ADD COLUMN IF NOT EXISTS pipeline_id TEXT;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS gitlab_event_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_project_status_pipeline_id ON project_status (pipeline_id);