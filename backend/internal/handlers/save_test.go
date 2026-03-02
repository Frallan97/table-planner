package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestBulkSave_Unauthorized(t *testing.T) {
	db := &mockDB{}
	h := New(db)

	body := strings.NewReader(`{"version":1,"tables":[],"guests":[],"labels":[]}`)
	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/abc/save", body)
	w := httptest.NewRecorder()

	h.BulkSave(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestBulkSave_InvalidFloorPlanID(t *testing.T) {
	userID := uuid.New()
	db := &mockDB{}
	h := New(db)

	body := strings.NewReader(`{"version":1,"tables":[],"guests":[],"labels":[]}`)
	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/not-a-uuid/save", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", "not-a-uuid")
	w := httptest.NewRecorder()

	h.BulkSave(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestBulkSave_TooManyItems(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	db := &mockDB{
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if len(dest) > 0 {
						if p, ok := dest[0].(*uuid.UUID); ok {
							*p = userID
						}
					}
					return nil
				},
			}
		},
	}

	h := New(db)

	// Build a request with 501 tables
	var items strings.Builder
	items.WriteString(`{"version":1,"tables":[`)
	for i := 0; i < 501; i++ {
		if i > 0 {
			items.WriteString(",")
		}
		items.WriteString(`{"id":"` + uuid.New().String() + `"}`)
	}
	items.WriteString(`],"guests":[],"labels":[]}`)

	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/"+fpID.String()+"/save", strings.NewReader(items.String()))
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", fpID.String())
	w := httptest.NewRecorder()

	h.BulkSave(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBulkSave_VersionConflict(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	// Mock: canEditFloorPlan returns creator match, then tx version check returns version 5
	queryRowCallCount := 0
	db := &mockDB{
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			queryRowCallCount++
			// First call: canEditFloorPlan — return creator = userID
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if p, ok := dest[0].(*uuid.UUID); ok {
						*p = userID
					}
					return nil
				},
			}
		},
		beginFunc: func(ctx context.Context) (pgx.Tx, error) {
			return &mockTx{
				queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
					// SELECT version FROM floor_plans — return version 5
					return &mockRow{
						scanFunc: func(dest ...any) error {
							if p, ok := dest[0].(*int); ok {
								*p = 5
							}
							return nil
						},
					}
				},
			}, nil
		},
		// getEntityData uses pool.Query — return empty results for conflict response
		queryFunc: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
			return &mockRows{}, nil
		},
	}

	h := New(db)

	// Send version 3 (stale)
	body := strings.NewReader(`{"version":3,"tables":[],"guests":[],"labels":[]}`)
	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/"+fpID.String()+"/save", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", fpID.String())
	w := httptest.NewRecorder()

	h.BulkSave(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["error"] != "version conflict" {
		t.Errorf("expected error 'version conflict', got %v", resp["error"])
	}
	if int(resp["version"].(float64)) != 5 {
		t.Errorf("expected version 5, got %v", resp["version"])
	}
}

func TestBulkSave_VersionMatch(t *testing.T) {
	userID := uuid.New()
	fpID := uuid.New()

	db := &mockDB{
		queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			// canEditFloorPlan — return creator = userID
			return &mockRow{
				scanFunc: func(dest ...any) error {
					if p, ok := dest[0].(*uuid.UUID); ok {
						*p = userID
					}
					return nil
				},
			}
		},
		beginFunc: func(ctx context.Context) (pgx.Tx, error) {
			txQueryRowCount := 0
			return &mockTx{
				queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
					txQueryRowCount++
					if txQueryRowCount == 1 {
						// SELECT version — return version 3
						return &mockRow{
							scanFunc: func(dest ...any) error {
								if p, ok := dest[0].(*int); ok {
									*p = 3
								}
								return nil
							},
						}
					}
					// UPDATE RETURNING version — return version 4
					return &mockRow{
						scanFunc: func(dest ...any) error {
							if p, ok := dest[0].(*int); ok {
								*p = 4
							}
							return nil
						},
					}
				},
				execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
					return pgconn.NewCommandTag(""), nil
				},
			}, nil
		},
	}

	h := New(db)

	body := strings.NewReader(`{"version":3,"tables":[],"guests":[],"labels":[]}`)
	req := httptest.NewRequest(http.MethodPut, "/api/floor-plans/"+fpID.String()+"/save", body)
	req = req.WithContext(withUserID(req.Context(), userID))
	req = withChiParam(req, "id", fpID.String())
	w := httptest.NewRecorder()

	h.BulkSave(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["status"] != "saved" {
		t.Errorf("expected status 'saved', got %v", resp["status"])
	}
	if int(resp["version"].(float64)) != 4 {
		t.Errorf("expected version 4, got %v", resp["version"])
	}
}
