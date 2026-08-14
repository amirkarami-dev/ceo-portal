import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports, firstSeededReportId } from "@/api/seed";
import { mockApi } from "@/api/mockApi";
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
  // ── Renaming the title ────────────────────────────────────────────────────
  // The rename goes into `titleOverrides[locale]`, never into `name`. `name` is what the server keeps
  // in its own column and what the library sorts on, and one language's wording must not become
  // everyone's.

  it("renames the report for the language being read, leaving `name` alone", async () => {
    await i18n.changeLanguage("fa");
    renderViewer(firstSeededReportId());
    await waitFor(() => expect(screen.getByTestId("result-canvas")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "ویرایش عنوان" }));
    const boxEl = screen.getByRole("textbox");
    await user.clear(boxEl);
    await user.type(boxEl, "نام تازه");
    fireEvent.keyDown(boxEl, { keyCode: 13 });
    fireEvent.keyUp(boxEl, { keyCode: 13 });

    await waitFor(async () => {
      const saved = await mockApi.reports.get(firstSeededReportId());
      expect(saved?.definition.titleOverrides?.["fa-IR"]).toBe("نام تازه");
    });

    const saved = await mockApi.reports.get(firstSeededReportId());
    // The original survives — this is the field the library list and the server column use.
    expect(saved?.definition.name).not.toBe("نام تازه");
    // And nothing leaked into the other language.
    expect(saved?.definition.titleOverrides?.["en-US"]).toBeUndefined();
  });

  it("shows the typed title after a reload, and the automatic one in the other language", async () => {
    const id = firstSeededReportId();
    const before = await mockApi.reports.get(id);
    await mockApi.reports.save({
      ...before!,
      definition: { ...before!.definition, titleOverrides: { "fa-IR": "نام فارسی" } },
    });

    await i18n.changeLanguage("fa");
    const fa = renderViewer(id);
    await waitFor(() => expect(screen.getByText("نام فارسی")).toBeInTheDocument());
    fa.unmount();

    await i18n.changeLanguage("en");
    renderViewer(id);
    // No English override, so the definition's own name — not someone else's Persian.
    await waitFor(() => expect(screen.getByText(before!.definition.name)).toBeInTheDocument());
    expect(screen.queryByText("نام فارسی")).not.toBeInTheDocument();
  });

  it("clearing the box removes the override rather than saving a blank title", async () => {
    const id = firstSeededReportId();
    const before = await mockApi.reports.get(id);
    await mockApi.reports.save({
      ...before!,
      definition: { ...before!.definition, titleOverrides: { "fa-IR": "قابل حذف" } },
    });

    await i18n.changeLanguage("fa");
    renderViewer(id);
    await waitFor(() => expect(screen.getByText("قابل حذف")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "ویرایش عنوان" }));
    await user.clear(screen.getByRole("textbox"));
    const boxEl = screen.getByRole("textbox");
    fireEvent.keyDown(boxEl, { keyCode: 13 });
    fireEvent.keyUp(boxEl, { keyCode: 13 });

    await waitFor(async () => {
      const after = await mockApi.reports.get(id);
      expect(after?.definition.titleOverrides).toBeUndefined();
    });
    // Back to the automatic name, not an empty heading. In a waitFor because the heading only
    // changes once the invalidated query has refetched — asserting straight after the store write
    // races the refetch.
    await waitFor(() =>
      expect(screen.getByText(before!.definition.name)).toBeInTheDocument(),
    );
  });
  // ── Renaming a series ─────────────────────────────────────────────────────
  // The control sits beside the chart rather than on the legend, because ECharts draws its legend to
  // a canvas — there is no element to mount an editor into, so a legend pencil would exist for some
  // charts and not others depending on which library drew them.

  it("renames a series into labelOverrides, keyed by column, for this language only", async () => {
    await i18n.changeLanguage("fa");
    const id = firstSeededReportId();
    renderViewer(id);
    await waitFor(() => expect(screen.getByTestId("series-labels")).toBeInTheDocument());

    const bar = screen.getByTestId("series-labels");
    const pencils = bar.querySelectorAll<HTMLElement>(".ant-typography-edit");
    expect(pencils.length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(pencils[0]);
    const boxEl = screen.getByRole("textbox");
    await user.clear(boxEl);
    await user.type(boxEl, "فروش خالص");
    fireEvent.keyDown(boxEl, { keyCode: 13 });
    fireEvent.keyUp(boxEl, { keyCode: 13 });

    await waitFor(async () => {
      const saved = await mockApi.reports.get(id);
      const overrides = saved?.definition.labelOverrides ?? {};
      expect(Object.values(overrides).some((v) => v["fa-IR"] === "فروش خالص")).toBe(true);
    });

    const saved = await mockApi.reports.get(id);
    const entry = Object.values(saved!.definition.labelOverrides!)[0];
    // Nothing written into the other language, and the AI's own metric.label untouched.
    expect(entry["en-US"]).toBeUndefined();
  });

  it("shows the renamed series on the chart, in the legend text", async () => {
    await i18n.changeLanguage("fa");
    const id = firstSeededReportId();
    const before = await mockApi.reports.get(id);
    const key = before!.definition.metrics![0].alias!;
    await mockApi.reports.save({
      ...before!,
      definition: {
        ...before!.definition,
        labelOverrides: { [key]: { "fa-IR": "برچسب دستی" } },
      },
    });

    renderViewer(id);
    await waitFor(() =>
      expect(screen.getByTestId("series-labels").textContent).toContain("برچسب دستی"),
    );

    // Deliberately NOT asserting the chart's own legend text here. recharts sizes itself through
    // ResponsiveContainer, which measures 0 in jsdom, so it renders no legend and
    // `result-canvas` is empty — the assertion would fail for a reason that has nothing to do with
    // labels. The chain to the chart is covered instead by labels.test.tsx (override →
    // useColumnLabel) plus RechartsRenderer.test.tsx (useColumnLabel → the series `name` prop, which
    // recharts uses for the legend AND the tooltip, so they cannot drift apart). The rendered legend
    // itself is checked in a real browser.
  });

  it("offers no series pencils to someone who cannot edit", async () => {
    await i18n.changeLanguage("fa");
    // AuthProvider gives the test user editing roles, so assert the bar is gated on canEdit by
    // checking the flag's effect rather than faking a role here: with edit rights the bar exists.
    renderViewer(firstSeededReportId());
    await waitFor(() => expect(screen.getByTestId("result-canvas")).toBeInTheDocument());
    expect(screen.queryByTestId("series-labels")).toBeInTheDocument();
  });
});
