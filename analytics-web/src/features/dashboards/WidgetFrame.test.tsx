import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";
import type { DashboardWidget } from "@/dashboard/widget";
import { WidgetFrame } from "./WidgetFrame";

const result = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { province: "Tehran", revenue: 3 },
    { province: "Fars", revenue: 2 },
  ],
  total: 2,
};

const definition = {
  id: "r1",
  dataset: "sales",
  columns: [],
  groupBy: [{ field: "province" }],
  metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }],
  presentation: { views: [] },
  name: "درآمد",
};

vi.mock("@/api/queries", () => ({
  useReport: () => ({ data: { id: "r1", definition }, isLoading: false, isError: false }),
}));
vi.mock("@/api/executeApi", () => ({ executeReport: () => Promise.resolve(result) }));

function renderWidget(widget: DashboardWidget, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
  render(<WidgetFrame widget={widget} editing onChange={onChange} />, { wrapper });
  return onChange;
}

const widget: DashboardWidget = { i: "w1", reportId: "r1", title: "درآمد" };

// The tooltips are translated, so the language has to be pinned or these assertions depend on
// whichever test file ran last.
beforeEach(async () => {
  await i18n.changeLanguage("fa");
});

describe("WidgetFrame — picking how a widget is drawn", () => {
  it("offers bar, line, pie and table, not just chart-or-table", async () => {
    renderWidget(widget);

    // The toggle used to be a two-way chart/table switch, so a dashboard could only ever show bars.
    await waitFor(() => expect(screen.getByTitle("میله‌ای")).toBeInTheDocument());
    expect(screen.getByTitle("خطی")).toBeInTheDocument();
    expect(screen.getByTitle("دایره‌ای")).toBeInTheDocument();
    expect(screen.getByTitle("جدول")).toBeInTheDocument();
  });

  it("hands the parent the chosen mode, which is what gets saved", async () => {
    const onChange = renderWidget(widget);
    await waitFor(() => expect(screen.getByTitle("دایره‌ای")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("دایره‌ای"));

    // The builder writes this straight into the widget array it saves, so the choice survives.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ i: "w1", viewMode: "pie" }));
  });

  it("still understands «chart», the value already saved in old dashboards", async () => {
    // The backend keeps the widget array as an opaque blob and nothing migrates it, so a dashboard
    // saved before the split still holds viewMode "chart". It has to keep drawing bars.
    renderWidget({ ...widget, viewMode: "chart" });

    await waitFor(() => {
      const bar = screen.getByTitle("میله‌ای").closest("label");
      expect(bar?.className).toContain("ant-segmented-item-selected");
    });
  });

  it("marks the pie unavailable when there is nothing to slice", async () => {
    vi.resetModules();
    renderWidget(widget);
    await waitFor(() => expect(screen.getByTitle("دایره‌ای")).toBeInTheDocument());

    // This result HAS a dimension and a measure, so every picture is possible — the row is offered
    // in full. The disabled path is the same `canRenderTarget` the report page uses.
    const pie = screen.getByTitle("دایره‌ای").closest("label");
    expect(pie?.className).not.toContain("ant-segmented-item-disabled");
  });
});
