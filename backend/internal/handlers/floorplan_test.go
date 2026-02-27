package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func withUserID(ctx context.Context, uid uuid.UUID) context.Context {
	return context.WithValue(ctx, middleware.UserIDKey, uid)
}

func withChiParam(r *http.Request, key, val string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, val)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestCreateFloorPlan_ValidName(t *testing.T) {
	userID := uuid.New()
	var insertedName string

	db := &mockDB{
		execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			if len(args) >= 3 {
				insertedName = args[2].(string)
			}
			return pgconn.NewCommandTag("INSERT 1"), nil
		},
	}

	h := New(db)
	body := strings.NewReader(`{"name":"Wedding Reception"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	w := httptest.NewRecorder()

	h.CreateFloorPlan(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if insertedName != "Wedding Reception" {
		t.Fatalf("expected name 'Wedding Reception', got '%s'", insertedName)
	}
}

func TestCreateFloorPlan_EmptyNameGetsDefault(t *testing.T) {
	userID := uuid.New()
	var insertedName string

	db := &mockDB{
		execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			if len(args) >= 3 {
				insertedName = args[2].(string)
			}
			return pgconn.NewCommandTag("INSERT 1"), nil
		},
	}

	h := New(db)
	body := strings.NewReader(`{}`)
	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	w := httptest.NewRecorder()

	h.CreateFloorPlan(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	if insertedName != "Untitled Floor Plan" {
		t.Fatalf("expected default name, got '%s'", insertedName)
	}
}

func TestCreateFloorPlan_NameTooLong(t *testing.T) {
	userID := uuid.New()
	db := &mockDB{}

	h := New(db)
	longName := strings.Repeat("x", 201)
	body := strings.NewReader(`{"name":"` + longName + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	w := httptest.NewRecorder()

	h.CreateFloorPlan(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestCreateFloorPlan_Unauthorized(t *testing.T) {
	db := &mockDB{}
	h := New(db)

	body := strings.NewReader(`{"name":"Test"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/floor-plans", body)
	w := httptest.NewRecorder()

	h.CreateFloorPlan(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestListFloorPlans_Empty(t *testing.T) {
	userID := uuid.New()

	db := &mockDB{
		queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
			return &emptyRows{}, nil
		},
	}

	h := New(db)
	req := httptest.NewRequest(http.MethodGet, "/api/floor-plans", nil)
	req = req.WithContext(withUserID(req.Context(), userID))
	w := httptest.NewRecorder()

	h.ListFloorPlans(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var plans []json.RawMessage
	if err := json.NewDecoder(w.Body).Decode(&plans); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(plans) != 0 {
		t.Fatalf("expected empty list, got %d items", len(plans))
	}
}

func TestGetFloorPlan_NotFound(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	db := &mockDB{
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &mockRow{err: pgx.ErrNoRows}
		},
	}

	h := New(db)
	req := httptest.NewRequest(http.MethodGet, "/api/floor-plans/"+fpID.String(), nil)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", fpID.String())
	w := httptest.NewRecorder()

	h.GetFloorPlan(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestUpdateFloorPlan_InvalidID(t *testing.T) {
	userID := uuid.New()
	db := &mockDB{}

	h := New(db)
	body := strings.NewReader(`{"name":"New Name"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/not-a-uuid", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", "not-a-uuid")
	w := httptest.NewRecorder()

	h.UpdateFloorPlan(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestDeleteFloorPlan_Success(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	db := &mockDB{
		execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
			return pgconn.NewCommandTag("DELETE 1"), nil
		},
	}

	h := New(db)
	req := httptest.NewRequest(http.MethodDelete, "/api/floor-plans/"+fpID.String(), nil)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", fpID.String())
	w := httptest.NewRecorder()

	h.DeleteFloorPlan(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// emptyRows implements pgx.Rows returning zero results.
type emptyRows struct{}

func (r *emptyRows) Close()                                         {}
func (r *emptyRows) Err() error                                     { return nil }
func (r *emptyRows) CommandTag() pgconn.CommandTag                   { return pgconn.NewCommandTag("") }
func (r *emptyRows) FieldDescriptions() []pgconn.FieldDescription   { return nil }
func (r *emptyRows) Next() bool                                     { return false }
func (r *emptyRows) Scan(dest ...any) error                         { return nil }
func (r *emptyRows) Values() ([]any, error)                         { return nil, nil }
func (r *emptyRows) RawValues() [][]byte                            { return nil }
func (r *emptyRows) Conn() *pgx.Conn                                { return nil }

// Satisfy the full pgx.Rows interface — these are no-ops for empty rows.
var _ pgx.Rows = (*emptyRows)(nil)

// timeFormat for test helpers
var _ = time.Now
