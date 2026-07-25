import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TableRenderer from "./TableRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, GroupNode } from "../../contracts/dataset";

const result: QueryResult = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { province: "Tehran", revenue: 1234567 },
    { province: "Fars", revenue: 890000 },
  ],
  total: 2,
};

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const view: ReportView = {
  type: "table",
  library: "antd",
  component: "TableRenderer",
  mapping: {},
};

describe("TableRenderer", () => {
  it("renders headers and formatted cells (LTR default)", () => {
    render(<TableRenderer view={view} def={def} result={result} />);
    // antd duplicates headers in a measure row when scroll is set; use getAllByText
    expect(screen.getAllByText("استان").length).toBeGreaterThan(0);
    expect(screen.getAllByText("درآمد").length).toBeGreaterThan(0);
    expect(screen.getByText("Tehran")).toBeInTheDocument();
    // number cell grouped, ASCII in LTR
    expect(screen.getByText("1,234,567")).toBeInTheDocument();
  });

  it("honors a restricted mapping.columns subset", () => {
    const subset: ReportView = { ...view, mapping: { columns: ["province"] } };
    render(<TableRenderer view={subset} def={def} result={result} />);
    expect(screen.getAllByText("استان").length).toBeGreaterThan(0);
    expect(screen.queryByText("درآمد")).not.toBeInTheDocument();
  });

  it("renders without onDrill prop (no crash)", () => {
    render(<TableRenderer view={view} def={def} result={result} />);
    expect(screen.getByText("Fars")).toBeInTheDocument();
  });

  it("accepts onDrill callback prop without crashing", () => {
    const onDrill = vi.fn();
    render(<TableRenderer view={view} def={def} result={result} onDrill={onDrill} />);
    expect(screen.getByText("Tehran")).toBeInTheDocument();
  });

  it("fires onDrill exactly once with the correct GroupNode on user expand", async () => {
    // Fixture with groups so the table shows expand controls.
    const group0: GroupNode = {
      key: "Tehran",
      value: "Tehran",
      rows: [{ province: "Tehran-North", revenue: 600000 }],
    };
    const group1: GroupNode = {
      key: "Fars",
      value: "Fars",
      rows: [{ province: "Shiraz", revenue: 890000 }],
    };

    const resultWithGroups: QueryResult = {
      ...result,
      groups: [group0, group1],
    };

    const onDrill = vi.fn();
    const user = userEvent.setup();

    render(
      <TableRenderer
        view={view}
        def={def}
        result={resultWithGroups}
        onDrill={onDrill}
      />,
    );

    // antd renders expand buttons as buttons with aria-label "Expand row"
    const expandButtons = screen.getAllByRole("button", { name: /expand row/i });
    // Click the first expand control (Tehran row = group0)
    await user.click(expandButtons[0]);

    // onDrill must have been called exactly once with the first GroupNode
    expect(onDrill).toHaveBeenCalledTimes(1);
    expect(onDrill).toHaveBeenCalledWith(group0);
  });
});
