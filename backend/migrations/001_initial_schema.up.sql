CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE floor_plans (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT 'Untitled Floor Plan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_floor_plans_user_id ON floor_plans(user_id);

CREATE TABLE floor_plan_tables (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id  UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    data           JSONB NOT NULL
);

CREATE INDEX idx_floor_plan_tables_fp ON floor_plan_tables(floor_plan_id);

CREATE TABLE floor_plan_guests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id  UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    data           JSONB NOT NULL
);

CREATE INDEX idx_floor_plan_guests_fp ON floor_plan_guests(floor_plan_id);

CREATE TABLE floor_plan_labels (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_plan_id  UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    data           JSONB NOT NULL
);

CREATE INDEX idx_floor_plan_labels_fp ON floor_plan_labels(floor_plan_id);
