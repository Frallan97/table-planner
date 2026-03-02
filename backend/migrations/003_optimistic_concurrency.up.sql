-- Add version column for optimistic concurrency control
ALTER TABLE floor_plans ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Drop pessimistic locking table
DROP TABLE IF EXISTS floor_plan_locks;

-- Create presence tracking table (soft, non-blocking)
CREATE TABLE floor_plan_presence (
    floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    user_email    TEXT NOT NULL DEFAULT '',
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (floor_plan_id, user_id)
);

CREATE INDEX idx_floor_plan_presence_last_seen ON floor_plan_presence(last_seen_at);
