package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ShareFloorPlan shares a floor plan with an organization.
// User must be the creator and a member of the target organization.
func (h *Handler) ShareFloorPlan(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	fpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid floor plan id"}`, http.StatusBadRequest)
		return
	}

	var req models.ShareFloorPlanRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if err := req.Validate(); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Verify user is the creator of the floor plan
	var creatorID uuid.UUID
	var currentOrgID *uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		`SELECT user_id, organization_id FROM floor_plans WHERE id = $1`,
		fpID,
	).Scan(&creatorID, &currentOrgID)
	if err != nil {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	if creatorID != userID {
		http.Error(w, `{"error":"only creator can share floor plan"}`, http.StatusForbidden)
		return
	}

	// Verify user is a member of the target organization
	canShare, err := h.canShareToOrganization(r.Context(), userID, req.OrganizationID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canShare {
		http.Error(w, `{"error":"not a member of this organization"}`, http.StatusForbidden)
		return
	}

	// Share the floor plan (set organization_id)
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE floor_plans SET organization_id = $1, updated_at = NOW() WHERE id = $2`,
		req.OrganizationID, fpID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, `{"error":"failed to share floor plan"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "shared"})
}

// UnshareFloorPlan removes the organization from a floor plan (makes it personal again).
// User must be the creator of the floor plan.
func (h *Handler) UnshareFloorPlan(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	fpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid floor plan id"}`, http.StatusBadRequest)
		return
	}

	// Verify user is the creator of the floor plan
	var creatorID uuid.UUID
	var orgID *uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		`SELECT user_id, organization_id FROM floor_plans WHERE id = $1`,
		fpID,
	).Scan(&creatorID, &orgID)
	if err != nil {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	if creatorID != userID {
		http.Error(w, `{"error":"only creator can unshare floor plan"}`, http.StatusForbidden)
		return
	}

	if orgID == nil {
		http.Error(w, `{"error":"floor plan is not shared"}`, http.StatusBadRequest)
		return
	}

	// Unshare the floor plan (set organization_id to NULL)
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE floor_plans SET organization_id = NULL, updated_at = NOW() WHERE id = $1`,
		fpID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, `{"error":"failed to unshare floor plan"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "unshared"})
}

// CreateShareToken generates a public share token for a floor plan.
// Only the creator can create a share token. Old active tokens are deactivated first.
func (h *Handler) CreateShareToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	fpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid floor plan id"}`, http.StatusBadRequest)
		return
	}

	// Verify user is the creator
	var creatorID uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		`SELECT user_id FROM floor_plans WHERE id = $1`, fpID,
	).Scan(&creatorID)
	if err != nil {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}
	if creatorID != userID {
		http.Error(w, `{"error":"only creator can create share token"}`, http.StatusForbidden)
		return
	}

	// Generate cryptographically random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}
	token := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(tokenBytes)

	// Deactivate old tokens and insert new one in a transaction
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(),
		`UPDATE floor_plan_share_tokens SET is_active = false WHERE floor_plan_id = $1 AND is_active = true`,
		fpID,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(r.Context(),
		`INSERT INTO floor_plan_share_tokens (floor_plan_id, token, created_by) VALUES ($1, $2, $3)`,
		fpID, token, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"token": token})
}

// RevokeShareToken deactivates the active share token for a floor plan.
func (h *Handler) RevokeShareToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	fpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid floor plan id"}`, http.StatusBadRequest)
		return
	}

	// Verify user is the creator
	var creatorID uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		`SELECT user_id FROM floor_plans WHERE id = $1`, fpID,
	).Scan(&creatorID)
	if err != nil {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}
	if creatorID != userID {
		http.Error(w, `{"error":"only creator can revoke share token"}`, http.StatusForbidden)
		return
	}

	_, err = h.pool.Exec(r.Context(),
		`UPDATE floor_plan_share_tokens SET is_active = false WHERE floor_plan_id = $1 AND is_active = true`,
		fpID,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

// GetShareToken returns the active share token for a floor plan, or null.
func (h *Handler) GetShareToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	fpID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid floor plan id"}`, http.StatusBadRequest)
		return
	}

	// Verify user can view this floor plan
	canView, err := h.canViewFloorPlan(r.Context(), userID, fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canView {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	var token *string
	err = h.pool.QueryRow(r.Context(),
		`SELECT token FROM floor_plan_share_tokens WHERE floor_plan_id = $1 AND is_active = true LIMIT 1`,
		fpID,
	).Scan(&token)
	if err == pgx.ErrNoRows || token == nil {
		respondJSON(w, http.StatusOK, map[string]*string{"token": nil})
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]*string{"token": token})
}

// GetFloorPlanByShareToken returns a floor plan by its public share token (no auth required).
func (h *Handler) GetFloorPlanByShareToken(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if token == "" {
		http.Error(w, `{"error":"missing token"}`, http.StatusBadRequest)
		return
	}

	// Look up active token
	var fpID uuid.UUID
	err := h.pool.QueryRow(r.Context(),
		`SELECT floor_plan_id FROM floor_plan_share_tokens WHERE token = $1 AND is_active = true`,
		token,
	).Scan(&fpID)
	if err != nil {
		http.Error(w, `{"error":"invalid or expired share link"}`, http.StatusNotFound)
		return
	}

	// Get floor plan
	var fp models.FloorPlan
	var orgName *string
	err = h.pool.QueryRow(r.Context(),
		`SELECT fp.id, fp.user_id, fp.name, fp.version, fp.organization_id, fp.created_at, fp.updated_at, o.name
		 FROM floor_plans fp
		 LEFT JOIN organizations o ON fp.organization_id = o.id
		 WHERE fp.id = $1`,
		fpID,
	).Scan(&fp.ID, &fp.UserID, &fp.Name, &fp.Version, &fp.OrganizationID, &fp.CreatedAt, &fp.UpdatedAt, &orgName)
	if err != nil {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	tables, err := h.getEntityData(r.Context(), "floor_plan_tables", fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	guests, err := h.getEntityData(r.Context(), "floor_plan_guests", fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	labels, err := h.getEntityData(r.Context(), "floor_plan_labels", fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	result := struct {
		ID               uuid.UUID           `json:"id"`
		Name             string              `json:"name"`
		Tables           []json.RawMessage   `json:"tables"`
		Guests           []json.RawMessage   `json:"guests"`
		Labels           []json.RawMessage   `json:"labels"`
		OrganizationName *string             `json:"organizationName,omitempty"`
	}{
		ID:               fp.ID,
		Name:             fp.Name,
		Tables:           tables,
		Guests:           guests,
		Labels:           labels,
		OrganizationName: orgName,
	}

	respondJSON(w, http.StatusOK, result)
}
