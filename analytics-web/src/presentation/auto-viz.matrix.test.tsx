import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as echarts from "echarts";
import { chooseView } from "./auto-viz";
import { ReportViewRenderer } from "./ReportView";
import { findViewForTarget, targetOfView } from "./view-switching";
import type { QueryResult } from "../contracts/dataset";
import type { ReportDefinition } from "../contracts/report-definition";
import type { SemanticModel } from "../contracts/semantic";

/**
 * A matrix report, end to end: `chooseView` → the renderer → the switcher.
 *
 * `auto-viz.test.ts` asks what the rule *returns*; this file asks what the returned view *draws*, and
 * that gap is where the defect lived. Rule 5 emitted `component: "EChart"` with the second dimension
 * in `mapping.y`, and every unit test passed because none of them rendered it. On a live instance the
 * series was `[{ type: "bar", name: "Province", data: [0, 0] }]` — the measure dropped, the dimension
 * plotted as a value, `Number("Tehran")` drawn as zero. An all-zero chart, silently, for every
 * two-dimension report in the product.
 *
 * So the assertions here are deliberately about the rendered option and not the mapping.
 */

const semantic = {
  id: "model-sales", tenantId: "global", version: 1, defaultLocale: "fa-IR",
  name: { "fa-IR": "فروش", "en-US": "Sales" },
  entities: [{
    id: "sales", source: "sales", name: { "fa-IR": "فروش", "en-US": "Sales" },
    defaultDateField: "orderDate",
    fields: [
      { id: "province", column: "province", type: "string", role: "dimension", label: { "fa-IR": "استان", "en-US": "Province" } },
      { id: "orderDate", column: "orderDate", type: "date", role: "date", label: { "fa-IR": "تاریخ", "en-US": "Date" } },
      { id: "revenue", column: "revenue", type: "number", role: "measure", label: { "fa-IR": "درآمد", "en-US": "Revenue" } },
    ],
  }],
} as unknown as SemanticModel;

const def = {
  id: "r1", schemaVersion: "1.0", name: "matrix", dataset: "sales", tags: [], columns: [],
  groupBy: [{ field: "orderDate" }, { field: "province" }],
  metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const result = {
  columns: [
    { key: "orderDate", label: "ماه", type: "date", isMetric: false },
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { orderDate: "2025-01", province: "Tehran", revenue: 1200 },
    { orderDate: "2025-01", province: "Fars", revenue: 800 },
    { orderDate: "2025-02", province: "Tehran", revenue: 1500 },
    { orderDate: "2025-02", province: "Fars", revenue: 900 },
  ],
  total: 4,
} as unknown as QueryResult;

type Resolved = {
  series: { type: string; name?: string; data?: unknown[] }[];
  xAxis: { data?: unknown[] }[];
  yAxis: { data?: unknown[] }[];
  visualMap?: unknown[];
};

function drawChosen() {
  const views = chooseView(def, result, semantic);
  render(<ReportViewRenderer view={views[0]} def={def} result={result} />);
  const el = document.querySelector<HTMLElement>("[data-testid='echarts-canvas']")!;
  const instance = echarts.getInstanceByDom(el);
  expect(instance, "no live instance — the matrix view did not render a chart at all").toBeDefined();
  return { views, option: instance!.getOption() as unknown as Resolved };
}

beforeEach(() => {
  document.documentElement.dir = "ltr";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a matrix report, from rule to pixels", () => {
  it("draws a heatmap, not a bar chart", () => {
    const { option } = drawChosen();
    expect(option.series[0].type).toBe("heatmap");
  });

  it("plots the measure, not the dimension", () => {
    const { option } = drawChosen();

    // The assertion that would have caught the original bug. Every datum is [x, y, value]; the
    // values are the revenues, and not one of them is the zero a NaN becomes.
    const values = (option.series[0].data as [number, number, number][]).map((d) => d[2]);
    expect(values.sort((a, b) => a - b)).toEqual([800, 900, 1200, 1500]);

    // And the series is named after the measure. Asserted as "not a dimension" rather than as a
    // literal, because the name comes from the label composer (`sum` + revenue → "Sum" for a metric
    // with no label of its own) and that chain is not what this test is about. What matters is that
    // it is no longer «استان» / "Province" — a dimension's label on a value series was the visible
    // symptom of the bug.
    expect(option.series[0].name).not.toBe("استان");
    expect(option.series[0].name).not.toBe("Province");
  });

  it("spreads both dimensions across the two axes", () => {
    const { option } = drawChosen();

    expect(option.xAxis[0].data).toHaveLength(2); // two months
    expect(option.yAxis[0].data).toHaveLength(2); // two provinces
    // A heatmap needs a colour scale or every cell paints the same.
    expect(option.visualMap).toBeDefined();
  });

  it("tells the switcher honestly that it has no button", () => {
    const { views } = drawChosen();

    // `undefined` rather than a guess. The ladder this replaced ended in `"line"`, so a matrix chart
    // lit up the line button while drawing something else entirely.
    expect(targetOfView(views[0])).toBeUndefined();
    for (const target of ["bar", "line", "pie"] as const) {
      expect(findViewForTarget(views, target)).toBe(-1);
    }
    // The Table companion is still findable, so the switcher is not inert.
    expect(findViewForTarget(views, "table")).toBeGreaterThan(-1);
  });
});
