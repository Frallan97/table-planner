package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ListOrgMembers returns all members of an organization with their roles.
func (h *Handler) ListOrgMembers(w http.ResponseWriter, r *http.Request) {
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

	// Get all members (we'll need to join with users table when it exists)
	// For now, just return organization_members data
	query := `
		SELECT organization_id, user_id, role, joined_at
		FROM organization_members
		WHERE organization_id = $1
		ORDER BY joined_at ASC
	`

	rows, err := h.pool.Query(r.Context(), query, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []models.OrganizationMember{}
	for rows.Next() {
		var member models.OrganizationMember
		err := rows.Scan(
			&member.OrganizationID,
			&member.UserID,
			&member.Role,
			&member.JoinedAt,
		)
		if err != nil {
			http.Error(w, `{"error":"scan error"}`, http.StatusInternalServerError)
			return
		}
		// Email will be empty for now - would need users table to populate
		members = append(members, member)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"rows error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, members)
}

// InviteMember creates an invitation to join the organization (owner/admin only).
func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
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

	var req models.InviteMemberRequest
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

	// Generate crypto-random token
	token, err := generateToken(32)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	// Create invitation with 7-day expiration
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	query := `
		INSERT INTO organization_invitations (organization_id, email, role, token, invited_by, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), $6)
		RETURNING id, organization_id, email, role, token, invited_by, created_at, expires_at
	`

	var invitation models.OrganizationInvitation
	err = h.pool.QueryRow(r.Context(), query, orgID, req.Email, req.Role, token, userID, expiresAt).Scan(
		&invitation.ID,
		&invitation.OrganizationID,
		&invitation.Email,
		&invitation.Role,
		&invitation.Token,
		&invitation.InvitedBy,
		&invitation.CreatedAt,
		&invitation.ExpiresAt,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to create invitation"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, invitation)
}

// RemoveMember removes a member from the organization (owner/admin only, cannot remove owner).
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
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

	memberIDStr := chi.URLParam(r, "memberId")
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid member ID"}`, http.StatusBadRequest)
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

	// Check if member being removed is owner
	memberRole, err := h.getUserOrgRole(r.Context(), memberID, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if memberRole == models.RoleOwner {
		http.Error(w, `{"error":"cannot remove owner"}`, http.StatusBadRequest)
		return
	}

	// Remove member
	query := `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`
	result, err := h.pool.Exec(r.Context(), query, orgID, memberID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, `{"error":"member not found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateMemberRole changes a member's role (owner/admin only).
func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
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

	memberIDStr := chi.URLParam(r, "memberId")
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid member ID"}`, http.StatusBadRequest)
		return
	}

	var req models.UpdateMemberRoleRequest
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

	// Cannot change owner role (prevent accidentally losing ownership)
	currentRole, err := h.getUserOrgRole(r.Context(), memberID, orgID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if currentRole == models.RoleOwner && req.Role != models.RoleOwner {
		http.Error(w, `{"error":"cannot change owner role"}`, http.StatusBadRequest)
		return
	}

	// Update role
	query := `
		UPDATE organization_members
		SET role = $1
		WHERE organization_id = $2 AND user_id = $3
		RETURNING organization_id, user_id, role, joined_at
	`

	var member models.OrganizationMember
	err = h.pool.QueryRow(r.Context(), query, req.Role, orgID, memberID).Scan(
		&member.OrganizationID,
		&member.UserID,
		&member.Role,
		&member.JoinedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"member not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, member)
}

// AcceptInvitation accepts an invitation and adds the user to the organization.
func (h *Handler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	token := chi.URLParam(r, "token")
	if token == "" {
		http.Error(w, `{"error":"missing token"}`, http.StatusBadRequest)
		return
	}

	// Use transaction to ensure invitation is deleted and member is added
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		http.Error(w, `{"error":"transaction error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	// Get and validate invitation
	var invitation models.OrganizationInvitation
	invQuery := `
		SELECT id, organization_id, email, role, token, invited_by, created_at, expires_at
		FROM organization_invitations
		WHERE token = $1
	`
	err = tx.QueryRow(r.Context(), invQuery, token).Scan(
		&invitation.ID,
		&invitation.OrganizationID,
		&invitation.Email,
		&invitation.Role,
		&invitation.Token,
		&invitation.InvitedBy,
		&invitation.CreatedAt,
		&invitation.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, `{"error":"invitation not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Check if invitation has expired
	if time.Now().After(invitation.ExpiresAt) {
		http.Error(w, `{"error":"invitation expired"}`, http.StatusBadRequest)
		return
	}

	// Add user to organization
	memberQuery := `
		INSERT INTO organization_members (organization_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (organization_id, user_id) DO NOTHING
		RETURNING organization_id, user_id, role, joined_at
	`
	var member models.OrganizationMember
	err = tx.QueryRow(r.Context(), memberQuery, invitation.OrganizationID, userID, invitation.Role).Scan(
		&member.OrganizationID,
		&member.UserID,
		&member.Role,
		&member.JoinedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// User is already a member - return success anyway
		if err := tx.Commit(r.Context()); err != nil {
			http.Error(w, `{"error":"commit error"}`, http.StatusInternalServerError)
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"message": "already a member"})
		return
	}
	if err != nil {
		http.Error(w, `{"error":"failed to add member"}`, http.StatusInternalServerError)
		return
	}

	// Delete invitation after successful acceptance
	deleteQuery := `DELETE FROM organization_invitations WHERE id = $1`
	_, err = tx.Exec(r.Context(), deleteQuery, invitation.ID)
	if err != nil {
		http.Error(w, `{"error":"failed to delete invitation"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, `{"error":"commit error"}`, http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, member)
}

// generateToken generates a cryptographically secure random token.
func generateToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}
