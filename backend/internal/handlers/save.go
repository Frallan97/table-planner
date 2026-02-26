package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) BulkSave(w http.ResponseWriter, r *http.Request) {
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

	// Verify ownership
	var ownerID uuid.UUID
	err = h.pool.QueryRow(r.Context(),
		`SELECT user_id FROM floor_plans WHERE id = $1`, fpID,
	).Scan(&ownerID)
	if err != nil || ownerID != userID {
		http.Error(w, `{"error":"floor plan not found"}`, http.StatusNotFound)
		return
	}

	var req models.BulkSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// Clear existing data for this floor plan
	for _, table := range []string{"floor_plan_tables", "floor_plan_guests", "floor_plan_labels"} {
		if _, err := tx.Exec(r.Context(), fmt.Sprintf(`DELETE FROM %s WHERE floor_plan_id = $1`, table), fpID); err != nil {
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}
	}

	// Insert tables
	for _, item := range req.Tables {
		id := extractID(item)
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO floor_plan_tables (id, floor_plan_id, data) VALUES ($1, $2, $3)`,
			id, fpID, item,
		); err != nil {
			http.Error(w, `{"error":"failed to save tables"}`, http.StatusInternalServerError)
			return
		}
	}

	// Insert guests
	for _, item := range req.Guests {
		id := extractID(item)
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO floor_plan_guests (id, floor_plan_id, data) VALUES ($1, $2, $3)`,
			id, fpID, item,
		); err != nil {
			http.Error(w, `{"error":"failed to save guests"}`, http.StatusInternalServerError)
			return
		}
	}

	// Insert labels
	for _, item := range req.Labels {
		id := extractID(item)
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO floor_plan_labels (id, floor_plan_id, data) VALUES ($1, $2, $3)`,
			id, fpID, item,
		); err != nil {
			http.Error(w, `{"error":"failed to save labels"}`, http.StatusInternalServerError)
			return
		}
	}

	// Update the floor plan timestamp
	if _, err := tx.Exec(r.Context(),
		`UPDATE floor_plans SET updated_at = NOW() WHERE id = $1`, fpID,
	); err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"failed to commit"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (h *Handler) getEntityData(ctx context.Context, table string, floorPlanID uuid.UUID) ([]json.RawMessage, error) {
	rows, err := h.pool.Query(ctx,
		fmt.Sprintf(`SELECT data FROM %s WHERE floor_plan_id = $1`, table),
		floorPlanID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []json.RawMessage{}
	for rows.Next() {
		var data json.RawMessage
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		result = append(result, data)
	}
	return result, nil
}

func extractID(raw json.RawMessage) uuid.UUID {
	var obj struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil {
		if id, err := uuid.Parse(obj.ID); err == nil {
			return id
		}
	}
	return uuid.New()
}
