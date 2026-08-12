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
import { DashboardsPage } from "./DashboardsPage";

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderPage(initialEntry = "/dashboards") {
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
                    <DashboardsPage />
                    <LocationProbe />
                  </>
                }
              />
              <Route path="/dashboards/:dashId/edit" element={<div>Dashboard editor</div>} />
              <Route path="/manage-dashboards" element={<div>Manage dashboards</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function twoBoards() {
  const a = { ...SEED_DASHBOARDS[0], id: "a", name: "Board A" };
  const b = { ...SEED_DASHBOARDS[0], id: "b", name: "Board B" };
  localStorage.setItem("report.db.dashboards", JSON.stringify([a, b] satisfies DashboardRecord[]));
}

describe("DashboardsPage", () => {
  beforeEach(() => {
    resetMockDb();
    seedDashboards();
    setMockUser(["DashboardDesigner"]);
  });

  // The four things that moved to /manage-dashboards. If any of them come back,
  // the widgets go below the fold again, which is the whole point of the split.
  it("shows no hero, no search, no create button and no cards", async () => {
    renderPage();
    await screen.findByTestId("dashboard-preview");

    expect(document.querySelector(".dash-hero")).toBeNull();
    expect(document.querySelector(".dash-list__grid")).toBeNull();
    expect(screen.queryAllByTestId("dashboard-card")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /new dashboard|داشبورد جدید/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: /search|جستجو/i }),
    ).not.toBeInTheDocument();
  });

  it("renders one tab per dashboard and shows the active one's widgets", async () => {
    twoBoards();
    renderPage();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tabEl) => tabEl.textContent)).toEqual(["Board A", "Board B"]);
    expect(screen.getAllByTestId("dashboard-preview-widget").length).toBeGreaterThan(0);
  });

  it("opens the dashboard named in ?d= rather than the first one", async () => {
    twoBoards();
    renderPage("/dashboards?d=b");

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Board B" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("falls back to the first tab when ?d= names a dashboard that is gone", async () => {
    twoBoards();
    renderPage("/dashboards?d=deleted-long-ago");

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Board A" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("puts the chosen tab in the URL so it can be linked and survives a reload", async () => {
    const user = userEvent.setup();
    twoBoards();
    renderPage();

    await user.click(await screen.findByRole("tab", { name: "Board B" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboards?d=b"),
    );
  });

  // Requested explicitly: this page is for looking at a dashboard, so a stray drag
  // must not move anything until the switch is thrown.
  it("starts with edit mode off, and save disabled until it is turned on", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("dashboard-preview");

    const editMode = screen.getByRole("switch");
    expect(editMode).not.toBeChecked();
    expect(screen.getByRole("button", { name: /save|ذخیره/i })).toBeDisabled();

    await user.click(editMode);

    expect(editMode).toBeChecked();
    expect(screen.getByRole("button", { name: /save|ذخیره/i })).toBeEnabled();
  });

  it("turns edit mode back off when a different dashboard is chosen", async () => {
    const user = userEvent.setup();
    twoBoards();
    renderPage();

    await user.click(await screen.findByRole("switch"));
    expect(screen.getByRole("switch")).toBeChecked();

    await user.click(screen.getByRole("tab", { name: "Board B" }));

    await waitFor(() => expect(screen.getByRole("switch")).not.toBeChecked());
  });

  it("gives a Viewer no edit switch and no save button", async () => {
    setMockUser(["Viewer"]);
    renderPage();

    await screen.findByTestId("dashboard-preview");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save|ذخیره/i })).not.toBeInTheDocument();
  });

  it("points someone who can manage at the manage page when there is nothing to show", async () => {
    localStorage.setItem("report.db.dashboards", JSON.stringify([]));
    renderPage();

    expect(
      await screen.findByRole("button", { name: /manage dashboards|مدیریت داشبوردها/i }),
    ).toBeInTheDocument();
  });

  it("keeps the dashboard name available to a screen reader", async () => {
    twoBoards();
    renderPage();

    const section = await screen.findByTestId("dashboard-preview");
    expect(within(section).getByRole("heading", { level: 1 })).toHaveTextContent("Board A");
  });
});
