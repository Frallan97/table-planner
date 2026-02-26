package handlers

import (
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

	rows, err := h.pool.Query(r.Context(),
		`SELECT id, user_id, name, created_at, updated_at FROM floor_plans WHERE user_id = $1 ORDER BY updated_at DESC`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	plans := []models.FloorPlan{}
	for rows.Next() {
		var fp models.FloorPlan
		if err := rows.Scan(&fp.ID, &fp.UserID, &fp.Name, &fp.CreatedAt, &fp.UpdatedAt); err != nil {
			http.Error(w, `{"error":"scan error"}`, http.StatusInternalServerError)
			return
		}
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
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

	var fp models.FloorPlan
	err = h.pool.QueryRow(r.Context(),
		`SELECT id, user_id, name, created_at, updated_at FROM floor_plans WHERE id = $1 AND user_id = $2`,
		fpID, userID,
	).Scan(&fp.ID, &fp.UserID, &fp.Name, &fp.CreatedAt, &fp.UpdatedAt)
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

	result := models.FloorPlanFull{
		FloorPlan: fp,
		Tables:    tables,
		Guests:    guests,
		Labels:    labels,
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	tag, err := h.pool.Exec(r.Context(),
		`UPDATE floor_plans SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		req.Name, fpID, userID,
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

	tag, err := h.pool.Exec(r.Context(),
		`DELETE FROM floor_plans WHERE id = $1 AND user_id = $2`,
		fpID, userID,
	)
	if err != nil || tag.RowsAffected() == 0 {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
