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
  tooltip: { trigger?: string; confine?: boolean; formatter?: unknown }[];
  legend: {
    left?: number | string;
    right?: number | string;
    bottom?: number | string;
    selectedMode?: boolean | string;
  }[];
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

  // ── The tooltip ──────────────────────────────────────────────────────────
  // This used to assert `tooltip.textStyle.align === "right"`, which guarded nothing. ECharts' own
  // markup carries `float:right` on the value and `margin-left:2px` on the name — physical properties
  // that `align` cannot reach — so in RTL the value floats to the reading edge and the tooltip reads
  // value-then-name, reversing recharts. Measured in the step 1 spike. Hence a custom formatter.

  it("builds its own tooltip markup rather than trusting ECharts' layout", () => {
    const { option } = mount(barView);

    expect(typeof option.tooltip[0].formatter).toBe("function");
  });

  it("puts the series name before the value, in reading order", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);
    const html = (option.tooltip[0].formatter as (p: unknown) => string)([
      { marker: "<span></span>", seriesName: "تعداد پروژه", axisValueLabel: "عادی", value: 6550 },
    ]);

    expect(html).toContain("تعداد پروژه");
    // Name first, value second — the order recharts had and ECharts reverses.
    expect(html.indexOf("تعداد پروژه")).toBeLessThan(html.indexOf("۶٬۵۵۰"));
  });

  it("uses logical CSS, so one formatter serves both directions", () => {
    const { option } = mount(barView);
    const html = (option.tooltip[0].formatter as (p: unknown) => string)([
      { seriesName: "s", axisValueLabel: "c", value: 1 },
    ]);

    expect(html).toContain("margin-inline-start");
    // The two properties that caused the problem must not reappear.
    expect(html).not.toContain("float:right");
    expect(html).not.toContain("margin-left");
  });

  it("formats the value through the app's number formatter", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);
    const html = (option.tooltip[0].formatter as (p: unknown) => string)([
      { seriesName: "s", axisValueLabel: "c", value: 1234 },
    ]);

    // Persian digits and the Persian thousands separator, not "1,234".
    expect(html).toContain("۱٬۲۳۴");
    expect(html).not.toContain("1,234");
  });

  it("reads the value out of a heatmap datum, which is a triple", () => {
    const { option } = mount(heatmapView);
    const html = (option.tooltip[0].formatter as (p: unknown) => string)({
      seriesName: "s",
      name: "c",
      value: [0, 1, 4200],
    });

    expect(html).toContain("4,200");
  });

  it("escapes category values, which are data", () => {
    const { option } = mount(barView);
    const html = (option.tooltip[0].formatter as (p: unknown) => string)([
      { seriesName: "<img src=x>", axisValueLabel: "a&b", value: 1 },
    ]);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("a&amp;b");
  });

  it("confines the tooltip, so it cannot spill out of a scrolling widget body", () => {
    const { option } = mount(barView);

    expect(option.tooltip[0].confine).toBe(true);
  });

  // ── The legend ───────────────────────────────────────────────────────────

  it("puts the legend underneath, starting from the reading edge", () => {
    document.documentElement.dir = "rtl";
    const { option } = mount(barView);

    // ECharts defaults a legend to top-centre; recharts put it underneath.
    expect(option.legend[0].bottom).toBe(0);
    expect(option.legend[0].right).toBe(8);
  });

  it("mirrors the legend in ltr", () => {
    document.documentElement.dir = "ltr";
    const { option } = mount(barView);

    expect(option.legend[0].left).toBe(8);
  });

  /**
   * ECharts defaults `selectedMode` to true, so one click on the only legend entry empties the chart —
   * and because we setOption with notMerge, the next re-render puts it back. That reads as a glitch.
   */
  it("does not let a single-series legend blank the chart", () => {
    const single: ReportView = {
      type: "chart",
      library: "echarts",
      component: "bar",
      mapping: { x: "province", measure: "revenue" },
    };
    const { option } = mount(single);

    expect(option.series).toHaveLength(1);
    expect(option.legend[0].selectedMode).toBe(false);
  });

  it("keeps legend toggling where there is more than one series", () => {
    const { option } = mount(barView);

    expect(option.series.length).toBeGreaterThan(1);
    expect(option.legend[0].selectedMode).toBe(true);
  });

  // ── Axis labels ──────────────────────────────────────────────────────────

  /**
   * `interval: 0` forced every label and drew them on top of each other: measured at 360px with six
   * real province names, the plot gives 44px per category against label widths up to 98.3px.
   */
  it("no longer forces every axis label to be drawn", () => {
    const { option } = mount(barView);

    expect(option.xAxis[0].axisLabel?.interval).not.toBe(0);
    expect(option.xAxis[0].axisLabel?.hideOverlap).toBe(true);
  });

  it("gives the heatmap's colour scale our number formatter", () => {
    const { option } = mount(heatmapView);
    const vm = (option as unknown as { visualMap: { formatter?: unknown }[] }).visualMap;

    // Its min/max labels fall back to toFixed — ASCII digits, no grouping, on a Persian page.
    expect(typeof vm[0].formatter).toBe("function");
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
