import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../../i18n";
import { RolePermissionMatrix } from "./RolePermissionMatrix";

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: ["SuperAdmin"],
    isAdmin: true,
    ready: true,
    user: { id: "1", name: "Admin", email: "a@a.ir", tenantId: "t", roles: ["SuperAdmin"] },
    login() {},
    logout() {},
    setMockRole() {},
    can: () => true,
    permissions: new Set<string>(),
  }),
}));

function wrap(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("RolePermissionMatrix", () => {
  it("renders 7 roles as rows and 8 permission columns", () => {
    wrap(<RolePermissionMatrix />);
    ["SuperAdmin", "TenantAdmin", "AIManager", "ReportDesigner", "DashboardDesigner", "PowerUser", "Viewer"].forEach(
      (r) => expect(screen.getByTestId(`role-row-${r}`)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("perm-col-reports:write")).toBeInTheDocument();
    expect(screen.getByTestId("perm-col-audit:read")).toBeInTheDocument();
  });

  it("marks AIManager with ai:manage + reports:execute + audit:read only", () => {
    wrap(<RolePermissionMatrix />);
    const row = screen.getByTestId("role-row-AIManager");
    // Cells are siblings inside the <tr>; within scopes to that tr
    expect(within(row).getByTestId("cell-AIManager-ai:manage")).toHaveAttribute("data-granted", "true");
    expect(within(row).getByTestId("cell-AIManager-reports:execute")).toHaveAttribute("data-granted", "true");
    expect(within(row).getByTestId("cell-AIManager-audit:read")).toHaveAttribute("data-granted", "true");
    expect(within(row).getByTestId("cell-AIManager-reports:write")).toHaveAttribute("data-granted", "false");
    expect(within(row).getByTestId("cell-AIManager-data:export")).toHaveAttribute("data-granted", "false");
  });
});
