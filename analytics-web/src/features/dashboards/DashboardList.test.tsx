import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { setMockUser } from "@/auth/mock-user";
import { i18n } from "@/i18n";
import { resetMockDb, seedDashboards } from "@/api/seed";
import { DashboardList } from "./DashboardList";

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter>
            <DashboardList />
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
});
