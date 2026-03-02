-- Drop presence table
DROP TABLE IF EXISTS floor_plan_presence;

-- Remove version column
ALTER TABLE floor_plans DROP COLUMN IF EXISTS version;

-- Recreate pessimistic locking table
CREATE TABLE floor_plan_locks (
    floor_plan_id UUID PRIMARY KEY REFERENCES floor_plans(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_floor_plan_locks_user_id ON floor_plan_locks(user_id);
CREATE INDEX idx_floor_plan_locks_expires_at ON floor_plan_locks(expires_at);
