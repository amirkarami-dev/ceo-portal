"use client"

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react"
import { signOut } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import type { CurrentUser } from "./types"

interface AuthState {
  user: CurrentUser | null
  roles: string[]
  isAdmin: boolean
  /** Product services this user may open (`svc` claim; empty = all/grandfathered). */
  services: string[]
  /** True when the user may open the given product service key. */
  canAccess: (serviceKey: string) => boolean
  ready: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Identity is resolved on the server (from the session JWT) and passed in as initialUser,
// so there's no client fetch and no auth flicker. Route protection lives in middleware.
export function AuthProvider({
  initialUser,
  initialServices = [],
  children,
}: {
  initialUser: CurrentUser
  initialServices?: string[]
  children: ReactNode
}) {
  const qc = useQueryClient()

  const logout = useCallback(async () => {
    await signOut({ redirect: false })
    qc.clear() // drop all cached private data so nothing leaks to the next user
    const issuer = process.env.NEXT_PUBLIC_AUTH_ISSUER
    if (issuer) {
      // End the IdP session too, then come back to the app's home page. OpenIddict validates
      // post_logout_redirect_uri against the client's registered PostLogoutRedirectUris.
      const back = encodeURIComponent(window.location.origin)
      window.location.href = `${issuer}/connect/logout?post_logout_redirect_uri=${back}`
    } else {
      window.location.href = "/login"
    }
  }, [qc])

  // Empty grant list = grandfathered → the user may open every service.
  const canAccess = useCallback(
    (serviceKey: string) =>
      initialServices.length === 0 || initialServices.includes(serviceKey),
    [initialServices],
  )

  return (
    <AuthContext.Provider
      value={{
        user: initialUser,
        roles: initialUser.roles ?? [],
        isAdmin: initialUser.isAdmin ?? false,
        services: initialServices,
        canAccess,
        ready: true,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
