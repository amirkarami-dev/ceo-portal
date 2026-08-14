import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as echarts from "echarts";
import EChartsRenderer from "./EChartsRenderer";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, GroupNode } from "../../contracts/dataset";

/**
 * The data layer. Every one of these was wrong before step 3, and none of them threw — they produced
 * quietly incorrect charts, which is worse.
 *
 * Read off a live instance, so `getOption()` returns the **normalised** option: `series[0]`,
 * `xAxis[0]`, and so on.
 */

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  presentation: { views: [] },
} as unknown as ReportDefinition;

function makeResult(rows: Record<string, unknown>[], groups?: GroupNode[]): QueryResult {
  return {
    columns: [
      { key: "month", label: "ماه", type: "string", isMetric: false },
      { key: "city", label: "شهر", type: "string", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
      { key: "cost", label: "هزینه", type: "number", isMetric: true },
    ],
    rows,
    groups,
    total: rows.length,
  } as unknown as QueryResult;
}

type Resolved = {
  xAxis: { data: string[] }[];
  series: { name?: string; data: unknown[] }[];
};

function mount(view: ReportView, result: QueryResult, onDrill?: (n: GroupNode) => void) {
  const utils = render(<EChartsRenderer view={view} def={def} result={result} onDrill={onDrill} />);
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
  document.documentElement.dir = "ltr";
});

const bar = (mapping: Record<string, unknown>): ReportView =>
  ({ type: "chart", library: "echarts", component: "bar", mapping }) as unknown as ReportView;

describe("EChartsRenderer data layer — aggregation", () => {
  /**
   * `rows.find(r => r[x] === xc)` took the FIRST matching row and threw the rest away. Four rows over
   * two months drew two bars each holding one row's value — a chart with confidently wrong numbers.
   */
  it("sums rows that share a category instead of keeping only the first", () => {
    const result = makeResult([
      { month: "1404/01", revenue: 100 },
      { month: "1404/01", revenue: 250 },
      { month: "1404/02", revenue: 40 },
      { month: "1404/02", revenue: 60 },
    ]);

    const { option } = mount(bar({ x: "month", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toEqual(["1404/01", "1404/02"]);
    expect(option.series[0].data).toEqual([350, 100]);
  });

  it("keeps first-seen order, not sorted order", () => {
    const result = makeResult([
      { month: "1404/03", revenue: 1 },
      { month: "1404/01", revenue: 2 },
    ]);

    const { option } = mount(bar({ x: "month", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toEqual(["1404/03", "1404/01"]);
  });
});

describe("EChartsRenderer data layer — the missing bucket", () => {
  /**
   * `uniq` did `if (v === null) continue`, so a whole bar vanished. The engine deliberately buckets
   * missing values together and pins it; the recharts path keeps the bucket. This was the one place
   * in the app that silently dropped it.
   */
  it("keeps a null category as its own bar", () => {
    const result = makeResult([
      { month: "1404/01", revenue: 10 },
      { month: null, revenue: 20 },
      { month: "1404/02", revenue: 30 },
    ]);

    const { option } = mount(bar({ x: "month", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toHaveLength(3);
    expect(option.series[0].data).toEqual([10, 20, 30]);
  });

  it("renders the missing bucket as a blank tick, the way recharts does", () => {
    const result = makeResult([{ month: null, revenue: 20 }]);

    const { option } = mount(bar({ x: "month", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toEqual([""]);
  });

  it("groups undefined together with null rather than making a second bucket", () => {
    const result = makeResult([
      { month: null, revenue: 5 },
      { revenue: 7 },
    ]);

    const { option } = mount(bar({ x: "month", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toHaveLength(1);
    expect(option.series[0].data).toEqual([12]);
  });
});

describe("EChartsRenderer data layer — more than one measure", () => {
  /** `mapping.y` is `string | string[]`, and this collapsed to one measure: half the data, silently. */
  it("draws one series per y key", () => {
    const result = makeResult([
      { month: "1404/01", revenue: 100, cost: 60 },
      { month: "1404/02", revenue: 200, cost: 90 },
    ]);

    const { option } = mount(bar({ x: "month", y: ["revenue", "cost"] }), result);

    expect(option.series).toHaveLength(2);
    expect(option.series[0].data).toEqual([100, 200]);
    expect(option.series[1].data).toEqual([60, 90]);
  });

  it("names those series the way the rest of the app names columns", () => {
    const result = makeResult([{ month: "1404/01", revenue: 100, cost: 60 }]);

    const { option } = mount(bar({ x: "month", y: ["revenue", "cost"] }), result);

    // Not the raw aliases. `useColumnLabel` is what the legend, the table and the exports all use.
    expect(option.series.map((s) => s.name)).not.toEqual(["revenue", "cost"]);
  });

  it("still handles the other kind of multi-series — one measure split by a field", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 10 },
      { month: "1404/01", city: "شیراز", revenue: 20 },
      { month: "1404/02", city: "تهران", revenue: 30 },
    ]);

    const { option } = mount(bar({ x: "month", series: "city", measure: "revenue" }), result);

    expect(option.series).toHaveLength(2);
    expect(option.xAxis[0].data).toEqual(["1404/01", "1404/02"]);
    // شیراز has no row in the second month; a gap is 0, not a shifted value.
    expect(option.series[1].data).toEqual([20, 0]);
  });

  it("sums duplicates inside a split series too", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 10 },
      { month: "1404/01", city: "تهران", revenue: 5 },
    ]);

    const { option } = mount(bar({ x: "month", series: "city", measure: "revenue" }), result);

    expect(option.series[0].data).toEqual([15]);
  });
});

describe("EChartsRenderer data layer — series names in RTL", () => {
  /**
   * `name: String(sv)` was raw, so a chart split by month showed a Jalali date on the axis and an ISO
   * one in the legend at the same time.
   */
  it("formats the split value the same way the axis formats it", () => {
    document.documentElement.dir = "rtl";
    const result = makeResult([
      { month: "تهران", city: "2025-05-01", revenue: 10 },
      { month: "تهران", city: "2025-06-01", revenue: 20 },
    ]);

    const { option } = mount(bar({ x: "month", series: "city", measure: "revenue" }), result);

    // A date-like series value must not come back as the raw ISO string.
    for (const s of option.series) {
      expect(s.name, "raw ISO date leaked into a legend entry").not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("EChartsRenderer data layer — drill by value", () => {
  const groups = [
    { key: "Tehran", value: "Tehran", rows: [] },
    { key: "Fars", value: "Fars", rows: [] },
    { key: "Yazd", value: "Yazd", rows: [] },
  ] as unknown as GroupNode[];

  /**
   * The chart is in row order; `groups` is in bucket-insertion order. With a sort on the report those
   * disagree, and the old positional lookup opened the wrong report for every bar.
   */
  it("opens the group for the category clicked, not the one at that index", () => {
    // Rows sorted desc by revenue; groups still in insertion order.
    const result = makeResult(
      [
        { month: "Fars", revenue: 900 },
        { month: "Yazd", revenue: 500 },
        { month: "Tehran", revenue: 100 },
      ],
      groups,
    );

    const onDrill = vi.fn();
    const { instance } = mount(bar({ x: "month", measure: "revenue" }), result, onDrill);

    // Click the first bar: "Fars". Indexing would have handed back groups[0] = "Tehran".
    instance.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: 0 });
    (instance as unknown as { trigger: (n: string, p: unknown) => void }).trigger("click", {
      dataIndex: 0,
    });

    expect(onDrill).toHaveBeenCalledTimes(1);
    expect((onDrill.mock.calls[0][0] as GroupNode).value).toBe("Fars");
  });

  it("finds the missing bucket when the blank tick is clicked", () => {
    const withNull = [
      { key: "Tehran", value: "Tehran", rows: [] },
      { key: "null", value: null, rows: [] },
    ] as unknown as GroupNode[];
    const result = makeResult([{ month: null, revenue: 5 }, { month: "Tehran", revenue: 1 }], withNull);

    const onDrill = vi.fn();
    const { instance } = mount(bar({ x: "month", measure: "revenue" }), result, onDrill);

    (instance as unknown as { trigger: (n: string, p: unknown) => void }).trigger("click", {
      dataIndex: 0,
    });

    expect(onDrill).toHaveBeenCalledTimes(1);
    expect((onDrill.mock.calls[0][0] as GroupNode).value).toBeNull();
  });

  it("does nothing when the click lands on no known category", () => {
    const result = makeResult([{ month: "Tehran", revenue: 1 }], groups);
    const onDrill = vi.fn();
    const { instance } = mount(bar({ x: "month", measure: "revenue" }), result, onDrill);

    (instance as unknown as { trigger: (n: string, p: unknown) => void }).trigger("click", {
      dataIndex: 99,
    });

    expect(onDrill).not.toHaveBeenCalled();
  });
});

// `aggregateByCategory` covers the missing bucket on the single-series path. `uniq` is what covers it
// on the OTHER two paths — the heatmap matrix and a split series — and reverting its null handling
// broke none of the tests above. These are those paths.

describe("EChartsRenderer data layer — the missing bucket on the uniq paths", () => {
  const heatmap = (mapping: Record<string, unknown>): ReportView =>
    ({ type: "chart", library: "echarts", component: "heatmap", mapping }) as unknown as ReportView;

  it("keeps a null column in the heatmap matrix", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 1 },
      { month: null, city: "تهران", revenue: 2 },
    ]);

    const { option } = mount(heatmap({ x: "month", series: "city", measure: "revenue" }), result);

    // Two columns, one of them the blank tick — not one column with a row silently discarded.
    expect(option.xAxis[0].data).toHaveLength(2);
    expect(option.xAxis[0].data).toContain("");
  });

  it("keeps a null row label in the heatmap matrix", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 1 },
      { month: "1404/01", city: null, revenue: 2 },
    ]);

    const { option } = mount(heatmap({ x: "month", series: "city", measure: "revenue" }), result);
    const yAxis = (option as unknown as { yAxis: { data: string[] }[] }).yAxis;

    expect(yAxis[0].data).toHaveLength(2);
    expect(yAxis[0].data).toContain("");
  });

  it("keeps a null series value as its own series", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 10 },
      { month: "1404/01", city: null, revenue: 7 },
    ]);

    const { option } = mount(bar({ x: "month", series: "city", measure: "revenue" }), result);

    // A row whose split value is missing is still a row. Dropping it loses the 7 with no trace.
    expect(option.series).toHaveLength(2);
    expect(option.series.map((s) => s.data)).toEqual([[10], [7]]);
  });

  it("keeps a null category on a split series", () => {
    const result = makeResult([
      { month: "1404/01", city: "تهران", revenue: 10 },
      { month: null, city: "تهران", revenue: 4 },
    ]);

    const { option } = mount(bar({ x: "month", series: "city", measure: "revenue" }), result);

    expect(option.xAxis[0].data).toHaveLength(2);
    expect(option.series[0].data).toEqual([10, 4]);
  });
});
