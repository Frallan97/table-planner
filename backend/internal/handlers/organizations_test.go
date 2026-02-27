package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/frallan97/table-planner-backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestListOrganizations(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name       string
		mockQuery  func(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
		wantStatus int
	}{
		{
			name: "success",
			mockQuery: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				// Return empty rows for simplicity
				return &mockRows{}, nil
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "database error",
			mockQuery: func(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
				return nil, errors.New("db error")
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{queryFunc: tt.mockQuery},
			}

			req := httptest.NewRequest(http.MethodGet, "/api/organizations", nil)
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			h.ListOrganizations(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestCreateOrganization(t *testing.T) {
	userID := uuid.New()
	orgID := uuid.New()

	tests := []struct {
		name       string
		body       models.CreateOrganizationRequest
		mockBegin  func(ctx context.Context) (pgx.Tx, error)
		wantStatus int
	}{
		{
			name: "success",
			body: models.CreateOrganizationRequest{Name: "Test Org"},
			mockBegin: func(ctx context.Context) (pgx.Tx, error) {
				return &mockTx{
					queryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
						return &mockRow{
							scanFunc: func(dest ...any) error {
								// Populate returned org fields
								if idPtr, ok := dest[0].(*uuid.UUID); ok {
									*idPtr = orgID
								}
								if namePtr, ok := dest[1].(*string); ok {
									*namePtr = "Test Org"
								}
								return nil
							},
						}
					},
					execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
						return pgconn.NewCommandTag("INSERT 1"), nil
					},
					commitFunc: func(ctx context.Context) error {
						return nil
					},
				}, nil
			},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "invalid request",
			body:       models.CreateOrganizationRequest{Name: ""},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{beginFunc: tt.mockBegin},
			}

			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/api/organizations", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			h.CreateOrganization(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestDeleteOrganization(t *testing.T) {
	userID := uuid.New()
	orgID := uuid.New()

	tests := []struct {
		name          string
		mockQueryRow  func(ctx context.Context, sql string, args ...any) pgx.Row
		mockBegin     func(ctx context.Context) (pgx.Tx, error)
		wantStatus    int
	}{
		{
			name: "success - owner can delete",
			mockQueryRow: func(ctx context.Context, sql string, args ...any) pgx.Row {
				return &mockRow{
					scanFunc: func(dest ...any) error {
						if rolePtr, ok := dest[0].(*string); ok {
							*rolePtr = models.RoleOwner
						}
						return nil
					},
				}
			},
			mockBegin: func(ctx context.Context) (pgx.Tx, error) {
				return &mockTx{
					execFunc: func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
						return pgconn.NewCommandTag("DELETE 1"), nil
					},
					commitFunc: func(ctx context.Context) error {
						return nil
					},
				}, nil
			},
			wantStatus: http.StatusNoContent,
		},
		{
			name: "forbidden - non-owner cannot delete",
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
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				pool: &mockDB{
					queryRowFunc: tt.mockQueryRow,
					beginFunc:    tt.mockBegin,
				},
			}

			req := httptest.NewRequest(http.MethodDelete, "/api/organizations/"+orgID.String(), nil)
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", orgID.String())
			ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
			ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			h.DeleteOrganization(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

// mockRows implements pgx.Rows for testing
type mockRows struct {
	rows [][]any
	idx  int
}

func (m *mockRows) Next() bool {
	m.idx++
	return m.idx < len(m.rows)
}

func (m *mockRows) Scan(dest ...any) error {
	if m.idx >= len(m.rows) {
		return errors.New("no rows")
	}
	row := m.rows[m.idx]
	for i, d := range dest {
		if i < len(row) {
			// Simple assignment - in real tests you'd handle type conversions
			switch v := d.(type) {
			case *string:
				*v = row[i].(string)
			case *uuid.UUID:
				*v = row[i].(uuid.UUID)
			}
		}
	}
	return nil
}

func (m *mockRows) Err() error {
	return nil
}

func (m *mockRows) Close() {}

func (m *mockRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}

func (m *mockRows) RawValues() [][]byte {
	return nil
}

func (m *mockRows) CommandTag() pgconn.CommandTag {
	return pgconn.CommandTag{}
}

func (m *mockRows) Conn() *pgx.Conn {
	return nil
}

func (m *mockRows) Values() ([]any, error) {
	return nil, nil
}

// mockTx implements pgx.Tx for testing
type mockTx struct {
	queryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
	execFunc     func(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	commitFunc   func(ctx context.Context) error
	rollbackFunc func(ctx context.Context) error
}

func (m *mockTx) Begin(ctx context.Context) (pgx.Tx, error) {
	return nil, errors.New("nested transactions not supported")
}

func (m *mockTx) Commit(ctx context.Context) error {
	if m.commitFunc != nil {
		return m.commitFunc(ctx)
	}
	return nil
}

func (m *mockTx) Rollback(ctx context.Context) error {
	if m.rollbackFunc != nil {
		return m.rollbackFunc(ctx)
	}
	return nil
}

func (m *mockTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	if m.execFunc != nil {
		return m.execFunc(ctx, sql, args...)
	}
	return pgconn.NewCommandTag(""), nil
}

func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, errors.New("query not implemented")
}

func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
	return &mockRow{err: errors.New("query row not implemented")}
}

func (m *mockTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults {
	return nil
}

func (m *mockTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, errors.New("not implemented")
}

func (m *mockTx) LargeObjects() pgx.LargeObjects {
	return pgx.LargeObjects{}
}

func (m *mockTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, errors.New("not implemented")
}

func (m *mockTx) Conn() *pgx.Conn {
	return nil
}
