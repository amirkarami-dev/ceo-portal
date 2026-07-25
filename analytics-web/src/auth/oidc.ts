import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AppRole, Permission } from "@/contracts/rbac";
import { mapLegacyRoles } from "@/contracts/rbac";
import type { SessionUser } from "@/contracts";

let _userManager: UserManager | undefined;

export function getUserManager(): UserManager {
  if (!_userManager) {
    const origin = window.location.origin;
    _userManager = new UserManager({
      authority: import.meta.env.VITE_AUTH_AUTHORITY as string, // https://auth.myceo.ir
      client_id: import.meta.env.VITE_AUTH_CLIENT_ID ?? "report-web",
      redirect_uri: `${origin}/auth/callback`,
      silent_redirect_uri: `${origin}/auth/silent`,
      post_logout_redirect_uri: origin,
      response_type: "code", // Authorization Code + PKCE (public client, no secret)
      scope: import.meta.env.VITE_AUTH_SCOPE ?? "openid profile email roles mabhas19.api",
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
    });
  }
  return _userManager;
}

function rolesFromClaims(profile: Record<string, unknown>): string[] {
  const raw = (profile["role"] ?? profile["roles"]) as string | string[] | undefined;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function sessionUserFromOidc(u: User): SessionUser {
  const p = u.profile as Record<string, unknown>;
  const roles: AppRole[] = mapLegacyRoles(rolesFromClaims(p));
  return {
    id: (p["sub"] as string) ?? "oidc-user",
    name: (p["name"] as string) ?? (p["email"] as string) ?? "User",
    email: (p["email"] as string) ?? "",
    tenantId: (p["tenant_id"] as string) ?? null,
    roles,
    grants: [] as Permission[],
  };
}
