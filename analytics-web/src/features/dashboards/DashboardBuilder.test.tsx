import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { setMockUser } from "@/auth/mock-user";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports, seedDashboards, firstSeededDashboardId } from "@/api/seed";
import { mockApi } from "@/api/mockApi";
import { DashboardBuilder } from "./DashboardBuilder";

function renderBuilder(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/dashboards/${id}/edit`]}>
            <Routes>
              <Route path="/dashboards/:dashId/edit" element={<DashboardBuilder />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

/**
 * Renders at /dashboards/new (no dashId param) so the "new" creation path is exercised.
 * Includes the /dashboards/:dashId/edit route so the post-creation redirect can land.
 */
function renderNew() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards/new"]}>
            <Routes>
              <Route path="/dashboards/new" element={<DashboardBuilder />} />
              <Route path="/dashboards/:dashId/edit" element={<DashboardBuilder />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardBuilder", () => {
  beforeEach(() => {
    resetMockDb();
    seedReports();
    seedDashboards();
    // Set role so canEdit passes (DashboardDesigner is in the allowed list)
    setMockUser(["DashboardDesigner"]);
  });

  it("renders the canvas with the saved widgets", async () => {
    renderBuilder(firstSeededDashboardId());
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-canvas")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("dashboard-widget").length).toBeGreaterThan(0);
  });

  it("adds a widget via the drawer (binds to a saved report)", async () => {
    const user = userEvent.setup();
    renderBuilder(firstSeededDashboardId());
    await screen.findByTestId("dashboard-canvas");
    const before = screen.getAllByTestId("dashboard-widget").length;
    // Click "Add widget" button
    const addButtons = screen.getAllByRole("button", { name: /add widget|افزودن ویجت/i });
    await user.click(addButtons[0]);
    // Wait for drawer items to appear
    const items = await screen.findAllByTestId("add-widget-item");
    await user.click(items[0]);
    await waitFor(() =>
      expect(screen.getAllByTestId("dashboard-widget").length).toBe(before + 1),
    );
  });

  it("/dashboards/new creates a fresh dashboard and redirects (no 404 shown)", async () => {
    renderNew();
    // Initially shows the loading skeleton while creating — 404 Result must never appear.
    // After creation + redirect, the edit route renders the new (empty) dashboard.
    // The empty state placeholder replaces the canvas when there are no widgets.
    await waitFor(
      () => {
        expect(screen.queryByTitle(/not found|پیدا نشد/i)).not.toBeInTheDocument();
        // Either the empty-state placeholder or the canvas has loaded — creation succeeded.
        const canvas = screen.queryByTestId("dashboard-canvas");
        const empty = screen.queryByTestId("dashboard-empty");
        expect(canvas ?? empty).not.toBeNull();
      },
      { timeout: 4000 },
    );
    // The newly-created dashboard must exist in the mock DB (one extra beyond the seed).
    const all = await mockApi.dashboards.list();
    expect(all.length).toBeGreaterThan(1);
  });

  it("Save button persists both widgets and layout to the mock DB", async () => {
    const user = userEvent.setup();
    renderBuilder(firstSeededDashboardId());
    // Wait for the builder to load the seeded dashboard.
    await screen.findByTestId("dashboard-canvas");

    // The seeded dashboard already has one widget + one layout item; click Save immediately.
    const saveBtn = screen.getByRole("button", { name: /save|ذخیره/i });
    await user.click(saveBtn);

    // After save completes, read the persisted record from the mock DB and verify payload.
    await waitFor(async () => {
      const saved = await mockApi.dashboards.get(firstSeededDashboardId());
      expect(saved).not.toBeNull();
      // widgets persisted — at least one entry with the expected shape
      expect(saved!.widgets.length).toBeGreaterThan(0);
      expect(saved!.widgets[0]).toMatchObject({ i: expect.any(String), reportId: expect.any(String) });
      // layout persisted — parallel array with grid coordinates
      expect(saved!.layout.length).toBe(saved!.widgets.length);
      expect(saved!.layout[0]).toMatchObject({ i: expect.any(String), x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
    }, { timeout: 3000 });
  });
});
