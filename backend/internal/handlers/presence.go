package handlers

import (
	"context"
	"net/http"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// SendPresenceHeartbeat upserts the caller's presence row and returns other active editors.
func (h *Handler) SendPresenceHeartbeat(w http.ResponseWriter, r *http.Request) {
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

	canView, err := h.canViewFloorPlan(r.Context(), userID, fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canView {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	// Get user email from JWT claims
	email := ""
	if claims, _ := middleware.GetUserClaims(r.Context()); claims != nil {
		email = claims.Email
	}

	// Upsert presence
	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO floor_plan_presence (floor_plan_id, user_id, user_email, last_seen_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (floor_plan_id, user_id)
		 DO UPDATE SET user_email = EXCLUDED.user_email, last_seen_at = NOW()`,
		fpID, userID, email,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	others, err := h.getActivePresence(r.Context(), fpID, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, others)
}

// GetPresence returns the list of other active editors (read-only, no upsert).
func (h *Handler) GetPresence(w http.ResponseWriter, r *http.Request) {
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

	canView, err := h.canViewFloorPlan(r.Context(), userID, fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if !canView {
		http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		return
	}

	others, err := h.getActivePresence(r.Context(), fpID, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, others)
}

// getActivePresence returns presence rows active within the last 2 minutes, excluding excludeUserID.
func (h *Handler) getActivePresence(ctx context.Context, fpID uuid.UUID, excludeUserID uuid.UUID) ([]models.FloorPlanPresence, error) {
	rows, err := h.pool.Query(ctx,
		`SELECT floor_plan_id, user_id, user_email, last_seen_at
		 FROM floor_plan_presence
		 WHERE floor_plan_id = $1
		   AND user_id != $2
		   AND last_seen_at > NOW() - INTERVAL '2 minutes'`,
		fpID, excludeUserID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.FloorPlanPresence{}
	for rows.Next() {
		var p models.FloorPlanPresence
		if err := rows.Scan(&p.FloorPlanID, &p.UserID, &p.UserEmail, &p.LastSeenAt); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, nil
}
