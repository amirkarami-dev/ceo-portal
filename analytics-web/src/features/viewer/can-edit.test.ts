import { describe, it, expect } from "vitest";
import type { AppRole } from "@/contracts/rbac";
import { ROLE_PERMISSIONS } from "@/contracts/rbac";
import { canEditReports, canRenameSeries, REPORT_EDITOR_ROLES } from "./can-edit";

const ALL_ROLES: AppRole[] = [
  "SuperAdmin",
  "TenantAdmin",
  "AIManager",
  "ReportDesigner",
  "DashboardDesigner",
  "PowerUser",
  "Viewer",
];

describe("canEditReports", () => {
  // Every role named, so adding one to AppRole without deciding this question fails here rather than
  // silently defaulting to "no".
  it.each(ALL_ROLES)("%s", (role) => {
    const expected = (REPORT_EDITOR_ROLES as readonly string[]).includes(role);
    expect(canEditReports([role])).toBe(expected);
  });

  it("lets a reader through on any one of their roles", () => {
    expect(canEditReports(["Viewer", "ReportDesigner"])).toBe(true);
    expect(canEditReports(["Viewer", "PowerUser"])).toBe(false);
  });

  it("refuses someone with no roles at all", () => {
    expect(canEditReports([])).toBe(false);
  });

  /**
   * The trap this predicate exists to avoid. `reports:write` looks like the natural rule and is the
   * wrong one: PowerUser and DashboardDesigner both hold it, and the editor route admits neither.
   * Gating on the permission would render controls the routes then refuse — the same mismatch that
   * showed a report designer «داشبورد جدید» before dashboards got a shared predicate.
   */
  it("is NOT the same as holding reports:write", () => {
    const withWrite = ALL_ROLES.filter((r) => ROLE_PERMISSIONS[r].includes("reports:write"));
    const allowed = ALL_ROLES.filter((r) => canEditReports([r]));

    expect(withWrite).not.toEqual(allowed);
    // Concretely: these hold the permission and are still refused.
    expect(withWrite).toContain("PowerUser");
    expect(allowed).not.toContain("PowerUser");
  });

  it("matches the roles the editor route admits", () => {
    // app/router.tsx guards /reports/new and /reports/:reportId/edit with exactly this list. If the
    // route changes and this does not, one of them is lying to the user.
    expect([...REPORT_EDITOR_ROLES]).toEqual(["ReportDesigner", "TenantAdmin", "SuperAdmin"]);
  });
});

describe("canRenameSeries", () => {
  it("needs the editor roles, like everything else that edits a definition", () => {
    expect(canRenameSeries(["ReportDesigner"], { drilledDown: false })).toBe(true);
    expect(canRenameSeries(["PowerUser"], { drilledDown: false })).toBe(false);
  });

  /**
   * A drill-down child is built on the fly and never saved, so there is no row to rename on. The
   * override would be written to the PARENT — under the child's column keys when the drilldown uses a
   * `targetDefinition`, which is a different report entirely. That is a rename that reports success
   * and changes nothing.
   */
  it("refuses while drilled down, however senior the reader", () => {
    for (const role of REPORT_EDITOR_ROLES) {
      expect(canRenameSeries([role], { drilledDown: true }), role).toBe(false);
    }
  });
});
