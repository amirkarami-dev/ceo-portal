import { auth } from "@/auth"
import { env } from "./env"

// Server-side API fetch used for RSC prefetching only. Reads the OIDC access token from
// the Auth.js session server-side (via auth()), unlike api.ts which uses the client
// getSession(). Throws on non-2xx; prefetchQuery() swallows the throw, so a missing
// session just means the client fetches normally.
export async function serverApiFetch<T>(path: string): Promise<T> {
  const session = await auth()
  const token = session?.accessToken
  const res = await fetch(`${env.apiBase}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Server API fetch failed: ${res.status} ${path}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
