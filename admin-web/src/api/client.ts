import { getAccessToken } from "@/auth/oidc";
import type { ProblemDetails } from "./types";

/**
 * The admin endpoints (`/api/admin/*`) are served by the OIDC IdP itself, so the API base is the
 * issuer origin. `VITE_ADMIN_API_BASE` is an optional override for when they move elsewhere.
 */
export const API_BASE: string =
  import.meta.env.VITE_ADMIN_API_BASE ?? import.meta.env.VITE_AUTH_ISSUER ?? "";

/** Every admin route lives under this prefix. */
export const ADMIN_PREFIX = "/api/admin";

// ── errors ───────────────────────────────────────────────────────────────────

export interface FieldError {
  /** camelCase form field name (e.g. "userName"), ready for AntD `form.setFields`. */
  name: string;
  errors: string[];
}

/**
 * A non-2xx response. Carries the parsed ProblemDetails so a `FormDrawer` can paint
 * ValidationProblemDetails onto the offending fields instead of a generic toast.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ProblemDetails;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.problem = isProblemDetails(body) ? body : undefined;
  }

  /** True when the API returned per-field validation errors. */
  get isValidation(): boolean {
    return this.status === 400 && !!this.problem?.errors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Validation errors mapped to AntD form field names.
   * The API keys them off the command shape (`UserName`, `Password`, …) — we keep the last
   * segment and lowercase its first letter so it matches the camelCase `<Form.Item name>`.
   */
  fieldErrors(): FieldError[] {
    const errors = this.problem?.errors;
    if (!errors) return [];
    return Object.entries(errors).map(([key, messages]) => {
      const last = key.split(".").pop() ?? key;
      const name = last.charAt(0).toLowerCase() + last.slice(1);
      return { name, errors: messages };
    });
  }
}

function isProblemDetails(body: unknown): body is ProblemDetails {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/** Human-readable Persian-friendly message for any thrown value. */
export function errorMessage(err: unknown, fallback = "خطایی رخ داد"): string {
  if (err instanceof ApiError) {
    if (err.isValidation) {
      const first = err.fieldErrors()[0]?.errors?.[0];
      if (first) return first;
    }
    if (err.status === 401) return "نشست شما منقضی شده است. دوباره وارد شوید.";
    if (err.status === 403) return "دسترسی مدیریتی لازم است.";
    if (err.status === 404) return "مورد موردنظر یافت نشد.";
    return err.problem?.detail || err.problem?.title || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

// ── query strings ────────────────────────────────────────────────────────────

export type QueryValue = string | number | boolean | null | undefined;

/** Serialises defined params only ("" and null/undefined are dropped). */
export function qs(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── core request ─────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parse<T>(res, method, path);
}

async function parse<T>(res: Response, method: Method, path: string): Promise<T> {
  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text().catch(() => "");
    }
    throw new ApiError(res.status, errBody, `HTTP ${res.status} ${method} ${path}`);
  }

  // 204 No Content — every PUT/DELETE (and reset-password) on this API.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}

/** Typed fetch wrapper. Paths are absolute from the API root, e.g. "/api/admin/users". */
export const api = {
  get: <T>(path: string): Promise<T> => request<T>("GET", path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body),
  put: <T = void>(path: string, body?: unknown): Promise<T> => request<T>("PUT", path, body),
  del: <T = void>(path: string): Promise<T> => request<T>("DELETE", path),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>("PATCH", path, body),
};
