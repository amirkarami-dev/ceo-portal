import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../../i18n";
import { UserList } from "./UserList";

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: ["TenantAdmin"],
    isAdmin: true,
    ready: true,
    user: { id: "u1", name: "Admin One", email: "a1@x.ir", tenantId: "acme", roles: ["TenantAdmin"] },
    login() {},
    logout() {},
    setMockRole() {},
    can: () => true,
    permissions: new Set<string>(),
  }),
}));

vi.mock("../../store/tenant-store", () => ({
  useTenantStore: (sel: (s: { currentTenantId: string | null }) => unknown) =>
    sel({ currentTenantId: "acme" }),
}));

vi.mock("../../api/queries", () => ({
  useUsers: () => ({
    data: [
      {
        id: "u1",
        name: "Admin One",
        email: "a1@x.ir",
        roles: ["TenantAdmin"],
        tenantId: "acme",
        status: "active",
      },
      {
        id: "u2",
        name: "Viewer Two",
        email: "v2@x.ir",
        roles: ["Viewer"],
        tenantId: "acme",
        status: "suspended",
      },
    ],
    isLoading: false,
  }),
  useUpsertUser: () => ({ mutate: vi.fn(), isPending: false }),
  useSetUserActive: () => ({ mutate: vi.fn() }),
}));

function wrap(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("UserList", () => {
  it("renders users with role tags and status", () => {
    wrap(<UserList />);
    expect(screen.getByText("Admin One")).toBeInTheDocument();
    expect(screen.getByText("a1@x.ir")).toBeInTheDocument();
    expect(screen.getByText("Viewer Two")).toBeInTheDocument();
    // Invite button present
    expect(screen.getByRole("button", { name: /invite|دعوت/i })).toBeInTheDocument();
  });

  it("shows role tags from RBAC labels", () => {
    wrap(<UserList />);
    // TenantAdmin role tag for Admin One
    expect(screen.getByText(/مدیر سازمان|Tenant Admin/i)).toBeInTheDocument();
  });
});
