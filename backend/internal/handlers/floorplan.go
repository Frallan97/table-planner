package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) ListFloorPlans(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get personal plans + plans from orgs the user is a member of
	query := `
		SELECT fp.id, fp.user_id, fp.name, fp.organization_id, fp.created_at, fp.updated_at,
		       o.name as organization_name,
		       CASE WHEN fp.organization_id IS NULL THEN true ELSE false END as is_personal
		FROM floor_plans fp
		LEFT JOIN organizations o ON fp.organization_id = o.id
		WHERE fp.user_id = $1
		   OR fp.organization_id IN (
			   SELECT organization_id FROM organization_members WHERE user_id = $1
		   )
		ORDER BY fp.updated_at DESC
	`

	rows, err := h.pool.Query(r.Context(), query, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	plans := []models.FloorPlanWithOrg{}
	for rows.Next() {
		var fp models.FloorPlanWithOrg
		var orgName *string
		if err := rows.Scan(&fp.ID, &fp.UserID, &fp.Name, &fp.OrganizationID, &fp.CreatedAt, &fp.UpdatedAt, &orgName, &fp.IsPersonal); err != nil {
			http.Error(w, `{"error":"scan error"}`, http.StatusInternalServerError)
			return
		}
		fp.OrganizationName = orgName
		plans = append(plans, fp)
	}

	writeJSON(w, http.StatusOK, plans)
}

func (h *Handler) CreateFloorPlan(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.CreateFloorPlanRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		req.Name = "Untitled Floor Plan"
	}

	fp := models.FloorPlan{
		ID:        uuid.New(),
		UserID:    userID,
		Name:      req.Name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := h.pool.Exec(r.Context(),
		`INSERT INTO floor_plans (id, user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		fp.ID, fp.UserID, fp.Name, fp.CreatedAt, fp.UpdatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, fp)
}

func (h *Handler) GetFloorPlan(w http.ResponseWriter, r *http.Request) {
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

	// Check if user can view this floor plan
	canView, err := h.canViewFloorPlan(r.Context(), userID, fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canView {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	var fp models.FloorPlan
	var orgName *string
	err = h.pool.QueryRow(r.Context(),
		`SELECT fp.id, fp.user_id, fp.name, fp.organization_id, fp.created_at, fp.updated_at, o.name
		 FROM floor_plans fp
		 LEFT JOIN organizations o ON fp.organization_id = o.id
		 WHERE fp.id = $1`,
		fpID,
	).Scan(&fp.ID, &fp.UserID, &fp.Name, &fp.OrganizationID, &fp.CreatedAt, &fp.UpdatedAt, &orgName)
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

	// Check lock status
	lock, err := h.getLockStatus(r.Context(), fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	result := models.FloorPlanFull{
		FloorPlan:        fp,
		Tables:           tables,
		Guests:           guests,
		Labels:           labels,
		Lock:             lock,
		OrganizationName: orgName,
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) UpdateFloorPlan(w http.ResponseWriter, r *http.Request) {
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

	var req models.UpdateFloorPlanRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	// Check if user can edit this floor plan
	canEdit, err := h.canEditFloorPlan(r.Context(), userID, fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canEdit {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	tag, err := h.pool.Exec(r.Context(),
		`UPDATE floor_plans SET name = $1, updated_at = NOW() WHERE id = $2`,
		req.Name, fpID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) DeleteFloorPlan(w http.ResponseWriter, r *http.Request) {
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

	// Get floor plan details to determine if it's personal or org-shared
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

	// Personal plan: only creator can delete (hard delete)
	if orgID == nil {
		if creatorID != userID {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		tag, err := h.pool.Exec(r.Context(),
			`DELETE FROM floor_plans WHERE id = $1`,
			fpID,
		)
		if err != nil || tag.RowsAffected() == 0 {
			http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
		return
	}

	// Org plan: creator or org admin can "delete" (unshare, sets org_id = NULL)
	isCreator := creatorID == userID
	isOrgAdmin := false

	if !isCreator {
		role, err := h.getUserOrgRole(r.Context(), userID, *orgID)
		if err != nil {
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}
		isOrgAdmin = role == models.RoleAdmin || role == models.RoleOwner
	}

	if !isCreator && !isOrgAdmin {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Unshare the floor plan (make it personal again)
	tag, err := h.pool.Exec(r.Context(),
		`UPDATE floor_plans SET organization_id = NULL WHERE id = $1`,
		fpID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "unshared"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// getLockStatus returns the lock status for a floor plan
func (h *Handler) getLockStatus(ctx context.Context, fpID uuid.UUID) (*models.FloorPlanLock, error) {
	return h.getLockStatusImpl(fpID)
}
