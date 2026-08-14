import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as echarts from "echarts";
import EChartsRenderer from "./EChartsRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, GroupNode } from "../../contracts/dataset";

/**
 * The three cartesian kinds, and the parity details that decide whether a chart looks like the one it
 * replaced. Read off a live instance, so the option is ECharts' normalised one.
 */

const result = {
  columns: [
    { key: "month", label: "ماه", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    { key: "cost", label: "هزینه", type: "number", isMetric: true },
  ],
  rows: [
    { month: "1404/01", revenue: 100, cost: 60 },
    { month: "1404/02", revenue: 200, cost: 90 },
  ],
  total: 2,
} as unknown as QueryResult;

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const view = (component: string, mapping: Record<string, unknown> = { x: "month", measure: "revenue" }) =>
  ({ type: "chart", library: "echarts", component, mapping }) as unknown as ReportView;

type Resolved = {
  series: {
    type: string;
    smooth?: boolean;
    smoothMonotone?: string;
    showSymbol?: boolean;
    areaStyle?: Record<string, unknown>;
    stack?: string;
  }[];
  tooltip: { axisPointer?: { type?: string } }[];
  xAxis: { splitLine?: { show?: boolean }; data?: string[]; inverse?: boolean }[];
  yAxis: { splitLine?: { show?: boolean } }[];
};

function mount(v: ReportView, onDrill?: (n: GroupNode) => void) {
  const utils = render(<EChartsRenderer view={v} def={def} result={result} onDrill={onDrill} />);
  const el = document.querySelector<HTMLElement>("[data-testid='echarts-canvas']")!;
  const instance = echarts.getInstanceByDom(el)!;
  expect(instance, "no live instance").toBeDefined();
  return { ...utils, el, instance, option: instance.getOption() as unknown as Resolved };
}

beforeEach(() => {
  document.documentElement.dir = "ltr";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EChartsRenderer — the cartesian kinds", () => {
  it.each([
    ["bar", "bar"],
    ["BarChart", "bar"],
    ["line", "line"],
    ["LineChart", "line"],
    ["area", "line"],
    ["AreaChart", "line"],
  ] as const)("draws %s as an ECharts %s series", (component, seriesType) => {
    const { option } = mount(view(component));

    expect(option.series[0].type).toBe(seriesType);
  });

  // Ported from RechartsRenderer verbatim, including the silent default: a stored view whose component
  // string nothing recognises must still draw something.
  it("falls back to a bar for a component nothing recognises", () => {
    const { option } = mount(view("SomeChartNobodyImplemented"));

    expect(option.series[0].type).toBe("bar");
  });

  /**
   * `smoothMonotone: "x"` is not decoration. Plain `smooth: true` is a different spline that overshoots
   * between points, so a sparse series dips below zero where recharts' monotone curve did not.
   */
  it.each(["line", "area"] as const)("gives %s a monotone curve and no dots", (component) => {
    const { option } = mount(view(component));

    expect(option.series[0].smooth).toBe(true);
    expect(option.series[0].smoothMonotone).toBe("x");
    expect(option.series[0].showSymbol).toBe(false);
  });

  it("fills an area chart, and only an area chart", () => {
    expect(mount(view("area")).option.series[0].areaStyle).toBeDefined();
    cleanup();
    expect(mount(view("line")).option.series[0].areaStyle).toBeUndefined();
  });

  it("overlays areas rather than stacking them, which is what recharts drew", () => {
    const { option } = mount(view("area", { x: "month", y: ["revenue", "cost"] }));

    expect(option.series).toHaveLength(2);
    for (const s of option.series) expect(s.stack).toBeUndefined();
  });

  it("applies the kind to every series, not just the first", () => {
    const { option } = mount(view("line", { x: "month", y: ["revenue", "cost"] }));

    expect(option.series).toHaveLength(2);
    expect(option.series.every((s) => s.type === "line" && s.smoothMonotone === "x")).toBe(true);
  });

  it("applies the kind to a split series too", () => {
    const { option } = mount(view("area", { x: "month", series: "month", measure: "revenue" }));

    expect(option.series.every((s) => s.type === "line" && s.areaStyle)).toBe(true);
  });
});

describe("EChartsRenderer — parity details", () => {
  /**
   * 320, matching recharts' ResponsiveContainer. It was 360, which would have made every dashboard
   * widget's chart 40px taller the moment views started routing here — a layout change disguised as a
   * library change.
   */
  it("is 320px tall, as recharts was", () => {
    const { el } = mount(view("bar"));

    expect(el.style.height).toBe("320px");
  });

  it("highlights a band for bars and a line for curves", () => {
    expect(mount(view("bar")).option.tooltip[0].axisPointer?.type).toBe("shadow");
    cleanup();
    expect(mount(view("line")).option.tooltip[0].axisPointer?.type).toBe("line");
  });

  // recharts' CartesianGrid drew dashed lines on BOTH axes. ECharts hides the category one by default.
  it("draws grid lines on both axes", () => {
    const { option } = mount(view("bar"));

    expect(option.xAxis[0].splitLine?.show).toBe(true);
    expect(option.yAxis[0].splitLine?.show).toBe(true);
  });

  it("dashes them, with recharts' pattern rather than ECharts' longer one", () => {
    const { instance } = mount(view("bar"));
    const y = instance.getOption().yAxis as { splitLine?: { lineStyle?: { type?: unknown } } }[];

    // `[3, 3]`, not `"dashed"` — a visibly different pattern.
    expect(y[0].splitLine?.lineStyle?.type).toEqual([3, 3]);
  });
});

describe("EChartsRenderer — only bars drill", () => {
  const groups = [
    { key: "1404/01", value: "1404/01", rows: [] },
    { key: "1404/02", value: "1404/02", rows: [] },
  ] as unknown as GroupNode[];
  const withGroups = { ...result, groups } as unknown as QueryResult;

  function mountWith(v: ReportView, onDrill: (n: GroupNode) => void) {
    render(<EChartsRenderer view={v} def={def} result={withGroups} onDrill={onDrill} />);
    const el = document.querySelector<HTMLElement>("[data-testid='echarts-canvas']")!;
    return echarts.getInstanceByDom(el)!;
  }

  it("drills from a bar", () => {
    const onDrill = vi.fn();
    const instance = mountWith(view("bar"), onDrill);

    (instance as unknown as { trigger: (n: string, p: unknown) => void }).trigger("click", {
      dataIndex: 1,
    });

    expect(onDrill).toHaveBeenCalledTimes(1);
    expect((onDrill.mock.calls[0][0] as GroupNode).value).toBe("1404/02");
  });

  /**
   * recharts put its `onClick` on `<BarChart>` alone, so line and area never drilled. Giving them one
   * would be a product change wearing a migration's clothes.
   */
  it.each(["line", "area"] as const)("does not drill from %s, as recharts did not", (component) => {
    const onDrill = vi.fn();
    const instance = mountWith(view(component), onDrill);

    (instance as unknown as { trigger: (n: string, p: unknown) => void }).trigger("click", {
      dataIndex: 1,
    });

    expect(onDrill).not.toHaveBeenCalled();
  });
});

/**
 * Dates on a line chart, in RTL.
 *
 * This has **no counterpart on the recharts side to inherit**: `RechartsRenderer.test.tsx` never sets
 * `document.documentElement.dir`, so the entire recharts suite runs LTR and none of its RTL behaviour
 * was ever covered at renderer level. A date axis silently showing `2025-05` instead of «۱۴۰۴/۰۲» is
 * exactly the kind of thing that survives a green suite.
 */
describe("EChartsRenderer — a date axis in RTL", () => {
  const dated = {
    columns: [
      { key: "orderDate", label: "تاریخ", type: "date", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    ],
    rows: [
      { orderDate: "2025-05", revenue: 100 },
      { orderDate: "2025-06", revenue: 140 },
    ],
    total: 2,
  } as unknown as QueryResult;

  function mountDated(component: string, dir: "rtl" | "ltr") {
    document.documentElement.dir = dir;
    render(
      <EChartsRenderer
        view={view(component, { x: "orderDate", measure: "revenue" })}
        def={def}
        result={dated}
      />,
    );
    const el = document.querySelector<HTMLElement>("[data-testid='echarts-canvas']")!;
    return echarts.getInstanceByDom(el)!.getOption() as unknown as Resolved & { xAxis: { data: string[] }[] };
  }

  it("shows Jalali dates on the axis in RTL, not the raw ISO month", () => {
    const option = mountDated("line", "rtl");

    expect(option.xAxis[0].data).toEqual(["۱۴۰۴/۰۲", "۱۴۰۴/۰۳"]);
    expect(option.xAxis[0].data.join()).not.toContain("2025");
  });

  it("leaves the dates Gregorian in LTR", () => {
    const option = mountDated("line", "ltr");

    expect(option.xAxis[0].data).toEqual(["2025-05", "2025-06"]);
  });

  it("runs the date axis right-to-left in RTL, so the newest month is where reading starts", () => {
    const option = mountDated("line", "rtl");

    expect(option.xAxis[0].inverse).toBe(true);
  });

  it("keeps the curve settings on a date series too", () => {
    const option = mountDated("line", "rtl");

    expect(option.series[0].type).toBe("line");
    expect(option.series[0].smoothMonotone).toBe("x");
    expect(option.series[0].showSymbol).toBe(false);
  });
});
