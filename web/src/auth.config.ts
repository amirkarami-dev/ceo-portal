import type { NextAuthConfig } from "next-auth"

// Edge-safe Auth.js config, shared by the middleware (Edge runtime) and the full server
// instance in auth.ts. Keep this free of Node-only APIs and DB adapters so it can run in
// middleware. The OIDC discovery/token exchange only happens in the route handler (Node).
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    {
      id: "mabhas19",
      name: "Mabhas19",
      type: "oidc",
      issuer: process.env.AUTH_MABHAS19_ISSUER,
      clientId: process.env.AUTH_MABHAS19_ID,
      clientSecret: process.env.AUTH_MABHAS19_SECRET,
      authorization: {
        params: {
          scope: "openid profile email roles offline_access mabhas19.api",
        },
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      if (profile) {
        // Lift identity from the OIDC claims once, at sign-in, so it lives in the
        // session JWT and is readable by middleware (Edge) and SSR without an API call.
        const claims = profile as Record<string, unknown>
        const roles = rolesFromClaims(claims.role ?? claims.roles)
        token.roles = roles
        token.isAdmin = roles.includes("Administrator")
        // The multi-valued `svc` claim = the product services this user may open (empty =
        // grandfathered, all services allowed). Lifted here so the header app switcher can
        // filter without an API call. Persists across refresh (profile is only set at sign-in).
        token.services = rolesFromClaims(claims.svc)
        token.name =
          (claims.name as string) ?? (claims.preferred_username as string) ?? token.name
        token.email = (claims.email as string) ?? token.email
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      if (session.user) {
        if (token.sub) session.user.id = token.sub
        session.user.roles = token.roles ?? []
        session.user.isAdmin = token.isAdmin ?? false
        session.user.services = token.services ?? []
      }
      return session
    },
  },
}

// OIDC `role` may arrive as a string, an array, or be absent — normalise to string[].
function rolesFromClaims(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String)
  if (typeof claim === "string") return [claim]
  return []
}
