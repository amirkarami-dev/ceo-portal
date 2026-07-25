import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiRenderer from "./KpiRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult } from "../../contracts/dataset";

const result: QueryResult = {
  columns: [
    { key: "total_revenue", label: "درآمد کل", type: "number", isMetric: true },
  ],
  rows: [{ total_revenue: 9876543 }],
  total: 1,
};

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const view: ReportView = {
  type: "kpi",
  library: "antd",
  component: "KpiRenderer",
  title: "درآمد کل",
  mapping: { value: "total_revenue" },
};

describe("KpiRenderer", () => {
  it("renders the big value and its label", () => {
    render(<KpiRenderer view={view} def={def} result={result} />);
    expect(screen.getByText("درآمد کل")).toBeInTheDocument();
    // value formatted (ASCII grouping in LTR test environment)
    expect(screen.getByText("9,876,543")).toBeInTheDocument();
  });

  it("falls back to the first metric column when mapping.value is absent", () => {
    const v2: ReportView = { ...view, title: undefined, mapping: {} };
    render(<KpiRenderer view={v2} def={def} result={result} />);
    expect(screen.getByText("9,876,543")).toBeInTheDocument();
    // label falls back to the resolved column label
    expect(screen.getByText("درآمد کل")).toBeInTheDocument();
  });
});
