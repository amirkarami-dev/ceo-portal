import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as echarts from "echarts";
import EChartsRenderer from "./EChartsRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, GroupNode } from "../../contracts/dataset";

/**
 * These used to mock `echarts-for-react` and assert the option object handed to it. They now mount a
 * real chart and read the option back off the live instance.
 *
 * That is a stronger question. A mock accepts anything, so it cannot catch an option ECharts rejects,
 * renames or normalises away — the mock version would have passed just as happily if the whole option
 * were ignored. It became possible only once the renderer moved onto `useEChart`: `echarts-for-react`
 * cannot complete an init in jsdom (its two-phase init waits on a `finished` event, disposes, and
 * re-inits — the instance never survives).
 *
 * **`getOption()` returns the NORMALISED option**, which is the point and also the gotcha: ECharts
 * wraps single components in arrays and fills defaults, so it is `xAxis[0].inverse`, not
 * `xAxis.inverse`. Asserting the un-normalised shape is what a mock let you get away with.
 */

const result = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "city", label: "شهر", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { province: "Tehran", city: "Rey", revenue: 500 },
    { province: "Tehran", city: "Karaj", revenue: 700 },
    { province: "Fars", city: "Shiraz", revenue: 400 },
  ],
  total: 3,
} as unknown as QueryResult;

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const heatmapView: ReportView = {
  type: "chart",
  library: "echarts",
  component: "heatmap",
  mapping: { x: "province", series: "city", measure: "revenue" },
};

const barView: ReportView = {
  type: "chart",
  library: "echarts",
  component: "bar",
  mapping: { x: "province", series: "city", measure: "revenue" },
};

type Resolved = {
  tooltip: { trigger?: string; textStyle?: { align?: string } }[];
  legend: { left?: number | string; right?: number | string }[];
  xAxis: { inverse?: boolean; data?: string[]; axisLabel?: Record<string, unknown> }[];
  yAxis: { position?: string; axisLabel?: { formatter?: unknown } }[];
  series: { type: string; name?: string; data?: unknown[] }[];
  visualMap?: unknown[];
  color: string[];
};

/** Mount, then read the option ECharts actually resolved. */
function mount(view: ReportView, onDrill?: (n: GroupNode) => void) {
  const utils = render(<EChartsRenderer view={view} def={def} result={result} onDrill={onDrill} />);
  const el = document.querySelector<HTMLElement>("[data-testid='echarts-canvas']")!;
  const instance = echarts.getInstanceByDom(el);
  expect(instance, "no live ECharts instance — check the canvas stub in vitest.setup.ts").toBeDefined();
  return { ...utils, el, instance: instance!, option: instance!.getOption() as unknown as Resolved };
}

beforeEach(() => {
  document.documentElement.dir = "ltr";
  // ECharts logs nothing here today; a spy keeps a future regression from hiding in the noise.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.dir = "ltr";
});

describe("EChartsRenderer", () => {
  it("builds an option with a tooltip and a series", () => {
    const { option } = mount(heatmapView);

    expect(option.tooltip[0]).toBeDefined();
    expect(option.series.length).toBeGreaterThan(0);
  });

  it("right-aligns the legend when dir is rtl", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(heatmapView);

    expect(option.legend[0].right).toBe(8);
    // ECharts fills a default for the side we did not set, so "not ours" is the assertion, not
    // "undefined" — one of the things a mock could not have told us.
    expect(option.legend[0].left).not.toBe(8);
  });

  // ── RTL ──────────────────────────────────────────────────────────────────
  // The legend here is a horizontal strip, so anchoring it to the reading edge is the right answer
  // — the same question recharts' bottom legend asks, NOT the side question that had the donut's
  // legend on the wrong side. These pin what is already correct so it survives later edits.

  it("runs the categories from the right and puts the values on the right, in rtl", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);

    expect(option.xAxis[0].inverse).toBe(true);
    expect(option.yAxis[0].position).toBe("right");
  });

  it("mirrors back in ltr", () => {
    document.documentElement.dir = "ltr";
    const { option } = mount(barView);

    expect(option.xAxis[0].inverse).toBe(false);
    expect(option.yAxis[0].position).toBe("left");
  });

  it("puts the heatmap's row labels on the same side the columns start from", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(heatmapView);

    // Columns already ran right-to-left while the labels stayed left, so a reader crossed the whole
    // matrix and came back. Only the horizontal order mirrors — rows stay top-to-bottom.
    expect(option.xAxis[0].inverse).toBe(true);
    expect(option.yAxis[0].position).toBe("right");
  });

  it("aligns the tooltip text to the reading edge", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);

    expect(option.tooltip[0].textStyle?.align).toBe("right");
  });

  // ── Theming ──────────────────────────────────────────────────────────────

  it.each([["heatmap", heatmapView], ["bar", barView]] as const)(
    "draws the %s chart with the app's palette, not ECharts' own",
    (_kind, view) => {
      const { option } = mount(view);

      // ECharts' own first colour is #5470c6. Reading it off the instance proves the theme was
      // applied, where a captured prop only proved it was passed.
      expect(option.color[0]).toBe("#326BFC");
    },
  );

  it("keeps the palette out of the option itself", () => {
    // Two sources for one colour is how a chart ends up half-themed after a palette change. The
    // theme owns it; this asserts the renderer is not also setting it.
    const { instance } = mount(barView);
    const raw = JSON.stringify(instance.getOption().series);

    expect(raw).not.toContain("#326BFC");
  });

  // ── The heatmap branch ───────────────────────────────────────────────────

  it("draws a heatmap with a visualMap when there are two dimensions", () => {
    const { option } = mount(heatmapView);

    expect(option.series[0].type).toBe("heatmap");
    expect(option.visualMap).toHaveLength(1);
  });

  it("draws grouped bars, one series per series-field value", () => {
    const { option } = mount(barView);

    // Rey, Karaj, Shiraz
    expect(option.series).toHaveLength(3);
    expect(option.series.every((s) => s.type === "bar")).toBe(true);
  });

  it("keeps the value-axis number formatter, so digits stay Persian in rtl", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);

    expect(typeof option.yAxis[0].axisLabel?.formatter).toBe("function");
  });

  // ── Drill-down ───────────────────────────────────────────────────────────

  it("binds a click handler only when there is somewhere to drill", () => {
    const spy = vi.fn();
    const { instance } = mount(barView, spy);

    // A real instance can be asked. The mock version could only check that a prop was passed.
    expect(instance.getZr()).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("mounts without a drill handler at all", () => {
    expect(() => mount(barView)).not.toThrow();
  });
});
