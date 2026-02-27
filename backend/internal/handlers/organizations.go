package handlers

import (
	"errors"
	"net/http"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListOrganizations returns all organizations the user is a member of, with their role.
func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	query := `
		SELECT o.id, o.name, o.created_by, o.created_at, o.updated_at, om.role
		FROM organizations o
		INNER JOIN organization_members om ON o.id = om.organization_id
		WHERE om.user_id = $1
		ORDER BY o.created_at DESC
	`

	rows, err := h.pool.Query(r.Context(), query, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	orgs := []models.OrganizationWithRole{}
	for rows.Next() {
		var org models.OrganizationWithRole
		err := rows.Scan(
			&org.ID,
			&org.Name,
			&org.CreatedBy,
			&org.CreatedAt,
			&org.UpdatedAt,
			&org.Role,
		)
		if err != nil {
			http.Error(w, `{"error":"scan error"}`, http.StatusInternalServerError)
			return
		}
		orgs = append(orgs, org)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"rows error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, orgs)
}

// CreateOrganization creates a new organization and adds the creator as owner.
func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.CreateOrganizationRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Use transaction to ensure both org and membership are created
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"transaction error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// Create organization
	var org models.Organization
	orgQuery := `
		INSERT INTO organizations (name, created_by, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		RETURNING id, name, created_by, created_at, updated_at
	`
	err = tx.QueryRow(r.Context(), orgQuery, req.Name, userID).Scan(
		&org.ID,
		&org.Name,
		&org.CreatedBy,
		&org.CreatedAt,
		&org.UpdatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to create organization"}`, http.StatusInternalServerError)
		return
	}

	// Add creator as owner
	memberQuery := `
		INSERT INTO organization_members (organization_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, NOW())
	`
	_, err = tx.Exec(r.Context(), memberQuery, org.ID, userID, models.RoleOwner)
	if err != nil {
		http.Error(w, `{"error":"failed to add owner"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"commit error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, org)
}

// GetOrganization returns organization details if the user is a member.
func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgIDStr := chi.URLParam(r, "id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid organization ID"}`, http.StatusBadRequest)
		return
	}

	// Check if user can access organization
	canAccess, err := h.canAccessOrganization(r.Context(), userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canAccess {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Get organization details with user's role
	query := `
		SELECT o.id, o.name, o.created_by, o.created_at, o.updated_at, om.role
		FROM organizations o
		INNER JOIN organization_members om ON o.id = om.organization_id
		WHERE o.id = $1 AND om.user_id = $2
	`

	var org models.OrganizationWithRole
	err = h.pool.QueryRow(r.Context(), query, orgID, userID).Scan(
		&org.ID,
		&org.Name,
		&org.CreatedBy,
		&org.CreatedAt,
		&org.UpdatedAt,
		&org.Role,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"organization not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, org)
}

// UpdateOrganization updates organization name (owner/admin only).
func (h *Handler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgIDStr := chi.URLParam(r, "id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid organization ID"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateOrganizationRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Check if user can manage members (owner/admin only)
	canManage, err := h.canManageOrgMembers(r.Context(), userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canManage {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Update organization
	query := `
		UPDATE organizations
		SET name = $1, updated_at = NOW()
		WHERE id = $2
		RETURNING id, name, created_by, created_at, updated_at
	`

	var org models.Organization
	err = h.pool.QueryRow(r.Context(), query, req.Name, orgID).Scan(
		&org.ID,
		&org.Name,
		&org.CreatedBy,
		&org.CreatedAt,
		&org.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"organization not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, org)
}

// DeleteOrganization deletes an organization and unshares all its floor plans (owner only).
func (h *Handler) DeleteOrganization(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgIDStr := chi.URLParam(r, "id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid organization ID"}`, http.StatusBadRequest)
		return
	}

	// Check if user is owner
	role, err := h.getUserOrgRole(r.Context(), userID, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if role != models.RoleOwner {
		http.Error(w, `{"error":"forbidden - owner only"}`, http.StatusForbidden)
		return
	}

	// Use transaction to unshare floor plans and delete org
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"transaction error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// Unshare all floor plans (set organization_id to NULL)
	unshareQuery := `UPDATE floor_plans SET organization_id = NULL WHERE organization_id = $1`
	_, err = tx.Exec(r.Context(), unshareQuery, orgID)
	if err != nil {
		http.Error(w, `{"error":"failed to unshare floor plans"}`, http.StatusInternalServerError)
		return
	}

	// Delete organization (cascade will delete members and invitations)
	deleteQuery := `DELETE FROM organizations WHERE id = $1`
	_, err = tx.Exec(r.Context(), deleteQuery, orgID)
	if err != nil {
		http.Error(w, `{"error":"failed to delete organization"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"commit error"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
