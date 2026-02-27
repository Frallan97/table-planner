package handlers

import (
	"net/http"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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
