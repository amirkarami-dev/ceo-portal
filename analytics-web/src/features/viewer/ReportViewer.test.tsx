import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports, firstSeededReportId } from "@/api/seed";
import { ReportViewer } from "./ReportViewer";

function renderViewer(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/reports/${id}`]}>
            <Routes>
              <Route path="/reports/:reportId" element={<ReportViewer />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("ReportViewer", () => {
  beforeEach(() => {
    resetMockDb();
    seedReports();
  });

  it("loads a saved report, runs the engine, and renders the canvas + switcher", async () => {
    renderViewer(firstSeededReportId());
    await waitFor(() =>
      expect(screen.getByTestId("result-canvas")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
    // report title from the saved definition is shown in the header (PageHeader uses h3)
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("shows a 'not found' result for an unknown id", async () => {
    renderViewer("nope-does-not-exist");
    await waitFor(() =>
      expect(screen.getByText(/not found|یافت نشد/i)).toBeInTheDocument(),
    );
  });
});
