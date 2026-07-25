import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../../i18n";
import * as antd from "antd";
import { TenantList } from "./TenantList";
import { RequireRole } from "../../auth/routes";

const setStatus = vi.fn();
const mockSetCurrentTenant = vi.fn();

// Mutable so individual tests can override the role
let mockRoles: string[] = ["SuperAdmin"];

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: mockRoles,
    isAdmin: true,
    ready: true,
    user: { id: "u" },
    login() {},
    logout() {},
    setMockRole() {},
    can: () => true,
    permissions: new Set<string>(),
  }),
}));

vi.mock("../../store/tenant-store", () => ({
  useTenantStore: (sel: (s: { setCurrentTenant: typeof mockSetCurrentTenant }) => unknown) =>
    sel({ setCurrentTenant: mockSetCurrentTenant }),
}));

vi.mock("../../api/queries", () => ({
  useTenants: () => ({
    data: [
      {
        id: "acme",
        slug: "acme-co",
        displayName: "شرکت آلفا",
        status: "active",
        plan: "pro",
        branding: { primaryColor: "#10b981" },
        aiConfig: {},
        quotas: {},
        dataSourceIds: [],
        defaultLocale: "fa-IR",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "beta",
        slug: "beta-log",
        displayName: "Beta Logistics",
        status: "trial",
        plan: "free",
        branding: { primaryColor: "#2563eb" },
        aiConfig: {},
        quotas: {},
        dataSourceIds: [],
        defaultLocale: "en-US",
        createdAt: "",
        updatedAt: "",
      },
    ],
    isLoading: false,
  }),
  useUpsertTenant: () => ({ mutate: vi.fn() }),
  useSetTenantStatus: () => ({ mutate: setStatus }),
}));

function wrap(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

/** Render TenantList behind the same RequireRole gate the router uses */
function wrapWithGate(roles: string[]) {
  mockRoles = roles;
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/admin/tenants"]}>
        <Routes>
          <Route element={<RequireRole allow={["SuperAdmin"]} />}>
            <Route path="/admin/tenants" element={<TenantList />} />
          </Route>
          <Route path="/403" element={<div data-testid="forbidden-403">Forbidden</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe("TenantList", () => {
  beforeEach(() => {
    mockRoles = ["SuperAdmin"];
    mockSetCurrentTenant.mockClear();
    setStatus.mockClear();
    // Auto-confirm Modal.confirm by immediately calling onOk
    vi.spyOn(antd.Modal, "confirm").mockImplementation(
      (cfg: Parameters<typeof antd.Modal.confirm>[0]) => {
        cfg?.onOk?.();
        return { destroy: vi.fn(), update: vi.fn() };
      },
    );
  });

  it("lists all tenants with status", () => {
    wrap(<TenantList />);
    expect(screen.getByText("شرکت آلفا")).toBeInTheDocument();
    expect(screen.getByText("Beta Logistics")).toBeInTheDocument();
  });

  it("suspends a tenant", () => {
    wrap(<TenantList />);
    fireEvent.click(screen.getAllByRole("button", { name: /suspend/i })[0]);
    expect(setStatus).toHaveBeenCalledWith({ id: "acme", status: "suspended" });
  });

  it("calls setCurrentTenant with the tenant id when Switch is clicked", () => {
    wrap(<TenantList />);
    // Click the first Switch button (row: acme)
    fireEvent.click(screen.getAllByRole("button", { name: /switch/i })[0]);
    expect(mockSetCurrentTenant).toHaveBeenCalledWith("acme");
  });

  // Fix 2 — SuperAdmin gate: positive case
  it("renders TenantList for SuperAdmin", () => {
    wrapWithGate(["SuperAdmin"]);
    expect(screen.getByText("شرکت آلفا")).toBeInTheDocument();
  });

  // Fix 2 — SuperAdmin gate: denial case
  it("redirects to /403 when role is TenantAdmin", () => {
    wrapWithGate(["TenantAdmin"]);
    expect(screen.getByTestId("forbidden-403")).toBeInTheDocument();
    expect(screen.queryByText("شرکت آلفا")).not.toBeInTheDocument();
  });
});
