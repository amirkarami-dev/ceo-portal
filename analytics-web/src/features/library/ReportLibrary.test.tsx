import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports } from "@/api/seed";
import { ReportLibrary } from "./ReportLibrary";

function renderLib() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter>
            <ReportLibrary />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("ReportLibrary", () => {
  beforeEach(() => {
    resetMockDb();
    seedReports();
  });

  it("lists seeded reports in a table", async () => {
    renderLib();
    await waitFor(() =>
      expect(screen.getByRole("table")).toBeInTheDocument(),
    );
    // at least one seeded report name is rendered
    expect(screen.getAllByTestId("report-row").length).toBeGreaterThan(0);
  });

  it("filters rows by the search box — no-match hides all rows", async () => {
    const user = userEvent.setup();
    renderLib();
    await screen.findByRole("table");
    const search = screen.getByRole("searchbox");

    // typing a string that matches nothing should collapse to 0 rows
    await user.type(search, "zzz-no-match");
    await waitFor(() =>
      expect(screen.queryAllByTestId("report-row").length).toBe(0),
    );
  });

  it("filters rows by the search box — positive case keeps matching row", async () => {
    const user = userEvent.setup();
    renderLib();
    await screen.findByRole("table");
    const search = screen.getByRole("searchbox");

    // "درآمد" is a substring of "درآمد ماهانه به تفکیک استان" (rep-revenue only)
    await user.type(search, "درآمد");
    await waitFor(() =>
      expect(screen.getAllByTestId("report-row").length).toBeGreaterThanOrEqual(1),
    );
  });
});
