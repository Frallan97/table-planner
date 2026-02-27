-- Organizations table
CREATE TABLE organizations (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- Organization members junction table
CREATE TABLE organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_org_role ON organization_members(organization_id, role);

-- Organization invitations
CREATE TABLE organization_invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL CHECK (char_length(email) >= 3 AND char_length(email) <= 255),
    role            TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    token           TEXT NOT NULL UNIQUE,
    invited_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX idx_organization_invitations_email ON organization_invitations(email);
CREATE UNIQUE INDEX idx_organization_invitations_token ON organization_invitations(token);

-- Floor plan locks for single-user edit mode
CREATE TABLE floor_plan_locks (
    floor_plan_id UUID PRIMARY KEY REFERENCES floor_plans(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_floor_plan_locks_user_id ON floor_plan_locks(user_id);
CREATE INDEX idx_floor_plan_locks_expires_at ON floor_plan_locks(expires_at);

-- Add organization_id to floor_plans (nullable - NULL means personal plan)
ALTER TABLE floor_plans ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_floor_plans_organization_id ON floor_plans(organization_id);
CREATE INDEX idx_floor_plans_user_org ON floor_plans(user_id, organization_id);
