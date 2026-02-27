package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/frallan97/table-planner-backend/internal/config"
	"github.com/frallan97/table-planner-backend/internal/database"
	"github.com/frallan97/table-planner-backend/internal/handlers"
	"github.com/frallan97/table-planner-backend/internal/middleware"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Println("Running database migrations...")
	if err := database.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	authMW, err := middleware.NewAuthMiddleware(cfg.AuthServiceURL)
	if err != nil {
		log.Fatalf("Failed to initialize auth middleware: %v", err)
	}
	go authMW.StartKeyRefresh(1 * time.Hour)

	h := handlers.New(pool)

	r := chi.NewRouter()

	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	rl := middleware.NewRateLimiter(10, 20) // 10 req/s, burst 20

	r.Route("/api", func(r chi.Router) {
		r.Use(authMW.Authenticate)
		r.Use(rl.Middleware)

		r.Route("/floor-plans", func(r chi.Router) {
			r.Get("/", h.ListFloorPlans)
			r.Post("/", h.CreateFloorPlan)
			r.Get("/{id}", h.GetFloorPlan)
			r.Put("/{id}", h.UpdateFloorPlan)
			r.Delete("/{id}", h.DeleteFloorPlan)
			r.Put("/{id}/save", h.BulkSave)

			// Share/unshare endpoints
			r.Post("/{id}/share", h.ShareFloorPlan)
			r.Post("/{id}/unshare", h.UnshareFloorPlan)

			// Lock endpoints
			r.Post("/{id}/lock", h.AcquireLock)
			r.Delete("/{id}/lock", h.ReleaseLock)
			r.Put("/{id}/lock/heartbeat", h.RefreshLock)
			r.Get("/{id}/lock/status", h.GetLockStatusHandler)
		})

		r.Route("/organizations", func(r chi.Router) {
			r.Get("/", h.ListOrganizations)
			r.Post("/", h.CreateOrganization)
			r.Get("/{id}", h.GetOrganization)
			r.Put("/{id}", h.UpdateOrganization)
			r.Delete("/{id}", h.DeleteOrganization)

			// Member management
			r.Get("/{id}/members", h.ListOrgMembers)
			r.Post("/{id}/members/invite", h.InviteMember)
			r.Delete("/{id}/members/{memberId}", h.RemoveMember)
			r.Put("/{id}/members/{memberId}", h.UpdateMemberRole)
		})

		// Invitation acceptance (no org ID needed, uses token)
		r.Post("/invitations/{token}/accept", h.AcceptInvitation)
	})

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Starting table planner backend on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
