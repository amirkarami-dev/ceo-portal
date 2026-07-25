import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import type { SessionUser } from "@/contracts";
import type { AppRole } from "@/contracts/rbac";
import { MOCK_PERSONAS, getMockUser, setMockUser } from "./mock-user";

// --- helpers ---------------------------------------------------------------

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="ready">{String(a.ready)}</span>
      <span data-testid="roles">{a.roles.join(",")}</span>
      <span data-testid="admin">{String(a.isAdmin)}</span>
      <span data-testid="canAi">{String(a.can("ai:manage"))}</span>
      <button onClick={() => a.setMockRole(["TenantAdmin"])}>asAdmin</button>
    </div>
  );
}

// --- AuthProvider (mock mode) ----------------------------------------------

describe("AuthProvider (mock mode)", () => {
  beforeEach(() => localStorage.clear());

  it("seeds a mock user and resolves to ready with PowerUser default", () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("ready").textContent).toBe("true");
    expect(screen.getByTestId("roles").textContent).toBe("PowerUser");
    expect(screen.getByTestId("admin").textContent).toBe("false");
    expect(screen.getByTestId("canAi").textContent).toBe("false");
  });

  it("setMockRole switches identity live and recomputes can()/isAdmin", () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => screen.getByText("asAdmin").click());
    expect(screen.getByTestId("roles").textContent).toBe("TenantAdmin");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("canAi").textContent).toBe("true");
  });

  it("SuperAdmin is admin and has ai:manage", () => {
    setMockUser(["SuperAdmin"]);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("canAi").textContent).toBe("true");
  });

  it("Viewer is not admin and cannot ai:manage", () => {
    setMockUser(["Viewer"]);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("admin").textContent).toBe("false");
    expect(screen.getByTestId("canAi").textContent).toBe("false");
  });
});

// --- useAuth shape matches R6 -----------------------------------------------

describe("useAuth shape", () => {
  beforeEach(() => localStorage.clear());

  it("exposes all R6 fields", () => {
    let auth: ReturnType<typeof useAuth> | null = null;
    function Capture() {
      auth = useAuth();
      return null;
    }
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    expect(auth).not.toBeNull();
    const a = auth!;
    expect(typeof a.user).not.toBe("undefined");
    expect(Array.isArray(a.roles)).toBe(true);
    expect(typeof a.isAdmin).toBe("boolean");
    expect(typeof a.ready).toBe("boolean");
    expect(a.permissions instanceof Set).toBe(true);
    expect(typeof a.can).toBe("function");
    expect(typeof a.login).toBe("function");
    expect(typeof a.logout).toBe("function");
    expect(typeof a.setMockRole).toBe("function");
  });

  it("throws when used outside AuthProvider", () => {
    function BadConsumer() {
      useAuth();
      return null;
    }
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<BadConsumer />)).toThrow("useAuth must be used within <AuthProvider>");
    spy.mockRestore();
  });
});

// --- mock-user module -------------------------------------------------------

describe("mock-user", () => {
  beforeEach(() => localStorage.clear());

  it("MOCK_PERSONAS covers all 7 roles", () => {
    const roles: AppRole[] = [
      "SuperAdmin",
      "TenantAdmin",
      "AIManager",
      "ReportDesigner",
      "DashboardDesigner",
      "PowerUser",
      "Viewer",
    ];
    for (const r of roles) {
      expect(MOCK_PERSONAS[r]).toBeDefined();
      expect(MOCK_PERSONAS[r].roles).toContain(r);
    }
  });

  it("getMockUser defaults to PowerUser when localStorage is empty", () => {
    const u = getMockUser();
    expect(u.roles).toContain("PowerUser");
  });

  it("setMockUser persists and returns user with given roles", () => {
    const u = setMockUser(["ReportDesigner"]);
    expect(u.roles).toEqual(["ReportDesigner"]);
    const u2 = getMockUser();
    expect(u2.roles).toEqual(["ReportDesigner"]);
  });

  it("SuperAdmin has null tenantId", () => {
    const u: SessionUser = MOCK_PERSONAS["SuperAdmin"];
    expect(u.tenantId).toBeNull();
  });

  it("non-SuperAdmin has a tenantId", () => {
    const u: SessionUser = MOCK_PERSONAS["Viewer"];
    expect(u.tenantId).toBe("tenant-acme");
  });
});

// --- RequirePermission ------------------------------------------------------

describe("RequirePermission", () => {
  beforeEach(() => localStorage.clear());

  it("renders children when user has the permission", async () => {
    // SuperAdmin has reports:write
    setMockUser(["SuperAdmin"]);
    const { RequirePermission } = await import("./routes");
    render(
      <MemoryRouter>
        <AuthProvider>
          <RequirePermission perm="reports:write">
            <span data-testid="content">secret</span>
          </RequirePermission>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content").textContent).toBe("secret");
  });

  it("redirects to /403 when user lacks the permission", async () => {
    // Viewer does NOT have ai:manage
    setMockUser(["Viewer"]);
    const { RequirePermission } = await import("./routes");
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthProvider>
          <RequirePermission perm="ai:manage">
            <span data-testid="content">secret</span>
          </RequirePermission>
        </AuthProvider>
      </MemoryRouter>,
    );
    // The Navigate component redirects — content should NOT be in the DOM
    expect(screen.queryByTestId("content")).toBeNull();
  });
});

// --- isAdmin logic ----------------------------------------------------------

describe("isAdmin rule", () => {
  beforeEach(() => localStorage.clear());

  it("AIManager is admin (has ai:manage)", () => {
    setMockUser(["AIManager"]);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("admin").textContent).toBe("true");
  });

  it("ReportDesigner is NOT admin", () => {
    setMockUser(["ReportDesigner"]);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("admin").textContent).toBe("false");
  });
});
