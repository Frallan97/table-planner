package models

import (
	"encoding/json"
	"errors"
	"fmt"
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

func (r *CreateFloorPlanRequest) Validate() error {
	if len(r.Name) > 200 {
		return errors.New("name must be at most 200 characters")
	}
	return nil
}

type UpdateFloorPlanRequest struct {
	Name string `json:"name"`
}

func (r *UpdateFloorPlanRequest) Validate() error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	if len(r.Name) > 200 {
		return errors.New("name must be at most 200 characters")
	}
	return nil
}

type BulkSaveRequest struct {
	Tables []json.RawMessage `json:"tables"`
	Guests []json.RawMessage `json:"guests"`
	Labels []json.RawMessage `json:"labels"`
}

const maxBulkItems = 500

func (r *BulkSaveRequest) Validate() error {
	if len(r.Tables) > maxBulkItems {
		return fmt.Errorf("tables exceeds maximum of %d items", maxBulkItems)
	}
	if len(r.Guests) > maxBulkItems {
		return fmt.Errorf("guests exceeds maximum of %d items", maxBulkItems)
	}
	if len(r.Labels) > maxBulkItems {
		return fmt.Errorf("labels exceeds maximum of %d items", maxBulkItems)
	}
	return nil
}
