import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import * as WebBrowser from "expo-web-browser"
import {
  exchangeCodeAsync,
  type DiscoveryDocument,
} from "expo-auth-session"
import { authApi } from "./endpoints"
import { tokenStore } from "./tokens"
import { clientId, redirectUri, AUTH_ISSUER } from "./oidc"
import type { CurrentUser } from "./types"

interface AuthContextValue {
  user: CurrentUser | null
  isAdmin: boolean
  loading: boolean
  /**
   * Complete an OIDC code+PKCE sign-in after `promptAsync` returns `success`.
   *
   * The login screen owns `useAuthRequest` / `promptAsync`; it passes the
   * `code` and `codeVerifier` (from `request.codeVerifier`) here so the
   * context can do the token exchange and hydrate `user`.
   */
  completeSignIn: (
    code: string,
    codeVerifier: string | undefined,
    discovery: DiscoveryDocument,
  ) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await tokenStore.load()
      if (tokenStore.getAccess()) {
        await refreshUser()
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  /**
   * Exchange an authorization code for tokens, persist them, and hydrate the
   * user profile. Called by the login screen after `promptAsync()` succeeds.
   *
   * `codeVerifier` comes from `request.codeVerifier` on the `AuthRequest`
   * returned by `useAuthRequest`. It is only present when PKCE was used
   * (which is always the case here), but the expo type marks it optional.
   */
  const completeSignIn = useCallback(
    async (
      code: string,
      codeVerifier: string | undefined,
      discovery: DiscoveryDocument,
    ) => {
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId,
          redirectUri,
          code,
          extraParams: codeVerifier ? { code_verifier: codeVerifier } : {},
        },
        discovery,
      )

      // tokenResponse.refreshToken is optional in the expo type; if the IdP
      // issues one we persist it, otherwise keep whatever was stored before.
      const refreshToken =
        tokenResponse.refreshToken ?? tokenStore.getRefresh() ?? ""

      await tokenStore.set({
        accessToken: tokenResponse.accessToken,
        refreshToken,
        expiresIn: tokenResponse.expiresIn ?? 3600,
        tokenType: tokenResponse.tokenType ?? "bearer",
      })

      await refreshUser()
    },
    [refreshUser],
  )

  const logout = useCallback(async () => {
    const issuer = AUTH_ISSUER
    await tokenStore.clear()
    setUser(null)
    // Attempt IdP end-session (best-effort — don't block on errors).
    try {
      await WebBrowser.openBrowserAsync(`${issuer}/connect/endsession`)
      WebBrowser.dismissBrowser()
    } catch {
      // ignore — the local session is already cleared
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.isAdmin ?? false,
      loading,
      completeSignIn,
      logout,
      refreshUser,
    }),
    [user, loading, completeSignIn, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
