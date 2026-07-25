// fetch wrapper with bearer auth + one-shot 401 refresh via IdP token endpoint.
// Mirrors the shape of web/src/lib/api.ts but persists tokens through
// expo-secure-store (see tokens.ts) and refreshes through the OIDC issuer.
import Constants from "expo-constants"
import { fetchDiscoveryAsync, type DiscoveryDocument } from "expo-auth-session"
import { tokenStore } from "./tokens"
import { refreshTokens, AUTH_ISSUER } from "./oidc"

export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ||
  "https://api.mabhas19.myceo.ir"

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
  skipAuth?: boolean
  _retried?: boolean
}

// Cache the discovery document so we don't re-fetch it on every 401.
let cachedDiscovery: DiscoveryDocument | null = null
async function getDiscovery(): Promise<DiscoveryDocument> {
  if (!cachedDiscovery) {
    cachedDiscovery = await fetchDiscoveryAsync(AUTH_ISSUER)
  }
  return cachedDiscovery
}

let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return false
  try {
    const discovery = await getDiscovery()
    const tokenResponse = await refreshTokens(refreshToken, discovery)
    const newRefresh =
      tokenResponse.refreshToken ?? tokenStore.getRefresh() ?? ""
    await tokenStore.set({
      accessToken: tokenResponse.accessToken,
      refreshToken: newRefresh,
      expiresIn: tokenResponse.expiresIn ?? 3600,
      tokenType: tokenResponse.tokenType ?? "bearer",
    })
    return true
  } catch {
    await tokenStore.clear()
    // Invalidate the discovery cache on error; it may have gone stale.
    cachedDiscovery = null
    return false
  }
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, skipAuth = false, _retried = false } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (!skipAuth) {
    const token = tokenStore.getAccess()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuth && !_retried) {
    const ok = await refreshOnce()
    if (ok) return apiFetch<T>(path, { ...options, _retried: true })
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

  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
