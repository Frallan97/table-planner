CREATE TABLE floor_plan_share_tokens (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id  UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    token          TEXT NOT NULL UNIQUE,
    created_by     UUID NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_share_tokens_token ON floor_plan_share_tokens(token);
CREATE INDEX idx_share_tokens_fp ON floor_plan_share_tokens(floor_plan_id);
