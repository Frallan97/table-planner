package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
)

// Role constants for organization members
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
	RoleViewer = "viewer"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

type FloorPlan struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"userId"`
	Name           string     `json:"name"`
	OrganizationID *uuid.UUID `json:"organizationId,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type FloorPlanLock struct {
	FloorPlanID uuid.UUID `json:"floorPlanId"`
	UserID      uuid.UUID `json:"userId"`
	UserEmail   string    `json:"userEmail,omitempty"`
	LockedAt    time.Time `json:"lockedAt"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

type FloorPlanFull struct {
	FloorPlan
	Tables         []json.RawMessage `json:"tables"`
	Guests         []json.RawMessage `json:"guests"`
	Labels         []json.RawMessage `json:"labels"`
	Lock           *FloorPlanLock    `json:"lock,omitempty"`
	OrganizationName *string         `json:"organizationName,omitempty"`
}

type FloorPlanWithOrg struct {
	FloorPlan
	OrganizationName *string `json:"organizationName,omitempty"`
	IsPersonal       bool    `json:"isPersonal"`
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

// Organization models

type Organization struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedBy uuid.UUID `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type OrganizationWithRole struct {
	Organization
	Role string `json:"role"`
}

type OrganizationMember struct {
	OrganizationID uuid.UUID `json:"organizationId"`
	UserID         uuid.UUID `json:"userId"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	JoinedAt       time.Time `json:"joinedAt"`
}

type OrganizationInvitation struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organizationId"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Token          string    `json:"token"`
	InvitedBy      uuid.UUID `json:"invitedBy"`
	CreatedAt      time.Time `json:"createdAt"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

// Request types

type CreateOrganizationRequest struct {
	Name string `json:"name"`
}

func (r *CreateOrganizationRequest) Validate() error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	if len(r.Name) < 1 || len(r.Name) > 100 {
		return errors.New("name must be between 1 and 100 characters")
	}
	return nil
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
}

func (r *UpdateOrganizationRequest) Validate() error {
	if r.Name == "" {
		return errors.New("name is required")
	}
	if len(r.Name) < 1 || len(r.Name) > 100 {
		return errors.New("name must be between 1 and 100 characters")
	}
	return nil
}

type InviteMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (r *InviteMemberRequest) Validate() error {
	if r.Email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(r.Email) {
		return errors.New("invalid email format")
	}
	if len(r.Email) > 255 {
		return errors.New("email must be at most 255 characters")
	}
	if r.Role != RoleAdmin && r.Role != RoleMember && r.Role != RoleViewer {
		return errors.New("role must be admin, member, or viewer")
	}
	return nil
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

func (r *UpdateMemberRoleRequest) Validate() error {
	if r.Role != RoleOwner && r.Role != RoleAdmin && r.Role != RoleMember && r.Role != RoleViewer {
		return errors.New("role must be owner, admin, member, or viewer")
	}
	return nil
}

type ShareFloorPlanRequest struct {
	OrganizationID uuid.UUID `json:"organizationId"`
}

func (r *ShareFloorPlanRequest) Validate() error {
	if r.OrganizationID == uuid.Nil {
		return errors.New("organizationId is required")
	}
	return nil
}
