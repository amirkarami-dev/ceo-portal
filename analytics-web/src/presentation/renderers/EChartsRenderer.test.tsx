import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const captured: { option?: Record<string, unknown> } = {};
vi.mock("echarts-for-react", () => ({
  default: (props: { option: Record<string, unknown> }) => {
    captured.option = props.option;
    return <div data-testid="echarts-mock" />;
  },
}));

import EChartsRenderer from "./EChartsRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult } from "../../contracts/dataset";

const result: QueryResult = {
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
};

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const view: ReportView = {
  type: "chart",
  library: "echarts",
  component: "heatmap",
  mapping: { x: "province", series: "city", measure: "revenue" },
};

beforeEach(() => {
  captured.option = undefined;
  document.documentElement.dir = "ltr";
});

describe("EChartsRenderer", () => {
  it("builds an option with a tooltip and a series", () => {
    render(<EChartsRenderer view={view} def={def} result={result} />);
    expect(captured.option).toBeDefined();
    expect(captured.option!.tooltip).toBeDefined();
    expect(Array.isArray(captured.option!.series)).toBe(true);
    expect((captured.option!.series as unknown[]).length).toBeGreaterThan(0);
  });

  it("right-aligns the legend when dir is rtl", () => {
    document.documentElement.dir = "rtl";
    render(<EChartsRenderer view={view} def={def} result={result} />);
    const legend = captured.option!.legend as { right?: number; left?: number };
    expect(legend.right).toBeDefined();
    expect(legend.left).toBeUndefined();
  });

  // ── RTL ──────────────────────────────────────────────────────────────────
  // The legend here is a horizontal strip, so anchoring it to the reading edge is the right answer
  // — the same question recharts' bottom legend asks, NOT the side question that had the donut's
  // legend on the wrong side. These pin what is already correct so it survives later edits.

  const barView: ReportView = {
    type: "chart",
    library: "echarts",
    component: "bar",
    mapping: { x: "province", series: "city", measure: "revenue" },
  };

  const axes = () => ({
    x: captured.option!.xAxis as { inverse?: boolean },
    y: captured.option!.yAxis as { position?: string },
  });

  it("runs the categories from the right and puts the values on the right, in rtl", () => {
    document.documentElement.dir = "rtl";
    render(<EChartsRenderer view={barView} def={def} result={result} />);
    const { x, y } = axes();
    expect(x.inverse).toBe(true);
    expect(y.position).toBe("right");
  });

  it("mirrors back in ltr", () => {
    document.documentElement.dir = "ltr";
    render(<EChartsRenderer view={barView} def={def} result={result} />);
    const { x, y } = axes();
    expect(x.inverse).toBe(false);
    expect(y.position).toBe("left");
  });

  it("puts the heatmap's row labels on the same side the columns start from", () => {
    document.documentElement.dir = "rtl";
    render(<EChartsRenderer view={view} def={def} result={result} />);
    const { x, y } = axes();
    // Columns already ran right-to-left while the labels stayed left, so a reader crossed the whole
    // matrix and came back. Only the horizontal order mirrors — rows stay top-to-bottom.
    expect(x.inverse).toBe(true);
    expect(y.position).toBe("right");
  });

  it("aligns the tooltip text to the reading edge", () => {
    document.documentElement.dir = "rtl";
    render(<EChartsRenderer view={barView} def={def} result={result} />);
    const tooltip = captured.option!.tooltip as { textStyle?: { align?: string } };
    expect(tooltip.textStyle?.align).toBe("right");
  });
});
