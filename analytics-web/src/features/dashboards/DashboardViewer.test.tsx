import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { setMockUser } from "@/auth/mock-user";
import { i18n } from "@/i18n";
import { SEED_DASHBOARDS, firstSeededDashboardId, resetMockDb } from "@/api/seed";
import { DashboardViewer } from "./DashboardViewer";

function renderViewer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const dashboardId = firstSeededDashboardId();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/dashboards/${dashboardId}`]}>
            <Routes>
              <Route path="/dashboards/:dashId" element={<DashboardViewer />} />
              <Route path="/dashboards/:dashId/edit" element={<div>Dashboard editor</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardViewer", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("renders the saved dashboard without mutation controls for Viewer", async () => {
    setMockUser(["Viewer"]);
    renderViewer();

    await waitFor(() => expect(screen.getByTestId("dashboard-canvas")).toBeInTheDocument());
    // Both seeded widgets — the ordinary report and the custom one. The count follows the seed
    // rather than being pinned at one: this test is about the absence of mutation controls below,
    // and hardcoding it made adding a second widget to the seed look like a regression.
    expect(screen.getAllByTestId("dashboard-widget")).toHaveLength(SEED_DASHBOARDS[0].widgets.length);
    expect(screen.queryByRole("button", { name: /edit|ویرایش/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/widget menu|منوی ویجت/i)).not.toBeInTheDocument();
  });

  it("shows an explicit edit action for DashboardDesigner", async () => {
    setMockUser(["DashboardDesigner"]);
    renderViewer();

    expect(await screen.findByRole("button", { name: /edit|ویرایش/i })).toBeInTheDocument();
  });
});