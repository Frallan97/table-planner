import type { ZodSchema } from "zod";
import { floorPlanSummarySchema, floorPlanFullSchema } from "./schemas";

let API_BASE = "";
let AUTH_SERVICE_URL = "http://localhost:8081";

function setDefaultsFromHostname() {
  try {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const isLocal =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0";

      if (isLocal) {
        API_BASE = "http://localhost:8082";
        AUTH_SERVICE_URL = "http://localhost:8081";
      } else {
        API_BASE = "";
        AUTH_SERVICE_URL = "https://auth.vibeoholic.com";
      }
    }
  } catch {
    // Fallback
  }
}

setDefaultsFromHostname();

/** Load optional /config.json to override API and auth URLs (e.g. in prod without rebuild). */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const r = await fetch("/config.json", { cache: "no-store" });
    if (!r.ok) return;
    const c = (await r.json()) as { authServiceUrl?: string; apiBase?: string };
    if (c.authServiceUrl) AUTH_SERVICE_URL = c.authServiceUrl;
    if (c.apiBase !== undefined) API_BASE = c.apiBase;
  } catch {
    // Ignore
  }
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

function validateResponse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn("API response validation failed:", result.error.issues);
    return data as T;
  }
  return result.data;
}

export const api = {
  async listFloorPlans(): Promise<FloorPlanSummary[]> {
    const data = await request<unknown[]>("/api/floor-plans");
    return data.map((item) => validateResponse(floorPlanSummarySchema, item));
  },

  createFloorPlan(name: string): Promise<FloorPlanSummary> {
    return request("/api/floor-plans", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async getFloorPlan(id: string): Promise<FloorPlanFull> {
    const data = await request<unknown>(`/api/floor-plans/${id}`);
    return validateResponse(floorPlanFullSchema, data) as FloorPlanFull;
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
