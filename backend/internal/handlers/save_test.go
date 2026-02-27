package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestBulkSave_Unauthorized(t *testing.T) {
	db := &mockDB{}
	h := New(db)

	body := strings.NewReader(`{"tables":[],"guests":[],"labels":[]}`)
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

	body := strings.NewReader(`{"tables":[],"guests":[],"labels":[]}`)
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
	items.WriteString(`{"tables":[`)
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
