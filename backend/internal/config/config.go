package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	AuthServiceURL string
	AllowedOrigins []string
	Env            string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:           getEnv("PORT", "8082"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://tableplanner:tableplanner@localhost:5434/tableplanner?sslmode=disable"),
		AuthServiceURL: getEnv("AUTH_SERVICE_URL", "http://localhost:8081"),
		Env:            getEnv("ENV", "development"),
	}

	origins := getEnv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	cfg.AllowedOrigins = strings.Split(origins, ",")

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.AuthServiceURL == "" {
		return nil, fmt.Errorf("AUTH_SERVICE_URL is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
