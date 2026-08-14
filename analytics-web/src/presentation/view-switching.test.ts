import { describe, it, expect } from "vitest";
import type { QueryResult, ReportView } from "@/contracts";
import {
  buildViewForTarget,
  canRenderTarget,
  findViewForTarget,
  targetOfView,
  NO_TARGET,
} from "./view-switching";

const col = (key: string, isMetric: boolean) => ({
  key,
  label: key,
  dataType: isMetric ? "number" : "string",
  isMetric,
});

/** The shape of «تعداد و درصد پروژه‌ها به تفکیک نوع پروژه»: one dimension, TWO metrics. */
const countAndPercent = {
  columns: [col("TypProject", false), col("cnt", true), col("pct", true)],
  rows: [],
  total: 12,
} as unknown as QueryResult;

const tableView: ReportView = {
  type: "table",
  library: "antd",
  component: "Table",
  mapping: { columns: ["TypProject", "cnt"] },
} as unknown as ReportView;

describe("canRenderTarget", () => {
  it("offers a pie for a count AND its percentage", () => {
    // The old rule disabled the pie whenever a report had more than one metric, which ruled it
    // out for the most natural pie there is — a count beside its own share.
    expect(canRenderTarget("pie", countAndPercent)).toBe(true);
  });

  it("refuses a pie with nothing to slice by", () => {
    const noDims = { columns: [col("cnt", true)], rows: [], total: 1 } as unknown as QueryResult;
    expect(canRenderTarget("pie", noDims)).toBe(false);
    expect(canRenderTarget("bar", noDims)).toBe(false);
    // A single number is exactly what a KPI is for.
    expect(canRenderTarget("kpi", noDims)).toBe(true);
  });

  it("always offers the table, whatever the shape", () => {
    const empty = { columns: [], rows: [], total: 0 } as unknown as QueryResult;
    expect(canRenderTarget("table", empty)).toBe(true);
  });
});

describe("buildViewForTarget", () => {
  it("builds a pie from the result's first dimension and first measure", () => {
    const v = buildViewForTarget("pie", countAndPercent);

    expect(v.component).toBe("PieChart");
    // A pie draws ONE number per slice, so with two metrics it takes the first — the same choice
    // the bar chart already makes.
    expect(v.mapping).toEqual({ category: "TypProject", measure: "cnt" });
  });

  it("does not copy a table's mapping onto a chart", () => {
    // A Table's mapping has `columns` and no axes. Copying it handed the chart undefined x/y and
    // it rendered an empty box.
    const v = buildViewForTarget("line", countAndPercent, tableView);

    expect(v.component).toBe("LineChart");
    expect(v.mapping).toEqual({ x: "TypProject", y: "cnt" });
  });

  it("builds table and kpi without touching the columns", () => {
    expect(buildViewForTarget("table", countAndPercent).component).toBe("Table");
    expect(buildViewForTarget("kpi", countAndPercent).component).toBe("KpiCard");
  });
});

describe("findViewForTarget", () => {
  it("finds a chart by its component name and a table by its type", () => {
    const views = [
      { type: "chart", library: "recharts", component: "BarChart", mapping: {} },
      tableView,
    ] as ReportView[];

    expect(findViewForTarget(views, "bar")).toBe(0);
    expect(findViewForTarget(views, "table")).toBe(1);
  });

  it("returns -1 when the view does not exist yet, so the caller builds it", () => {
    const views = [
      { type: "chart", library: "recharts", component: "BarChart", mapping: {} },
    ] as ReportView[];

    // This is the case that used to fall back to index 0 and silently show the bar chart again.
    expect(findViewForTarget(views, "pie")).toBe(-1);
    expect(findViewForTarget(views, "line")).toBe(-1);
    expect(findViewForTarget(views, "kpi")).toBe(-1);
  });
});

/**
 * The migration guard. `library` moves per step; the **component string must not**, because it is the
 * identity key three places resolve through `targetOfView` — `findViewForTarget` here, `ViewSwitcher`
 * and `WidgetFrame` — plus AskAiBuilder's `motion.div` key, which still reads it raw. Renaming "BarChart" to
 * "bar" would break the view switcher with nothing to type-check the break, and the switcher failing
 * silently looks like a chart that will not change rather than a bug.
 */
describe("switching survives the ECharts migration", () => {
  it("builds bar as an ECharts view, still called BarChart", () => {
    const v = buildViewForTarget("bar", countAndPercent);

    expect(v.library).toBe("echarts");
    expect(v.component).toBe("BarChart");
  });

  it("finds an existing ECharts bar view rather than building a duplicate", () => {
    const views = [
      { type: "chart", library: "echarts", component: "BarChart", mapping: {} },
      tableView,
    ] as Parameters<typeof findViewForTarget>[0];

    expect(findViewForTarget(views, "bar")).toBe(0);
  });

  it("still finds a bar view saved under the old library", () => {
    // Stored definitions carry whatever library was current when they were saved, and the switcher
    // matches on the component string, not the library.
    const views = [
      { type: "chart", library: "recharts", component: "BarChart", mapping: {} },
    ] as Parameters<typeof findViewForTarget>[0];

    expect(findViewForTarget(views, "bar")).toBe(0);
  });

  it("builds line as an ECharts view, still called LineChart", () => {
    const v = buildViewForTarget("line", countAndPercent);

    expect(v.library).toBe("echarts");
    expect(v.component).toBe("LineChart");
  });

  it("builds pie as an ECharts view, still called PieChart", () => {
    const v = buildViewForTarget("pie", countAndPercent);

    expect(v.library).toBe("echarts");
    expect(v.component).toBe("PieChart");
  });

  it("leaves no target on recharts", () => {
    // What the three per-target assertions above were building towards. The guard that used to read
    // "has not moved pie yet" caught both deliberate flips (line in step 7, pie in step 8) by
    // failing on them; with nothing left to move, it becomes this — a check that nothing goes back.
    for (const target of ["bar", "line", "pie"] as const) {
      expect(buildViewForTarget(target, countAndPercent).library).toBe("echarts");
    }
  });
});

/**
 * `targetOfView` replaced three separate `component.toLowerCase().includes("bar")` ladders — in
 * `findViewForTarget`, `ViewSwitcher` and `WidgetFrame` — that ended in three DIFFERENT fallbacks:
 * line, bar, and bar. The same view therefore appeared as a different pressed button depending on
 * which screen you were looking at.
 */
describe("targetOfView", () => {
  const chart = (component: string) =>
    ({ type: "chart", library: "echarts", component, mapping: {} }) as Parameters<typeof targetOfView>[0];

  it.each([
    ["BarChart", "bar"],
    ["bar", "bar"],
    ["LineChart", "line"],
    ["line", "line"],
    ["PieChart", "pie"],
    ["pie", "pie"],
  ] as const)("maps %s to %s", (component, expected) => {
    expect(targetOfView(chart(component))).toBe(expected);
  });

  it("answers with the TYPE for table and kpi, not the component string", () => {
    // A KPI's component is "Card", which no substring rule would ever have matched.
    expect(targetOfView({ type: "table", library: "antd", component: "Table", mapping: {} } as never)).toBe("table");
    expect(targetOfView({ type: "kpi", library: "antd", component: "Card", mapping: {} } as never)).toBe("kpi");
  });

  it("says undefined for a view with no button, instead of guessing", () => {
    // The heatmap is the live case: `auto-viz`'s matrix rule emits it and the switcher offers no
    // heatmap button. Guessing lit «خطی» on a chart that was not a line.
    expect(targetOfView(chart("heatmap"))).toBeUndefined();
    // And for the component string the matrix rule used to emit, which matched nothing either.
    expect(targetOfView(chart("EChart"))).toBeUndefined();
    expect(targetOfView(undefined)).toBeUndefined();
  });

  it("offers a Segmented value that matches no option", () => {
    // antd's Segmented reads `undefined` as "the first option", so undefined alone lit «جدول».
    // Measured on the page, which is why this constant exists at all.
    expect(NO_TARGET).not.toBe("table");
    expect(["table", "kpi", "bar", "line", "pie"]).not.toContain(NO_TARGET);
  });

  it("does not find a heatmap under any chart target", () => {
    const views = [chart("heatmap"), { type: "table", library: "antd", component: "Table", mapping: {} }] as never;
    for (const target of ["bar", "line", "pie"] as const) {
      expect(findViewForTarget(views, target)).toBe(-1);
    }
    // …but the Table companion is still selectable, so the strip is not inert.
    expect(findViewForTarget(views, "table")).toBe(1);
  });
});
