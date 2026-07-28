// API DTO types — sourced from the generated @mabhas19/api-types package.
// All existing "@/lib/types" imports in this project continue to work unchanged.

export type {
  Project,
  Assessment,
  CurrentUser,
  Subscription,
  CreateProjectInput,
} from "@mabhas19/api-types"

// TokenResponse — not in the API contract (IdP / OIDC token shape).
// Used by mobile/src/lib/tokens.ts to persist bearer tokens locally.
export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}
