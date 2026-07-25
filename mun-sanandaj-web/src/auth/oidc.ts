import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

let _userManager: UserManager | undefined;

export function getUserManager(): UserManager {
  if (!_userManager) {
    const origin = window.location.origin;
    _userManager = new UserManager({
      authority: import.meta.env.VITE_AUTH_AUTHORITY as string,
      client_id: import.meta.env.VITE_AUTH_CLIENT_ID ?? "mun-sanandaj-web",
      redirect_uri: `${origin}/auth/callback`,
      silent_redirect_uri: `${origin}/auth/silent`,
      post_logout_redirect_uri: origin,
      response_type: "code",
      scope: import.meta.env.VITE_AUTH_SCOPE ?? "openid profile email roles mabhas19.api",
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
    });
  }
  return _userManager;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export function sessionUserFromOidc(u: User): SessionUser {
  const p = u.profile as Record<string, unknown>;
  const rawRoles = p["role"] ?? p["roles"];
  const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : [];
  return {
    id: (p["sub"] as string) ?? "",
    name: (p["name"] as string) ?? (p["email"] as string) ?? "کاربر",
    email: (p["email"] as string) ?? "",
    isAdmin: roles.includes("Administrator"),
  };
}
