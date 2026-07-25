import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

let _userManager: UserManager | undefined;

/** Lazily built so tests / SSR-less imports never touch `window` at module load. */
export function getUserManager(): UserManager {
  if (!_userManager) {
    const origin = window.location.origin;
    _userManager = new UserManager({
      authority: import.meta.env.VITE_AUTH_ISSUER,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? "walfare-web",
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

/** The role the admin API requires for every user-management call. */
export const ADMIN_ROLE = "Administrator";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
}

/** The IdP emits the role claim as `role` (sometimes `roles`), scalar or array. */
export function rolesFromProfile(profile: Record<string, unknown>): string[] {
  const raw = profile["role"] ?? profile["roles"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

export function sessionUserFromOidc(u: User): SessionUser {
  const p = u.profile as Record<string, unknown>;
  const roles = rolesFromProfile(p);
  return {
    id: (p["sub"] as string) ?? "",
    name: (p["name"] as string) ?? (p["email"] as string) ?? "کاربر",
    email: (p["email"] as string) ?? "",
    roles,
    isAdmin: roles.includes(ADMIN_ROLE),
  };
}

/** Current access token, or undefined when signed out. Used by the API client. */
export async function getAccessToken(): Promise<string | undefined> {
  try {
    const u = await getUserManager().getUser();
    return u && !u.expired ? u.access_token : undefined;
  } catch {
    return undefined;
  }
}
