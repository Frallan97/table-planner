package middleware

import (
	"testing"
	"time"
)

func TestRateLimiter_BurstAllowance(t *testing.T) {
	rl := &RateLimiter{
		rate:    10,
		burst:   5,
		buckets: make(map[string]*bucket),
	}

	for i := 0; i < 5; i++ {
		if !rl.allow("test") {
			t.Fatalf("request %d should be allowed within burst", i+1)
		}
	}
}

func TestRateLimiter_BlockAfterBurst(t *testing.T) {
	rl := &RateLimiter{
		rate:    10,
		burst:   3,
		buckets: make(map[string]*bucket),
	}

	for i := 0; i < 3; i++ {
		rl.allow("test")
	}

	if rl.allow("test") {
		t.Fatal("request after burst should be blocked")
	}
}

func TestRateLimiter_RefillOverTime(t *testing.T) {
	rl := &RateLimiter{
		rate:    10,
		burst:   2,
		buckets: make(map[string]*bucket),
	}

	// Exhaust burst
	rl.allow("test")
	rl.allow("test")

	if rl.allow("test") {
		t.Fatal("should be blocked after burst")
	}

	// Simulate time passing by manually adjusting lastSeen
	rl.mu.Lock()
	rl.buckets["test"].lastSeen = time.Now().Add(-200 * time.Millisecond)
	rl.mu.Unlock()

	// After 200ms at 10/s, we should have ~2 tokens refilled
	if !rl.allow("test") {
		t.Fatal("should be allowed after token refill")
	}
}

func TestRateLimiter_SeparateKeys(t *testing.T) {
	rl := &RateLimiter{
		rate:    10,
		burst:   1,
		buckets: make(map[string]*bucket),
	}

	if !rl.allow("user1") {
		t.Fatal("user1 first request should be allowed")
	}
	if !rl.allow("user2") {
		t.Fatal("user2 first request should be allowed")
	}
	if rl.allow("user1") {
		t.Fatal("user1 second request should be blocked")
	}
}
