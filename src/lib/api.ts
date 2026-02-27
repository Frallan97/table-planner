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
  organizationId?: string;
  organizationName?: string;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FloorPlanFull {
  id: string;
  userId: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  createdAt: string;
  updatedAt: string;
  tables: unknown[];
  guests: unknown[];
  labels: unknown[];
  lock?: FloorPlanLock;
}

export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWithRole extends Organization {
  role: string;
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface FloorPlanLock {
  floorPlanId: string;
  userId: string;
  userEmail?: string;
  lockedAt: string;
  expiresAt: string;
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

  // Share/Unshare
  shareFloorPlan(fpId: string, organizationId: string): Promise<{ status: string }> {
    return request(`/api/floor-plans/${fpId}/share`, {
      method: "POST",
      body: JSON.stringify({ organizationId }),
    });
  },

  unshareFloorPlan(fpId: string): Promise<{ status: string }> {
    return request(`/api/floor-plans/${fpId}/unshare`, {
      method: "POST",
    });
  },

  // Floor Plan Locking
  acquireLock(fpId: string): Promise<FloorPlanLock> {
    return request(`/api/floor-plans/${fpId}/lock`, {
      method: "POST",
    });
  },

  releaseLock(fpId: string): Promise<void> {
    return request(`/api/floor-plans/${fpId}/lock`, {
      method: "DELETE",
    });
  },

  refreshLockHeartbeat(fpId: string): Promise<FloorPlanLock> {
    return request(`/api/floor-plans/${fpId}/lock/heartbeat`, {
      method: "PUT",
    });
  },

  getLockStatus(fpId: string): Promise<{ locked: boolean; lock?: FloorPlanLock }> {
    return request(`/api/floor-plans/${fpId}/lock/status`);
  },

  // Organizations
  listOrganizations(): Promise<OrganizationWithRole[]> {
    return request("/api/organizations");
  },

  createOrganization(name: string): Promise<Organization> {
    return request("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  getOrganization(id: string): Promise<OrganizationWithRole> {
    return request(`/api/organizations/${id}`);
  },

  updateOrganization(id: string, name: string): Promise<Organization> {
    return request(`/api/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },

  deleteOrganization(id: string): Promise<void> {
    return request(`/api/organizations/${id}`, {
      method: "DELETE",
    });
  },

  // Organization Members
  listOrgMembers(orgId: string): Promise<OrganizationMember[]> {
    return request(`/api/organizations/${orgId}/members`);
  },

  inviteMember(orgId: string, email: string, role: string): Promise<OrganizationInvitation> {
    return request(`/api/organizations/${orgId}/members/invite`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },

  removeMember(orgId: string, memberId: string): Promise<void> {
    return request(`/api/organizations/${orgId}/members/${memberId}`, {
      method: "DELETE",
    });
  },

  updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember> {
    return request(`/api/organizations/${orgId}/members/${memberId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  // Invitations
  acceptInvitation(token: string): Promise<OrganizationMember> {
    return request(`/api/invitations/${token}/accept`, {
      method: "POST",
    });
  },
};
