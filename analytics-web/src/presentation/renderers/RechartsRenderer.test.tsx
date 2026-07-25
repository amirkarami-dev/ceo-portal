import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { aggregateByCategory } from "./chart-utils";

// Recharts ResponsiveContainer measures the DOM; jsdom reports 0x0.
// Force a fixed size so child charts actually render their SVG.
// We also clone children with explicit width/height so recharts renders fully.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  const React = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => {
      const child = React.Children.only(children) as React.ReactElement<{ width?: number; height?: number }>;
      return (
        <div style={{ width: 400, height: 300 }}>
          {React.cloneElement(child, { width: 400, height: 300 })}
        </div>
      );
    },
  };
});

import RechartsRenderer from "./RechartsRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult } from "../../contracts/dataset";

const result: QueryResult = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { province: "Tehran", revenue: 1200 },
    { province: "Fars", revenue: 800 },
    { province: "Isfahan", revenue: 600 },
  ],
  total: 3,
};

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

function makeView(component: string): ReportView {
  return {
    type: "chart",
    library: "recharts",
    component,
    mapping: { x: "province", y: ["revenue"], category: "province", measure: "revenue" },
  };
}

// ── Duplicate-key regression test ───────────────────────────────────────────
// A multi-dimension flat result has duplicate x-values (one row per province
// per month).  The renderer must not produce a React "same key" warning.
describe("RechartsRenderer — duplicate x-values (multi-dim flat result)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    errorSpy?.mockRestore();
  });

  it("bar chart with duplicate x-values renders without React duplicate-key warning", () => {
    // Simulate 2 provinces × 2 months → rows with duplicated orderDate values
    const multiDimResult: QueryResult = {
      columns: [
        { key: "orderDate", label: "ماه", type: "string", isMetric: false },
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
    };
    const barView: ReportView = {
      type: "chart",
      library: "recharts",
      component: "BarChart",
      mapping: { x: "orderDate", y: ["revenue"], measure: "revenue" },
    };

    errorSpy = vi.spyOn(console, "error");

    const { container } = render(
      <RechartsRenderer view={barView} def={def} result={multiDimResult} />,
    );

    // Chart must render (SVG present, data points visible)
    expect(container.querySelector("svg")).toBeTruthy();

    // No React "same key" duplicate warning must have been emitted
    const dupKeyCall = errorSpy.mock.calls.find((args) =>
      args.some(
        (a) => typeof a === "string" && a.toLowerCase().includes("same key"),
      ),
    );
    expect(dupKeyCall).toBeUndefined();
  });
});

describe("RechartsRenderer", () => {
  it("renders a bar chart with an SVG and the right number of bars", () => {
    const { container } = render(
      <RechartsRenderer view={makeView("BarChart")} def={def} result={result} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    // one <rect> bar per data row inside the bar layer
    expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBe(3);
  });

  it("renders a line chart as an SVG path", () => {
    const { container } = render(
      <RechartsRenderer view={makeView("LineChart")} def={def} result={result} />,
    );
    expect(container.querySelector(".recharts-line")).toBeTruthy();
  });

  it("renders a pie chart with one slice per category", () => {
    const { container } = render(
      <RechartsRenderer view={makeView("PieChart")} def={def} result={result} />,
    );
    expect(container.querySelectorAll(".recharts-pie-sector").length).toBe(3);
  });
});

// ── Multi-dim render: bar count equals distinct categories ───────────────────
describe("RechartsRenderer — multi-dim bar: distinct category count", () => {
  it("bar chart over 2-dim data renders one bar per DISTINCT x value (not per raw row)", () => {
    const multiDimResult: QueryResult = {
      columns: [
        { key: "orderDate", label: "ماه", type: "string", isMetric: false },
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
    };
    const barView: ReportView = {
      type: "chart",
      library: "recharts",
      component: "BarChart",
      mapping: { x: "orderDate", y: ["revenue"], measure: "revenue" },
    };

    const { container } = render(
      <RechartsRenderer view={barView} def={def} result={multiDimResult} />,
    );
    // 4 raw rows but only 2 distinct months → 2 bars after aggregation
    expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBe(2);
  });
});

// ── aggregateByCategory pure helper ─────────────────────────────────────────
describe("aggregateByCategory", () => {
  it("merges duplicate categories and sums the value keys (first-seen order)", () => {
    const rows = [
      { m: "2025-01", v: 100 },
      { m: "2025-01", v: 50 },
      { m: "2025-02", v: 30 },
    ];
    const result = aggregateByCategory(rows, "m", ["v"]);
    expect(result).toEqual([
      { m: "2025-01", v: 150 },
      { m: "2025-02", v: 30 },
    ]);
  });

  it("passes through already-unique categories unchanged (no-op)", () => {
    const rows = [
      { province: "Tehran", revenue: 1200 },
      { province: "Fars", revenue: 800 },
      { province: "Isfahan", revenue: 600 },
    ];
    const result = aggregateByCategory(rows, "province", ["revenue"]);
    expect(result).toEqual([
      { province: "Tehran", revenue: 1200 },
      { province: "Fars", revenue: 800 },
      { province: "Isfahan", revenue: 600 },
    ]);
  });

  it("treats null and non-numeric values as 0 in the sum", () => {
    const rows = [
      { cat: "A", val: null },
      { cat: "A", val: 42 },
      { cat: "B", val: "not-a-number" },
      { cat: "B", val: 10 },
    ];
    const result = aggregateByCategory(rows, "cat", ["val"]);
    expect(result).toEqual([
      { cat: "A", val: 42 },
      { cat: "B", val: 10 },
    ]);
  });
});
