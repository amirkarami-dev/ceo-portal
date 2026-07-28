import { getSession, signIn } from "next-auth/react"
import { env } from "./env"
import { beginLoading, endLoading } from "./loading"

export const API_BASE = env.apiBase

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  // when true, do not attach Authorization header
  skipAuth?: boolean
  // internal: prevents infinite 401 loops
  _retried?: boolean
}

async function apiFetchInner<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, skipAuth = false, _retried = false } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"

  if (!skipAuth) {
    const session = await getSession()
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // On 401 (and not already retried), trigger re-auth via OIDC.
  if (res.status === 401 && !skipAuth && !_retried) {
    void signIn("mabhas19")
    // Stop and let the redirect happen; throw so callers know the request failed.
    throw new ApiError(401, "Session expired, redirecting to login")
  }

  if (!res.ok) {
    let parsed: unknown = null
    try {
      parsed = await res.json()
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, `Request failed: ${res.status}`, parsed)
  }

  // Some endpoints (logout, 204) return no content.
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// Public wrapper: drives the global top loading bar for the whole request.
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  beginLoading()
  try {
    return await apiFetchInner<T>(path, options)
  } finally {
    endLoading()
  }
}
