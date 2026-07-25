import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Extends the built-in Session type to include the IdP access token
   * so that API requests can be made on behalf of the user.
   */
  interface Session extends DefaultSession {
    /** Raw JWT access token issued by the IdP (audience: mabhas19.api). */
    accessToken?: string
    /** Identity lifted from the OIDC token claims (so middleware + SSR can read it). */
    user: {
      id?: string
      roles: string[]
      isAdmin: boolean
      /** Product services this user may open (`svc` claim; empty = all/grandfathered). */
      services: string[]
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  /** Extends the Auth.js JWT with tokens + identity forwarded from the IdP. */
  interface JWT {
    /** IdP access token (audience: mabhas19.api). */
    accessToken?: string
    /** IdP refresh token for silent renewal. */
    refreshToken?: string
    /** Absolute expiry of the access token (seconds since epoch). */
    expiresAt?: number
    /** Role claims lifted from the OIDC token. */
    roles?: string[]
    /** Convenience flag derived from roles. */
    isAdmin?: boolean
    /** Product services the user may open (`svc` claim; empty = all/grandfathered). */
    services?: string[]
  }
}
