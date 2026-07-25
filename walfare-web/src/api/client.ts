import { getAccessToken } from "@/auth/oidc";

/** The mabhas19 API origin; /api/walfare/* lives there (NOT on the IdP). */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export const WALFARE_PREFIX = "/api/walfare";

// ── errors ───────────────────────────────────────────────────────────────────

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export interface FieldError {
  /** camelCase form field name, ready for AntD `form.setFields`. */
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

  get isValidation(): boolean {
    return this.status === 400 && !!this.problem?.errors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Validation errors mapped to camelCase AntD form field names. */
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
    if (err.status === 403) return "دسترسی لازم را ندارید.";
    if (err.status === 404) return "مورد موردنظر یافت نشد.";
    return err.problem?.detail || err.problem?.title || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

// ── query strings ────────────────────────────────────────────────────────────

export type QueryValue = string | number | boolean | null | undefined;

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

type Method = "GET" | "POST" | "PUT" | "DELETE";

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

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text().catch(() => "");
    }
    throw new ApiError(res.status, errBody, `HTTP ${res.status} ${method} ${path}`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>("GET", path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>("POST", path, body),
  put: <T = void>(path: string, body?: unknown): Promise<T> => request<T>("PUT", path, body),
  del: <T = void>(path: string): Promise<T> => request<T>("DELETE", path),
};
