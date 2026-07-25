import { QueryClient, isServer } from "@tanstack/react-query"
import { ApiError } from "./api"

// Standard Next.js App Router setup: a fresh QueryClient per request on the server
// (so prefetched data never leaks between users), a singleton in the browser.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s: avoid immediate refetch after server prefetch/hydration
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry auth/permission/not-found — they won't fix themselves and a
          // 401 already triggers OIDC re-auth in apiFetch.
          if (
            error instanceof ApiError &&
            [400, 401, 403, 404].includes(error.status)
          ) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
