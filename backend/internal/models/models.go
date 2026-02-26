package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type FloorPlan struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"userId"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type FloorPlanFull struct {
	FloorPlan
	Tables []json.RawMessage `json:"tables"`
	Guests []json.RawMessage `json:"guests"`
	Labels []json.RawMessage `json:"labels"`
}

type CreateFloorPlanRequest struct {
	Name string `json:"name"`
}

type UpdateFloorPlanRequest struct {
	Name string `json:"name"`
}

type BulkSaveRequest struct {
	Tables []json.RawMessage `json:"tables"`
	Guests []json.RawMessage `json:"guests"`
	Labels []json.RawMessage `json:"labels"`
}
