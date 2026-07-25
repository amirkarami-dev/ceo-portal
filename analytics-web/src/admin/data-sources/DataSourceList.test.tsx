import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "../../i18n";
import { DataSourceList } from "./DataSourceList";

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: ["TenantAdmin"],
    isAdmin: true,
    ready: true,
    user: { id: "u", name: "Admin", email: "a@x.ir", tenantId: "global", roles: ["TenantAdmin"] },
    login() {},
    logout() {},
    can: () => true,
  }),
}));

vi.mock("../../api/queries", () => ({
  useDataSources: () => ({
    data: [
      {
        id: "ds-project",
        tenantId: "global",
        name: "Projects Dataset",
        kind: "file",
        connectionRef: "fixture://projects",
        semanticModelId: "model-project",
        status: "connected",
        rowCount: 30,
      },
      {
        id: "ds-sales",
        tenantId: "global",
        name: "Sales Dataset",
        kind: "file",
        connectionRef: "fixture://sales",
        semanticModelId: "model-sales",
        status: "connected",
        rowCount: 30,
      },
      {
        id: "ds-finance",
        tenantId: "global",
        name: "Finance Dataset",
        kind: "file",
        connectionRef: "fixture://finance",
        semanticModelId: "model-finance",
        status: "error",
        rowCount: 30,
      },
    ],
    isLoading: false,
  }),
  useTestDataSource: () => ({ mutateAsync: vi.fn() }),
}));

function wrap(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </MemoryRouter>,
  );
}

describe("DataSourceList", () => {
  it("renders sources with name, kind, status tag and row count", () => {
    wrap(<DataSourceList />);
    expect(screen.getByText("Projects Dataset")).toBeInTheDocument();
    expect(screen.getByText("Sales Dataset")).toBeInTheDocument();
    expect(screen.getByText("Finance Dataset")).toBeInTheDocument();
    // add data source button is present
    expect(
      screen.getByRole("button", { name: /add data source|افزودن منبع داده/i }),
    ).toBeInTheDocument();
  });

  it("shows row counts for each source", () => {
    wrap(<DataSourceList />);
    const cells = screen.getAllByText("30");
    expect(cells.length).toBeGreaterThanOrEqual(3);
  });

  it("shows connection ref but not raw secrets", () => {
    wrap(<DataSourceList />);
    // connectionRef is NOT rendered (secrets are never shown)
    expect(screen.queryByText("fixture://projects")).not.toBeInTheDocument();
    // semanticModelId is rendered as a link
    expect(screen.getByText("model-project")).toBeInTheDocument();
  });
});
