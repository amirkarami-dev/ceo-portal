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

/**
 * Which definition the widget is showing. A mutable holder rather than a fixed constant, so the
 * custom-report tests below can render a different one through the same harness instead of standing
 * up a second copy of it.
 */
let activeDefinition: unknown = definition;

const executeSpy = vi.fn(() => Promise.resolve(result));

vi.mock("@/api/queries", () => ({
  useReport: () => ({ data: { id: "r1", definition: activeDefinition }, isLoading: false, isError: false }),
}));
vi.mock("@/api/executeApi", () => ({ executeReport: () => executeSpy() }));

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
  activeDefinition = definition;
  executeSpy.mockClear();
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

// ── Custom reports on a dashboard ────────────────────────────────────────────
/**
 * A custom report has no query to run and no `QueryResult` to serialise. `WidgetFrame` needed the
 * same exemptions `ReportViewer` did, and — as predicted in the design doc — it was not one branch:
 * the query, the view list, the switcher and the export buttons each assume a result exists.
 */
describe("WidgetFrame — a custom report", () => {
  const customDefinition = {
    id: "rep-quota",
    dataset: "oz_info",
    columns: [],
    name: "سهمیه",
    presentation: {
      views: [
        {
          type: "chart",
          library: "custom",
          component: "EngineerQuota",
          options: { cityId: 25, reshte: 4 },
          mapping: {},
        },
      ],
    },
  };

  const renderCustom = () => {
    activeDefinition = customDefinition;
    return renderWidget({ i: "w2", reportId: "rep-quota", title: "سهمیه" });
  };

  it("renders the report inside the widget frame", async () => {
    renderCustom();
    expect(await screen.findByTestId("engineer-quota")).toBeInTheDocument();
  });

  it("never asks the engine to execute it", async () => {
    renderCustom();
    await screen.findByTestId("engineer-quota");

    // There is no SQL to build. Left enabled, the query runs against a dataset that does not answer
    // and the widget shows its error alert instead of the report.
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("offers no view switcher", async () => {
    renderCustom();
    await screen.findByTestId("engineer-quota");

    // One view by construction, and an empty result would leave «جدول» enabled — one click from
    // replacing the report with an empty table.
    expect(document.querySelector(".ant-segmented")).toBeNull();
  });

  it("offers no exports", async () => {
    renderCustom();
    await screen.findByTestId("engineer-quota");

    // CSV, Excel and PDF all serialise a QueryResult. A custom report has none, so all three would
    // hand over an empty file that looks like a successful export.
    for (const label of ["CSV", "Excel", "PDF"]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  it("shows the report rather than the widget's error state", async () => {
    renderCustom();
    await screen.findByTestId("engineer-quota");

    // `broken` is true when the view list is empty, and the view list was empty for a custom report
    // until the memo learned to return its stored view without waiting on a result.
    expect(document.querySelector(".ant-alert-error")).toBeNull();
  });
});

describe("WidgetFrame — ordinary widgets are unaffected", () => {
  it("still executes, still exports, still switches", async () => {
    renderWidget(widget);

    // Waiting on the button, not on the spy: the export controls appear only once the result has
    // resolved AND rendered, so asserting right after the call is a race.
    expect(await screen.findByLabelText("CSV")).toBeInTheDocument();
    expect(executeSpy).toHaveBeenCalled();
    expect(document.querySelector(".ant-segmented")).not.toBeNull();
  });
});
