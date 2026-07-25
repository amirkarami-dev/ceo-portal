// analytics-web/src/api/httpClient.ts
// Thin fetch wrapper: base URL from VITE_API_BASE, JSON content-type, bearer
// token from the OIDC UserManager when VITE_AUTH_MODE=oidc.
// In mock-auth mode there is no real token — callers only reach this module when
// VITE_USE_MOCK_API="false" or VITE_AI_MODE="gateway", which always implies oidc.

import { getUserManager } from "../auth/oidc";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

/** Try to get the current OIDC access_token; returns undefined in mock-auth mode. */
async function getAccessToken(): Promise<string | undefined> {
  const authMode = (import.meta.env.VITE_AUTH_MODE as string | undefined) ?? "mock";
  if (authMode !== "oidc") return undefined;
  try {
    const u = await getUserManager().getUser();
    return u?.access_token ?? undefined;
  } catch {
    return undefined;
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text().catch(() => "");
    }
    throw new HttpError(res.status, errBody, `HTTP ${res.status} ${method} ${path}`);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const httpClient = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },
  delete<T = void>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
};
