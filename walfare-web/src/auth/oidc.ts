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
      scope: import.meta.env.VITE_AUTH_SCOPE ?? "openid profile email roles ceo.api",
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
    });
  }
  return _userManager;
}

/**
 * What the IdP told us when it refused the callback.
 *
 * The authorize step answers `error=access_denied` when the account holds no grant for THIS service
 * (src/Auth/Auth/AuthorizationController.cs), and puts the real Persian reason in
 * `error_description`. oidc-client-ts rejects `signinRedirectCallback()` for that, so without
 * reading the query we throw the only useful sentence away and show a generic "login failed".
 */
export interface CallbackFailure {
  /** OAuth2 error code, e.g. "access_denied". */
  code: string | null;
  /** The IdP's own message, already in Persian. */
  message: string | null;
  /** The account simply has no access to this service — retrying as the same user cannot help. */
  isAccessDenied: boolean;
}

export function readCallbackError(search: string): CallbackFailure {
  const q = new URLSearchParams(search);
  const code = q.get("error");
  return { code, message: q.get("error_description"), isAccessDenied: code === "access_denied" };
}

/**
 * Drop this browser's tokens AND end the IdP's SSO session, then land back on a real login form.
 *
 * Sending the user to /login instead would call `signinRedirect()`, the IdP would still see a valid
 * SSO cookie, and it would answer `access_denied` again — the exact loop this button exists to
 * break. Ending the session is what makes the next attempt ask for a username and password.
 */
export async function signOutAndRestart(): Promise<void> {
  const manager = getUserManager();
  try {
    await manager.removeUser();
  } catch {
    // Already gone. The sign-out below is the part that matters.
  }
  try {
    await manager.signoutRedirect();
  } catch {
    // Some end-session configurations refuse without an id_token_hint, which we may have just
    // dropped. A local clear plus a normal login still beats looping on the old session.
    window.location.assign("/login");
  }
}

/** The role the admin API requires for every user-management call. */
/**
 * Roles that carry administrator powers. SuperUser is strictly above Administrator — it is never
 * restricted by per-service grants — so every `isAdmin` check must accept it, or the one account
 * guaranteed to be able to repair a bad grant would see no admin navigation at all.
 */
export const ADMIN_ROLES = ["Administrator", "SuperUser"] as const;

/** @deprecated prefer ADMIN_ROLES — kept for existing imports. */
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
    isAdmin: roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r)),
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
