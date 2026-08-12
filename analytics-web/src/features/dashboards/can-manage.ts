import type { AppRole } from "@/contracts/rbac";

/**
 * The roles `RequireRole` actually lets through to `/dashboards/new`,
 * `/dashboards/:id/edit` and `/manage-dashboards`.
 *
 * Every create, edit or delete control must ask this before it renders. The three
 * pages used to keep their own copy of the list, and each copy included
 * `ReportDesigner` — which the routes do not. A report designer was therefore
 * shown «داشبورد جدید» and «ویرایش», and got a 403 for taking them up on it.
 */
export const DASHBOARD_MANAGER_ROLES = [
  "DashboardDesigner",
  "TenantAdmin",
  "SuperAdmin",
] as const satisfies readonly AppRole[];

export function canManageDashboards(roles: readonly AppRole[]): boolean {
  return roles.some((role) => (DASHBOARD_MANAGER_ROLES as readonly string[]).includes(role));
}
