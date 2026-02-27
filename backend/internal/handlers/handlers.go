package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const maxBodySize = 5 * 1024 * 1024 // 5 MB

// DB abstracts the database operations needed by handlers.
// *pgxpool.Pool satisfies this interface.
type DB interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Begin(ctx context.Context) (pgx.Tx, error)
}

type Handler struct {
	pool DB
}

func New(pool DB) *Handler {
	return &Handler{pool: pool}
}

func decodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodySize)
	dec := json.NewDecoder(r.Body)
	return dec.Decode(dst)
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}
