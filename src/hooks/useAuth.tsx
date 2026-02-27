import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAccessToken, setOnUnauthorized, getLoginURL, getRefreshURL, loadRuntimeConfig } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem("tp_access_token");
  }, []);

  const login = useCallback(() => {
    window.location.href = getLoginURL();
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call auth-service logout to clear refresh token cookie
      await fetch(getLoginURL().replace("/login", "/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }
    clearAuth();
    // Force redirect to login page
    window.location.href = "/";
  }, [clearAuth]);

  // Attempt token refresh on mount
  useEffect(() => {
    setOnUnauthorized(clearAuth);

    const init = async () => {
      await loadRuntimeConfig();
      // Check for token in sessionStorage (persists across page refreshes within tab)
      const storedToken = sessionStorage.getItem("tp_access_token");
      if (storedToken) {
        setAccessToken(storedToken);
        // Decode JWT payload to get user info (no validation needed, backend validates)
        const payload = parseJwtPayload(storedToken);
        if (payload && !isExpired(payload)) {
          setUser({
            id: payload.sub,
            email: payload.email,
            name: payload.name,
          });
          setIsLoading(false);
          return;
        }
      }

      // Try to refresh the token via the auth-service refresh cookie
      try {
        const resp = await fetch(getRefreshURL(), {
          method: "POST",
          credentials: "include",
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.access_token) {
            setAccessToken(data.access_token);
            sessionStorage.setItem("tp_access_token", data.access_token);
            const payload = parseJwtPayload(data.access_token);
            if (payload) {
              setUser({
                id: payload.sub,
                email: payload.email,
                name: payload.name,
              });
            }
          }
        }
      } catch {
        // No valid refresh token - user will need to log in
      }

      setIsLoading(false);
    };

    init();
  }, [clearAuth]);

  // Handle the /auth/callback route
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("access_token");
      if (token) {
        setAccessToken(token);
        sessionStorage.setItem("tp_access_token", token);
        const payload = parseJwtPayload(token);
        if (payload) {
          setUser({
            id: payload.sub,
            email: payload.email,
            name: payload.name,
          });
        }
        // Clean up the URL
        window.history.replaceState({}, "", "/");
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function parseJwtPayload(token: string): Record<string, string> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

function isExpired(payload: Record<string, unknown>): boolean {
  const exp = payload.exp as number | undefined;
  if (!exp) return true;
  return Date.now() / 1000 > exp;
}
