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
	"github.com/jackc/pgx/v5"
)

// allowedTables whitelists table names to prevent SQL injection in dynamic queries.
var allowedTables = map[string]bool{
	"floor_plan_tables": true,
	"floor_plan_guests": true,
	"floor_plan_labels": true,
}

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

	var req models.BulkSaveRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if err := req.Validate(); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// Upsert each entity type
	if err := upsertEntities(r.Context(), tx, "floor_plan_tables", fpID, req.Tables); err != nil {
		http.Error(w, `{"error":"failed to save tables"}`, http.StatusInternalServerError)
		return
	}
	if err := upsertEntities(r.Context(), tx, "floor_plan_guests", fpID, req.Guests); err != nil {
		http.Error(w, `{"error":"failed to save guests"}`, http.StatusInternalServerError)
		return
	}
	if err := upsertEntities(r.Context(), tx, "floor_plan_labels", fpID, req.Labels); err != nil {
		http.Error(w, `{"error":"failed to save labels"}`, http.StatusInternalServerError)
		return
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

// upsertEntities deletes rows not in the incoming set, then upserts the rest.
func upsertEntities(ctx context.Context, tx pgx.Tx, tableName string, fpID uuid.UUID, items []json.RawMessage) error {
	if !allowedTables[tableName] {
		return fmt.Errorf("invalid table name: %s", tableName)
	}

	// Collect IDs from incoming items
	incomingIDs := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		incomingIDs = append(incomingIDs, extractID(item))
	}

	// Delete rows whose IDs are not in the incoming set
	if len(incomingIDs) > 0 {
		_, err := tx.Exec(ctx,
			fmt.Sprintf(`DELETE FROM %s WHERE floor_plan_id = $1 AND id != ALL($2)`, tableName),
			fpID, incomingIDs,
		)
		if err != nil {
			return err
		}
	} else {
		// No items: delete everything
		_, err := tx.Exec(ctx,
			fmt.Sprintf(`DELETE FROM %s WHERE floor_plan_id = $1`, tableName),
			fpID,
		)
		if err != nil {
			return err
		}
	}

	// Upsert each item
	for i, item := range items {
		id := incomingIDs[i]
		_, err := tx.Exec(ctx,
			fmt.Sprintf(`INSERT INTO %s (id, floor_plan_id, data) VALUES ($1, $2, $3)
				ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, tableName),
			id, fpID, item,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (h *Handler) getEntityData(ctx context.Context, table string, floorPlanID uuid.UUID) ([]json.RawMessage, error) {
	if !allowedTables[table] {
		return nil, fmt.Errorf("invalid table name: %s", table)
	}

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
