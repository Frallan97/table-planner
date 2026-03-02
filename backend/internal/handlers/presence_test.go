package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestSendPresenceHeartbeat_Unauthorized(t *testing.T) {
	h := New(&mockDB{})

	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans/abc/presence", nil)
	w := httptest.NewRecorder()
	h.SendPresenceHeartbeat(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestSendPresenceHeartbeat_Success(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	h := New(&mockDB{
		// canViewFloorPlan uses queryRow → return creator = userID
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if p, ok := dest[0].(*uuid.UUID); ok {
						*p = userID
					}
					return nil
				},
			}
		},
		// Upsert presence uses Exec
		execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			return pgconn.NewCommandTag("INSERT 1"), nil
		},
		// getActivePresence uses Query → return empty rows (no other editors)
		queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
			return &mockRows{}, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans/"+fpID.String()+"/presence", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", fpID.String())
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.SendPresenceHeartbeat(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetPresence_Success(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	h := New(&mockDB{
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if p, ok := dest[0].(*uuid.UUID); ok {
						*p = userID
					}
					return nil
				},
			}
		},
		queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
			return &mockRows{}, nil
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/floor-plans/"+fpID.String()+"/presence", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", fpID.String())
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.GetPresence(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
