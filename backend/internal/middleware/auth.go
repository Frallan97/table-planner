package middleware

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const UserIDKey contextKey = "userID"

type Claims struct {
	UserID uuid.UUID `json:"sub"`
	Email  string    `json:"email"`
	Name   string    `json:"name"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

type AuthMiddleware struct {
	authServiceURL string
	publicKey      *rsa.PublicKey
	mu             sync.RWMutex
	stopCh         chan struct{}
}

func NewAuthMiddleware(authServiceURL string) (*AuthMiddleware, error) {
	am := &AuthMiddleware{
		authServiceURL: authServiceURL,
		stopCh:         make(chan struct{}),
	}

	if err := am.fetchPublicKey(); err != nil {
		return nil, fmt.Errorf("fetch initial public key: %w", err)
	}

	return am, nil
}

func (am *AuthMiddleware) fetchPublicKey() error {
	url := strings.TrimRight(am.authServiceURL, "/") + "/api/public-key"

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s returned status %d", url, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	block, _ := pem.Decode(body)
	if block == nil {
		return fmt.Errorf("failed to decode PEM block from public key")
	}

	var pubKey *rsa.PublicKey

	switch block.Type {
	case "RSA PUBLIC KEY":
		pubKey, err = x509.ParsePKCS1PublicKey(block.Bytes)
	case "PUBLIC KEY":
		parsed, parseErr := x509.ParsePKIXPublicKey(block.Bytes)
		if parseErr != nil {
			return fmt.Errorf("parse PKIX public key: %w", parseErr)
		}
		var ok bool
		pubKey, ok = parsed.(*rsa.PublicKey)
		if !ok {
			return fmt.Errorf("public key is not RSA")
		}
	default:
		return fmt.Errorf("unexpected PEM block type: %s", block.Type)
	}
	if err != nil {
		return fmt.Errorf("parse public key: %w", err)
	}

	am.mu.Lock()
	am.publicKey = pubKey
	am.mu.Unlock()

	log.Println("Auth public key fetched from auth-service")
	return nil
}

func (am *AuthMiddleware) StartKeyRefresh(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := am.fetchPublicKey(); err != nil {
				log.Printf("Warning: failed to refresh auth public key: %v", err)
			}
		case <-am.stopCh:
			return
		}
	}
}

func (am *AuthMiddleware) Stop() {
	close(am.stopCh)
}

func (am *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		am.mu.RLock()
		pubKey := am.publicKey
		am.mu.RUnlock()

		token, err := jwt.ParseWithClaims(parts[1], &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return pubKey, nil
		})
		if err != nil {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return id, ok
}
