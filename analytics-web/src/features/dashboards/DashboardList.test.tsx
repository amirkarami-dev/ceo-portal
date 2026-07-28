import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { setMockUser } from "@/auth/mock-user";
import { i18n } from "@/i18n";
import { resetMockDb, seedDashboards, SEED_DASHBOARDS } from "@/api/seed";
import type { DashboardRecord } from "@/api/queries";
import { DashboardList } from "./DashboardList";

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderList(initialEntry = "/dashboards") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route
                path="/dashboards"
                element={
                  <>
                    <DashboardList />
                    <LocationProbe />
                  </>
                }
              />
              <Route path="/dashboards/:dashId" element={<div>Read-only dashboard</div>} />
              <Route path="/dashboards/:dashId/edit" element={<div>Dashboard editor</div>} />
              <Route path="/dashboards/new" element={<div>New dashboard</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardList", () => {
  beforeEach(() => {
    resetMockDb();
    seedDashboards();
    setMockUser(["DashboardDesigner"]);
  });

  it("renders seeded dashboards as cards", async () => {
    renderList();
    await waitFor(() =>
      expect(screen.getAllByTestId("dashboard-card").length).toBeGreaterThan(0),
    );
  });

  it("shows New dashboard button for DashboardDesigner", async () => {
    renderList();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /new dashboard|داشبورد جدید/i }),
      ).toBeInTheDocument(),
    );
  });

  it("selects a dashboard card and shows its widgets without leaving the landing page", async () => {
    const user = userEvent.setup();
    renderList();

    const cards = await screen.findAllByTestId("dashboard-card");
    const firstCardButton = within(cards[0]).getByRole("button", { pressed: true });
    await user.click(firstCardButton);

    expect(await screen.findByTestId("dashboard-preview")).toBeInTheDocument();
    expect(screen.getAllByTestId("dashboard-preview-widget")).toHaveLength(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboards");
    expect(screen.queryByText("Read-only dashboard")).not.toBeInTheDocument();
  });

  it("lets dashboard designers drag, resize, and save the selected dashboard layout", async () => {
    renderList();

    const preview = await screen.findByTestId("dashboard-preview");
    expect(preview).not.toHaveClass("dashboard-canvas--readonly");
    expect(within(preview).getByTestId("dashboard-canvas")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByRole("button", { name: /save|ذخیره/i })).toBeEnabled();
  });

  it("filters Mine by the authenticated subject id", async () => {
    const user = userEvent.setup();
    const currentUser = {
      ...setMockUser(["DashboardDesigner"]),
      id: "748ec011-1476-4aa6-bfac-24837ca6076a",
    };
    localStorage.setItem("report.mockUser", JSON.stringify(currentUser));
    const mine = { ...SEED_DASHBOARDS[0], id: "mine", name: "Mine", ownerName: currentUser.id };
    const other = { ...SEED_DASHBOARDS[0], id: "other", name: "Other", ownerName: "another-user" };
    localStorage.setItem("report.db.dashboards", JSON.stringify([mine, other]));
    renderList();

    await user.click(await screen.findByRole("tab", { name: /mine|داشبوردهای من/i }));

    await waitFor(() => expect(screen.getAllByTestId("dashboard-card")).toHaveLength(1));
    expect(within(screen.getByTestId("dashboard-card")).getByText("Mine")).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-card")).getByText(currentUser.name)).toBeInTheDocument();
    expect(screen.queryByText(currentUser.id)).not.toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
  });

  it("shows the eight most recently updated dashboards", async () => {
    const user = userEvent.setup();
    const dashboards: DashboardRecord[] = Array.from({ length: 10 }, (_, index) => ({
      ...SEED_DASHBOARDS[0],
      id: String(index),
      name: `Board ${index}`,
      updatedAt: new Date(2026, 0, index + 1).toISOString(),
    }));
    localStorage.setItem("report.db.dashboards", JSON.stringify(dashboards));
    renderList();

    await user.click(await screen.findByRole("tab", { name: /recent|اخیر/i }));

    await waitFor(() => expect(screen.getAllByTestId("dashboard-card")).toHaveLength(8));
    const cards = screen.getAllByTestId("dashboard-card");
    expect(within(cards[0]).getByText("Board 9")).toBeInTheDocument();
    expect(screen.queryByText("Board 0")).not.toBeInTheDocument();
    expect(screen.queryByText("Board 1")).not.toBeInTheDocument();
  });

  it("hides create controls from Viewer", async () => {
    setMockUser(["Viewer"]);
    renderList();

    await screen.findAllByTestId("dashboard-card");
    expect(screen.queryByRole("button", { name: /new dashboard|داشبورد جدید/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-preview")).toHaveClass("dashboard-canvas--readonly");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
