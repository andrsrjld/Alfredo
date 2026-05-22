# Fix: Pipeline Status Shows "running" After Completion

## Problem
GitLab webhooks arrive out-of-order. A delayed "running" event can overwrite a "success" event, leaving stale status in DB. No timestamp guard, no pipeline_id tracking.

## Fix Steps

### 1. DB Migration (`supabase/migrations/003_add_pipeline_id.sql`)
- Add `pipeline_id TEXT` column to `project_status`
- Add `gitlab_event_time TIMESTAMPTZ` column to `project_status`
- Add index on `pipeline_id`

### 2. Update GitLab Webhook (`src/app/api/webhook/gitlab/route.ts`)
- Extract `pipeline_id` from `payload.object_attributes?.id`
- Extract GitLab event timestamp: use `object_attributes.finished_at` for success/failed, `object_attributes.created_at` for running
- Pre-upsert guard: before writing, `SELECT gitlab_event_time, pipeline_id FROM project_status WHERE repo_name = ?`. Skip write if existing `gitlab_event_time` is newer than incoming event time.
- Fix `error_detail` logic: only `success` clears error_detail, not `running`
- Update `UNIQUE` constraint: change from `repo_name` alone to `(repo_name)` — keep repo_name as unique since we want one row per project showing latest pipeline, but use the timestamp guard to prevent stale overwrites
- Store `pipeline_id` and `gitlab_event_time` in upsert data

### 3. Update Schema (`supabase/schema.sql`)
- Add `pipeline_id TEXT` and `gitlab_event_time TIMESTAMPTZ` columns

### 4. Lint + Deploy

## Key Logic Change
```
Before upsert:
  1. Fetch existing row by repo_name
  2. If existing row has gitlab_event_time >= incoming event time → skip (stale event)
  3. Otherwise upsert with pipeline_id + gitlab_event_time from GitLab (not server time)
```