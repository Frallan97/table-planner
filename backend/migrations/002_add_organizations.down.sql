-- Drop indexes first
DROP INDEX IF EXISTS idx_floor_plans_user_org;
DROP INDEX IF EXISTS idx_floor_plans_organization_id;
DROP INDEX IF EXISTS idx_floor_plan_locks_expires_at;
DROP INDEX IF EXISTS idx_floor_plan_locks_user_id;
DROP INDEX IF EXISTS idx_organization_invitations_token;
DROP INDEX IF EXISTS idx_organization_invitations_email;
DROP INDEX IF EXISTS idx_organization_invitations_org_id;
DROP INDEX IF EXISTS idx_organization_members_org_role;
DROP INDEX IF EXISTS idx_organization_members_user_id;
DROP INDEX IF EXISTS idx_organizations_created_by;

-- Remove organization_id column from floor_plans
ALTER TABLE floor_plans DROP COLUMN IF EXISTS organization_id;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS floor_plan_locks;
DROP TABLE IF EXISTS organization_invitations;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
