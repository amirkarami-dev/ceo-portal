// OIDC configuration and helpers for expo-auth-session (PKCE, code flow).
// Hooks (useAutoDiscovery, useAuthRequest) belong in the login screen.
// Only stateless utilities live here so this module is safe to import from
// contexts and non-hook call-sites.
import Constants from "expo-constants"
import {
  makeRedirectUri,
  refreshAsync,
  type DiscoveryDocument,
} from "expo-auth-session"

export const AUTH_ISSUER: string =
  (process.env.EXPO_PUBLIC_AUTH_ISSUER as string | undefined) ??
  (Constants.expoConfig?.extra?.authIssuer as string | undefined) ??
  "https://auth.myceo.ir"

/** Deep-link URI registered in the IdP for this client. */
export const redirectUri = makeRedirectUri({
  scheme: "mabhas19",
  path: "auth",
})

export const clientId = "mabhas19-mobile"

export const scopes = [
  "openid",
  "profile",
  "email",
  "roles",
  "offline_access",
  "mabhas19.api",
]

/**
 * Use the OIDC token endpoint to exchange a refresh token for a new access
 * token. Returns the raw expo-auth-session TokenResponse.
 *
 * Discovery must already be loaded by the caller (via `useAutoDiscovery` or
 * `fetchDiscoveryAsync`) so this helper stays free of React hooks.
 */
export async function refreshTokens(
  refreshToken: string,
  discovery: Pick<DiscoveryDocument, "tokenEndpoint">,
) {
  return refreshAsync(
    { clientId, refreshToken, scopes },
    discovery,
  )
}
