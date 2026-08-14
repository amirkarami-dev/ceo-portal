import type { AppRole } from "@/contracts/rbac";

/**
 * The roles allowed to change a report's definition.
 *
 * Deliberately the same list `RequireRole` lets through to `/reports/new` and
 * `/reports/:reportId/edit` (`app/router.tsx`). Editing a report is editing a report, whether it
 * happens on the designer route or by renaming a label in place, and two lists drift — which is
 * exactly what happened to dashboards before `features/dashboards/can-manage.ts` gave them one.
 *
 * Note `reports:write` is NOT the rule, though it looks like the obvious one. `PowerUser` and
 * `DashboardDesigner` both hold that permission and neither is admitted by the editor route, so
 * gating on the permission would offer controls the routes refuse.
 */
export const REPORT_EDITOR_ROLES = [
  "ReportDesigner",
  "TenantAdmin",
  "SuperAdmin",
] as const satisfies readonly AppRole[];

export function canEditReports(roles: readonly AppRole[]): boolean {
  return roles.some((role) => (REPORT_EDITOR_ROLES as readonly string[]).includes(role));
}

/**
 * May this reader rename a chart series right now?
 *
 * The editor roles, **and not while drilled down**. A drill-down child is never saved: it is built on
 * the fly from the parent plus a pinned filter, so there is no row to rename on and the override
 * would land on the *parent*. With the inline fallback that is merely confusing — the child inherits
 * the parent's metrics, so the keys at least exist. With a `drilldown.targetDefinition` the child is
 * a different report with different column keys, and the override is written under keys nothing will
 * ever read: a rename that reports success and changes nothing.
 *
 * A named rule rather than an inline `&&` because the drill-down half cannot be reached from a test —
 * recharts draws nothing in jsdom, so there is no datum to click. This much is at least covered.
 */
export function canRenameSeries(
  roles: readonly AppRole[],
  opts: { drilledDown: boolean },
): boolean {
  return canEditReports(roles) && !opts.drilledDown;
}
