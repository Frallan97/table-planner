package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCreateFloorPlanRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     CreateFloorPlanRequest
		wantErr bool
	}{
		{"empty name is ok", CreateFloorPlanRequest{Name: ""}, false},
		{"normal name", CreateFloorPlanRequest{Name: "My Plan"}, false},
		{"max length", CreateFloorPlanRequest{Name: strings.Repeat("a", 200)}, false},
		{"too long", CreateFloorPlanRequest{Name: strings.Repeat("a", 201)}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestUpdateFloorPlanRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     UpdateFloorPlanRequest
		wantErr bool
	}{
		{"empty name", UpdateFloorPlanRequest{Name: ""}, true},
		{"normal name", UpdateFloorPlanRequest{Name: "My Plan"}, false},
		{"max length", UpdateFloorPlanRequest{Name: strings.Repeat("a", 200)}, false},
		{"too long", UpdateFloorPlanRequest{Name: strings.Repeat("a", 201)}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBulkSaveRequest_Validate(t *testing.T) {
	makeItems := func(n int) []json.RawMessage {
		items := make([]json.RawMessage, n)
		for i := range items {
			items[i] = json.RawMessage(`{}`)
		}
		return items
	}

	tests := []struct {
		name    string
		req     BulkSaveRequest
		wantErr bool
	}{
		{"empty request", BulkSaveRequest{}, false},
		{"within limits", BulkSaveRequest{
			Tables: makeItems(100),
			Guests: makeItems(100),
			Labels: makeItems(50),
		}, false},
		{"at limit", BulkSaveRequest{
			Tables: makeItems(500),
			Guests: makeItems(500),
			Labels: makeItems(500),
		}, false},
		{"tables too many", BulkSaveRequest{
			Tables: makeItems(501),
		}, true},
		{"guests too many", BulkSaveRequest{
			Guests: makeItems(501),
		}, true},
		{"labels too many", BulkSaveRequest{
			Labels: makeItems(501),
		}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
