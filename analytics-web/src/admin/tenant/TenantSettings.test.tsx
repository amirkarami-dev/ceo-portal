import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { i18n } from "../../i18n";
import { TenantSettings } from "./TenantSettings";

const mutate = vi.fn();

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: ["TenantAdmin"],
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

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../api/queries", () => ({
  useTenant: () => ({
    data: {
      id: "acme",
      slug: "acme-co",
      displayName: "شرکت آلفا",
      status: "active",
      plan: "pro",
      branding: { primaryColor: "#10b981", productName: "Alpha Reports" },
      aiConfig: {},
      defaultLocale: "fa-IR",
      dataSourceIds: [],
      createdAt: "",
      updatedAt: "",
      quotas: {
        maxUsers: 25,
        maxReports: 100,
        maxDashboards: 20,
        maxDataSources: 5,
        monthlyAiTokens: 5000000,
        monthlyAiCost: 200,
        monthlyExports: 500,
        storageMb: 1024,
      },
    },
    isLoading: false,
  }),
  useUpdateTenant: () => ({ mutate, isPending: false }),
  useTenantUsage: () => ({
    data: {
      period: "2026-06",
      users: 12,
      reports: 90,
      dashboards: 8,
      dataSources: 3,
      aiTokens: 4200000,
      aiCost: 168,
      exports: 120,
      storageMb: 512,
    },
    isLoading: false,
  }),
}));

vi.mock("../../store/ui-store", () => ({
  useUiStore: (sel: (s: { setPreviewPrimaryColor: (c: string | null) => void }) => unknown) =>
    sel({ setPreviewPrimaryColor: vi.fn() }),
}));

function wrap(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("TenantSettings", () => {
  it("renders branding fields and usage bars", () => {
    wrap(<TenantSettings />);
    expect(screen.getByDisplayValue("Alpha Reports")).toBeInTheDocument();
    expect(screen.getByText(/reports/i)).toBeInTheDocument();
  });

  it("persists branding changes on save", async () => {
    wrap(<TenantSettings />);
    const input = screen.getByDisplayValue("Alpha Reports");
    fireEvent.change(input, { target: { value: "Alpha BI" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        branding: expect.objectContaining({ productName: "Alpha BI" }),
      }),
    );
  });
});
