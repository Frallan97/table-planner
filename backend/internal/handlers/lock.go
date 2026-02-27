package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const lockDuration = 15 * time.Minute

// AcquireLock attempts to acquire an edit lock on a floor plan.
func (h *Handler) AcquireLock(w http.ResponseWriter, r *http.Request) {
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

	// Check if floor plan is already locked by another user
	existingLock, err := h.getLockStatus(r.Context(), fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if existingLock != nil && existingLock.UserID != userID {
		// Floor plan is locked by another user
		respondJSON(w, http.StatusConflict, map[string]any{
			"error":  "floor plan is locked by another user",
			"lock":   existingLock,
		})
		return
	}

	// Acquire or refresh lock
	expiresAt := time.Now().Add(lockDuration)
	query := `
		INSERT INTO floor_plan_locks (floor_plan_id, user_id, locked_at, expires_at)
		VALUES ($1, $2, NOW(), $3)
		ON CONFLICT (floor_plan_id)
		DO UPDATE SET locked_at = NOW(), expires_at = $3
		WHERE floor_plan_locks.user_id = $2
		RETURNING floor_plan_id, user_id, locked_at, expires_at
	`

	var lock models.FloorPlanLock
	err = h.pool.QueryRow(r.Context(), query, fpID, userID, expiresAt).Scan(
		&lock.FloorPlanID,
		&lock.UserID,
		&lock.LockedAt,
		&lock.ExpiresAt,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to acquire lock"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, lock)
}

// ReleaseLock releases an edit lock on a floor plan.
func (h *Handler) ReleaseLock(w http.ResponseWriter, r *http.Request) {
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

	// Delete lock only if user owns it
	query := `DELETE FROM floor_plan_locks WHERE floor_plan_id = $1 AND user_id = $2`
	result, err := h.pool.Exec(r.Context(), query, fpID, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"lock not found or not owned by user"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RefreshLock refreshes the expiration time of a lock (heartbeat).
func (h *Handler) RefreshLock(w http.ResponseWriter, r *http.Request) {
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

	// Update expiry only if user owns the lock
	expiresAt := time.Now().Add(lockDuration)
	query := `
		UPDATE floor_plan_locks
		SET expires_at = $1, locked_at = NOW()
		WHERE floor_plan_id = $2 AND user_id = $3
		RETURNING floor_plan_id, user_id, locked_at, expires_at
	`

	var lock models.FloorPlanLock
	err = h.pool.QueryRow(r.Context(), query, expiresAt, fpID, userID).Scan(
		&lock.FloorPlanID,
		&lock.UserID,
		&lock.LockedAt,
		&lock.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"lock not found or not owned by user"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, lock)
}

// GetLockStatus returns the current lock status of a floor plan.
func (h *Handler) GetLockStatusHandler(w http.ResponseWriter, r *http.Request) {
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

	lock, err := h.getLockStatus(r.Context(), fpID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if lock == nil {
		respondJSON(w, http.StatusOK, map[string]any{"locked": false})
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"locked": true,
		"lock":   lock,
	})
}

// getLockStatus is a helper function that returns lock status for a floor plan.
// Returns nil if no active lock exists or if the lock has expired.
func (h *Handler) getLockStatusImpl(fpID uuid.UUID) (*models.FloorPlanLock, error) {
	var lock models.FloorPlanLock
	var userEmail sql.NullString

	query := `
		SELECT fpl.floor_plan_id, fpl.user_id, fpl.locked_at, fpl.expires_at
		FROM floor_plan_locks fpl
		WHERE fpl.floor_plan_id = $1 AND fpl.expires_at > NOW()
	`

	err := h.pool.QueryRow(context.Background(), query, fpID).Scan(
		&lock.FloorPlanID,
		&lock.UserID,
		&lock.LockedAt,
		&lock.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// No active lock
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if userEmail.Valid {
		lock.UserEmail = userEmail.String
	}

	return &lock, nil
}
