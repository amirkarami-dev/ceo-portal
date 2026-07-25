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
});
