import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./renderers/TableRenderer", () => ({
  default: () => <div data-testid="r-table" />,
}));
vi.mock("./renderers/KpiRenderer", () => ({
  default: () => <div data-testid="r-kpi" />,
}));
vi.mock("./renderers/EChartsRenderer", () => ({
  default: () => <div data-testid="r-echarts" />,
}));

import { ReportViewRenderer } from "./ReportView";
import type { ReportView } from "../contracts/presentation";
import type { ReportDefinition } from "../contracts/report-definition";
import type { QueryResult } from "../contracts/dataset";

const result: QueryResult = { columns: [], rows: [], total: 0 };
const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

function view(partial: Partial<ReportView>): ReportView {
  return {
    type: "table",
    library: "antd",
    component: "TableRenderer",
    mapping: {},
    ...partial,
  };
}

describe("ReportViewRenderer", () => {
  it("dispatches antd table → TableRenderer", () => {
    render(<ReportViewRenderer view={view({ library: "antd", type: "table" })} def={def} result={result} />);
    expect(screen.getByTestId("r-table")).toBeInTheDocument();
  });
  it("dispatches antd kpi → KpiRenderer", () => {
    render(<ReportViewRenderer view={view({ library: "antd", type: "kpi" })} def={def} result={result} />);
    expect(screen.getByTestId("r-kpi")).toBeInTheDocument();
  });
  it("dispatches the legacy recharts alias → EChartsRenderer", () => {
    // The reason the `case "recharts"` survives the library being uninstalled. Saved definitions
    // still carry it, and without the alias they fall through `default` to TableRenderer — a chart
    // silently becoming a table, with nothing to notice it.
    render(<ReportViewRenderer view={view({ library: "recharts", type: "chart", component: "BarChart" })} def={def} result={result} />);
    expect(screen.getByTestId("r-echarts")).toBeInTheDocument();
  });

  it("does not let a stored chart fall through to the table", () => {
    // The failure mode stated as its own assertion, because it is silent: the alias is one line and
    // deleting it looks like tidy-up.
    render(<ReportViewRenderer view={view({ library: "recharts", type: "chart", component: "PieChart" })} def={def} result={result} />);
    expect(screen.queryByTestId("r-table")).not.toBeInTheDocument();
  });
  it("dispatches echarts → EChartsRenderer", () => {
    render(<ReportViewRenderer view={view({ library: "echarts", type: "chart", component: "heatmap" })} def={def} result={result} />);
    expect(screen.getByTestId("r-echarts")).toBeInTheDocument();
  });
});
