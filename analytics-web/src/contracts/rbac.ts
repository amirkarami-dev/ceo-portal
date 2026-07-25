// §10.5 — the swappable RBAC seam. In v1 roles come from the mock user;
// later from the OIDC token. `can()` is unchanged across both.

export type Permission =
  | "reports:write"
  | "reports:delete"
  | "reports:execute"
  | "data:export"
  | "ai:manage"
  | "datasources:manage"
  | "users:manage"
  | "audit:read";

export type AppRole =
  | "SuperAdmin"
  | "TenantAdmin"
  | "AIManager"
  | "ReportDesigner"
  | "DashboardDesigner"
  | "PowerUser"
  | "Viewer";

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SuperAdmin: [
    "reports:write",
    "reports:delete",
    "reports:execute",
    "data:export",
    "ai:manage",
    "datasources:manage",
    "users:manage",
    "audit:read",
  ],
  TenantAdmin: [
    "reports:write",
    "reports:delete",
    "reports:execute",
    "data:export",
    "ai:manage",
    "datasources:manage",
    "users:manage",
    "audit:read",
  ],
  AIManager: ["reports:execute", "ai:manage", "audit:read"],
  ReportDesigner: ["reports:write", "reports:delete", "reports:execute", "data:export"],
  DashboardDesigner: ["reports:write", "reports:execute", "data:export"],
  PowerUser: ["reports:write", "reports:execute", "data:export"], // write = personal scope
  Viewer: ["reports:execute"], // data:export grantable
};

/** Effective permissions = union over all held roles (+ tenant-level grants). */
export function permissionsFor(roles: AppRole[], grants: Permission[] = []): Set<Permission> {
  const set = new Set<Permission>(grants);
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r]) set.add(p);
  return set;
}

export const can = (perms: Set<Permission>, p: Permission): boolean => perms.has(p);
export const isGlobal = (roles: AppRole[]): boolean => roles.includes("SuperAdmin");

/**
 * R6: the identity object `useAuth()` exposes. Sourced from the mock user
 * (VITE_AUTH_MODE=mock) or the OIDC token (VITE_AUTH_MODE=oidc) — one shape.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  tenantId: string | null;
  /** per-tenant grants (e.g. Viewer export) — merged into permissionsFor(). */
  grants?: Permission[];
}

/**
 * §10.8 — map existing IdP roles (`Administrator`/`User`) + native `report.*`
 * claims to AppRole[]. Native `report.*` claims win; legacy fallback only fires
 * when none present; default-deny resolves to Viewer.
 */
export function mapLegacyRoles(claimRoles: string[]): AppRole[] {
  const mapped: AppRole[] = [];
  for (const r of claimRoles) {
    if (r.startsWith("report.")) {
      const sliced = r.slice("report.".length);
      // Runtime membership check — only accept values that are real AppRoles.
      // An unsafe `as AppRole` cast would silently inject arbitrary strings.
      if (sliced in ROLE_PERMISSIONS) mapped.push(sliced as AppRole);
    } else if (r === "Administrator") mapped.push("SuperAdmin"); // or "TenantAdmin" per deployment
    else if (r === "User") mapped.push("PowerUser"); // or "Viewer"
  }
  return mapped.length ? Array.from(new Set(mapped)) : ["Viewer"]; // safe default
}
