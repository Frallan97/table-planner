let API_BASE = "";
let AUTH_SERVICE_URL = "http://localhost:8081";
try {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    AUTH_SERVICE_URL = (import.meta.env.VITE_AUTH_SERVICE_URL as string | undefined) || "http://localhost:8081";
  }
} catch {
  // import.meta not available (e.g. some runtimes)
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

export function getLoginURL(): string {
  const redirectUri = encodeURIComponent(window.location.origin + "/auth/callback");
  return `${AUTH_SERVICE_URL}/api/auth/google/login?redirect_uri=${redirectUri}`;
}

export function getRefreshURL(): string {
  return `${AUTH_SERVICE_URL}/api/auth/refresh`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (retry.ok) {
        return retry.json();
      }
    }
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const resp = await fetch(getRefreshURL(), {
      method: "POST",
      credentials: "include",
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data.access_token) {
      accessToken = data.access_token;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface FloorPlanSummary {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FloorPlanFull {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tables: unknown[];
  guests: unknown[];
  labels: unknown[];
}

export const api = {
  listFloorPlans(): Promise<FloorPlanSummary[]> {
    return request("/api/floor-plans");
  },

  createFloorPlan(name: string): Promise<FloorPlanSummary> {
    return request("/api/floor-plans", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  getFloorPlan(id: string): Promise<FloorPlanFull> {
    return request(`/api/floor-plans/${id}`);
  },

  updateFloorPlan(id: string, name: string): Promise<void> {
    return request(`/api/floor-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },

  deleteFloorPlan(id: string): Promise<void> {
    return request(`/api/floor-plans/${id}`, {
      method: "DELETE",
    });
  },

  bulkSave(id: string, data: { tables: unknown[]; guests: unknown[]; labels: unknown[] }): Promise<void> {
    return request(`/api/floor-plans/${id}/save`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
