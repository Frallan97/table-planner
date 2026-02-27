package handlers

import (
	"context"
	"errors"
	"testing"

	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestGetUserOrgRole(t *testing.T) {
	userID := uuid.New()
	orgID := uuid.New()

	tests := []struct {
		name         string
		mockQueryRow func(ctx context.Context, sql string, args ...any) pgx.Row
		wantRole     string
		wantErr      bool
	}{
		{
			name: "user has role",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if rolePtr, ok := dest[0].(*string); ok {
							*rolePtr = models.RoleAdmin
						}
						return nil
					},
				}
			},
			wantRole: models.RoleAdmin,
			wantErr:  false,
		},
		{
			name: "user not a member",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{err: pgx.ErrNoRows}
			},
			wantRole: "",
			wantErr:  false,
		},
		{
			name: "database error",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{err: errors.New("db error")}
			},
			wantRole: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{queryRowFunc: tt.mockQueryRow},
			}

			role, err := h.getUserOrgRole(context.Background(), userID, orgID)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
			if role != tt.wantRole {
				t.Errorf("got role %s, want %s", role, tt.wantRole)
			}
		})
	}
}

func TestCanAccessOrganization(t *testing.T) {
	userID := uuid.New()
	orgID := uuid.New()

	tests := []struct {
		name         string
		mockQueryRow func(ctx context.Context, sql string, args ...any) pgx.Row
		wantAccess   bool
		wantErr      bool
	}{
		{
			name: "user is member",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if rolePtr, ok := dest[0].(*string); ok {
							*rolePtr = models.RoleMember
						}
						return nil
					},
				}
			},
			wantAccess: true,
			wantErr:    false,
		},
		{
			name: "user is not member",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{err: pgx.ErrNoRows}
			},
			wantAccess: false,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{queryRowFunc: tt.mockQueryRow},
			}

			canAccess, err := h.canAccessOrganization(context.Background(), userID, orgID)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
			if canAccess != tt.wantAccess {
				t.Errorf("got access %v, want %v", canAccess, tt.wantAccess)
			}
		})
	}
}

func TestCanEditFloorPlan(t *testing.T) {
	creatorID := uuid.New()
	otherUserID := uuid.New()
	fpID := uuid.New()
	_ = uuid.New() // orgID not used in simplified test

	tests := []struct {
		name         string
		userID       uuid.UUID
		mockQueryRow func(ctx context.Context, sql string, args ...any) pgx.Row
		wantEdit     bool
		wantErr      bool
	}{
		{
			name:   "creator can always edit",
			userID: creatorID,
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				// First call: get floor plan details
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if creatorPtr, ok := dest[0].(*uuid.UUID); ok {
							*creatorPtr = creatorID
						}
						// Skip orgPtr for simplified test
						return nil
					},
				}
			},
			wantEdit: true,
			wantErr:  false,
		},
		{
			name:   "non-creator cannot edit personal plan",
			userID: otherUserID,
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if creatorPtr, ok := dest[0].(*uuid.UUID); ok {
							*creatorPtr = creatorID
						}
						return nil
					},
				}
			},
			wantEdit: false,
			wantErr:  false,
		},
		// Note: Testing org plan editing requires more complex mocking
		// Skipping for now as it requires multiple query responses
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{queryRowFunc: tt.mockQueryRow},
			}

			canEdit, err := h.canEditFloorPlan(context.Background(), tt.userID, fpID)
			if (err != nil) != tt.wantErr {
				t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
			}
			if canEdit != tt.wantEdit {
				t.Errorf("got edit permission %v, want %v", canEdit, tt.wantEdit)
			}
		})
	}
}
