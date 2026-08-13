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


/** antd decides the Descriptions column count from media queries, so the test has to
 *  say which screen it means. The global stub answers false to everything, which is
 *  the narrowest breakpoint — a phone. */
function viewport(kind: "desktop" | "phone") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    // antd asks `(max-width: 575px)` for xs and `(min-width: …)` for everything
    // above it. Answering false to all of them is not a phone — it is no breakpoint
    // at all, and antd then falls back to its default column count.
    matches: kind === "desktop" ? /min-width/.test(query) : /max-width/.test(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe("ReportViewer", () => {
  beforeEach(() => {
    resetMockDb();
    seedReports();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  // Three columns in 287px gave each fact 96px and made them wrap downwards rather
  // than across — «آخرین بروزرسانی» alone was 198px tall, about a quarter of the
  // screen for one date.
  it("stacks the metadata one fact per row on a phone", async () => {
    viewport("phone");
    const { container } = renderViewer(firstSeededReportId());
    await waitFor(() => expect(container.querySelector(".ant-descriptions-row")).toBeTruthy());

    const rows = [...container.querySelectorAll(".ant-descriptions-row")];
    expect(rows.length).toBe(3);
    rows.forEach((tr) =>
      expect(tr.querySelectorAll(".ant-descriptions-item").length).toBe(1),
    );
  });

  it("keeps all three across one row on a desktop", async () => {
    viewport("desktop");
    const { container } = renderViewer(firstSeededReportId());
    await waitFor(() => expect(container.querySelector(".ant-descriptions-row")).toBeTruthy());

    const rows = [...container.querySelectorAll(".ant-descriptions-row")];
    expect(rows.length).toBe(1);
    expect(rows[0].querySelectorAll(".ant-descriptions-item").length).toBe(3);
  });
});
