import { canManageDashboards, DASHBOARD_MANAGER_ROLES } from "./can-manage";

describe("canManageDashboards", () => {
  it.each(DASHBOARD_MANAGER_ROLES)("lets %s through", (role) => {
    expect(canManageDashboards([role])).toBe(true);
  });

  // The bug this helper exists for: three pages each kept their own list and each
  // included ReportDesigner, which the routes do not. A report designer was offered
  // «داشبورد جدید» and «ویرایش», and got a 403 for taking them up on it.
  it("does not let a report designer through, because the routes do not", () => {
    expect(canManageDashboards(["ReportDesigner"])).toBe(false);
  });

  it("does not let a viewer or power user through", () => {
    expect(canManageDashboards(["Viewer"])).toBe(false);
    expect(canManageDashboards(["PowerUser"])).toBe(false);
  });

  it("passes on any one qualifying role among several", () => {
    expect(canManageDashboards(["Viewer", "TenantAdmin"])).toBe(true);
  });

  it("refuses an empty role list", () => {
    expect(canManageDashboards([])).toBe(false);
  });
});
