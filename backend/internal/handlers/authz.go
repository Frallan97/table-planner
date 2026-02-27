package handlers

import (
	"context"
	"database/sql"
	"errors"

	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// getUserOrgRole returns the user's role in an organization.
// Returns empty string if user is not a member.
func (h *Handler) getUserOrgRole(ctx context.Context, userID, orgID uuid.UUID) (string, error) {
	var role string
	query := `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`
	err := h.pool.QueryRow(ctx, query, orgID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

// canAccessOrganization checks if the user is a member of the organization.
func (h *Handler) canAccessOrganization(ctx context.Context, userID, orgID uuid.UUID) (bool, error) {
	role, err := h.getUserOrgRole(ctx, userID, orgID)
	if err != nil {
		return false, err
	}
	return role != "", nil
}

// canManageOrgMembers checks if the user can manage organization members (owner or admin only).
func (h *Handler) canManageOrgMembers(ctx context.Context, userID, orgID uuid.UUID) (bool, error) {
	role, err := h.getUserOrgRole(ctx, userID, orgID)
	if err != nil {
		return false, err
	}
	return role == models.RoleOwner || role == models.RoleAdmin, nil
}

// canViewFloorPlan checks if the user can view a floor plan.
// Users can view if they are the creator OR if the plan is shared to an org they're a member of.
func (h *Handler) canViewFloorPlan(ctx context.Context, userID, floorPlanID uuid.UUID) (bool, error) {
	var creatorID uuid.UUID
	var orgID sql.NullString
	query := `SELECT user_id, organization_id FROM floor_plans WHERE id = $1`
	err := h.pool.QueryRow(ctx, query, floorPlanID).Scan(&creatorID, &orgID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	// Creator can always view
	if creatorID == userID {
		return true, nil
	}

	// If plan is personal (org_id is NULL), only creator can view
	if !orgID.Valid {
		return false, nil
	}

	// Check if user is a member of the organization
	orgUUID, err := uuid.Parse(orgID.String)
	if err != nil {
		return false, err
	}

	return h.canAccessOrganization(ctx, userID, orgUUID)
}

// canEditFloorPlan checks if the user can edit a floor plan.
// Users can edit if they are the creator OR if the plan is shared to an org they're a member of (not viewer).
func (h *Handler) canEditFloorPlan(ctx context.Context, userID, floorPlanID uuid.UUID) (bool, error) {
	var creatorID uuid.UUID
	var orgID sql.NullString
	query := `SELECT user_id, organization_id FROM floor_plans WHERE id = $1`
	err := h.pool.QueryRow(ctx, query, floorPlanID).Scan(&creatorID, &orgID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	// Creator can always edit
	if creatorID == userID {
		return true, nil
	}

	// If plan is personal (org_id is NULL), only creator can edit
	if !orgID.Valid {
		return false, nil
	}

	// Check if user is a member of the organization and not a viewer
	orgUUID, err := uuid.Parse(orgID.String)
	if err != nil {
		return false, err
	}

	role, err := h.getUserOrgRole(ctx, userID, orgUUID)
	if err != nil {
		return false, err
	}

	// Members with owner, admin, or member role can edit (not viewer)
	return role == models.RoleOwner || role == models.RoleAdmin || role == models.RoleMember, nil
}

// canShareToOrganization checks if the user can share a floor plan to an organization.
// User must be a member of the organization.
func (h *Handler) canShareToOrganization(ctx context.Context, userID, orgID uuid.UUID) (bool, error) {
	return h.canAccessOrganization(ctx, userID, orgID)
}
