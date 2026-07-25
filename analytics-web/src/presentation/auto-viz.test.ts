import { describe, it, expect } from "vitest";
import { chooseView, AUTO_VIZ_THRESHOLDS } from "./auto-viz";
import type { ReportDefinition } from "../contracts/report-definition";
import type { QueryResult, ResolvedColumn, ResultRow } from "../query/engine";
import type { SemanticModel } from "../contracts/semantic";

// minimal sales-like semantic model used to resolve groupBy roles.
const semantic: SemanticModel = {
  id: "model-sales", tenantId: "global", version: 1, defaultLocale: "fa-IR",
  name: { "fa-IR": "فروش", "en-US": "Sales" },
  entities: [{
    id: "sales", source: "sales", name: { "fa-IR": "فروش", "en-US": "Sales" },
    defaultDateField: "orderDate",
    fields: [
      { id: "province", column: "province", type: "string", role: "dimension", label: { "fa-IR": "استان", "en-US": "Province" } },
      { id: "category", column: "category", type: "string", role: "dimension", label: { "fa-IR": "دسته", "en-US": "Category" } },
      { id: "orderDate", column: "orderDate", type: "date", role: "date", label: { "fa-IR": "تاریخ", "en-US": "Date" } },
      { id: "revenue", column: "revenue", type: "number", role: "measure", label: { "fa-IR": "درآمد", "en-US": "Revenue" } },
    ],
  }],
};

// builders for fixtures -------------------------------------------------
const col = (key: string, type: ResolvedColumn["type"], isMetric: boolean, label = key): ResolvedColumn => ({ key, label, type, isMetric });
const result = (columns: ResolvedColumn[], rows: ResultRow[]): QueryResult => ({ columns, rows, total: rows.length });
const nRows = (n: number, dim = "province"): ResultRow[] =>
  Array.from({ length: n }, (_, i) => ({ [dim]: `v${i}`, revenue: i * 10 }));

const def = (over: Partial<ReportDefinition>): ReportDefinition => ({
  id: "t", schemaVersion: "1.0", name: "t", dataset: "sales",
  columns: [], presentation: { views: [] }, ...over,
});

describe("chooseView (§8.6 thresholds)", () => {
  it("exports the canonical thresholds", () => {
    expect(AUTO_VIZ_THRESHOLDS).toEqual({ BAR_MAX_CATEGORIES: 12, PIE_MAX_SLICES: 8, TABLE_MIN_CATEGORIES: 25 });
  });

  it("rule 1 — single measure, no dimension → KPI Card (antd)", () => {
    const r = result([col("revenue", "number", true)], [{ revenue: 9000 }]);
    const views = chooseView(def({ metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "kpi", library: "antd", component: "Card", mapping: { value: "revenue" } });
  });

  it("rule 1b — one row only → KPI even with a dimension column", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], [{ province: "تهران", revenue: 7 }]);
    const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0].type).toBe("kpi");
  });

  it("rule 2 — date dimension + measure → LineChart (recharts)", () => {
    const rows: ResultRow[] = [{ orderDate: "2025-01", revenue: 100 }, { orderDate: "2025-02", revenue: 130 }];
    const r = result([col("orderDate", "date", false), col("revenue", "number", true)], rows);
    const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "LineChart", mapping: { x: "orderDate", y: "revenue" } });
  });

  it("rule 3 — one dimension + measure, ≤12 categories → BarChart (recharts)", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(10));
    const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "BarChart", mapping: { x: "province", y: "revenue" } });
  });

  it("rule 3 boundary — exactly 12 categories → still BarChart", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(12));
    expect(chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].component).toBe("BarChart");
  });

  it("rule 4 — share-of-total intent, ≤8 slices → PieChart (recharts)", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(5));
    const views = chooseView(def({ tags: ["share"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "PieChart", mapping: { category: "province", measure: "revenue" } });
  });

  it("rule 4 fallthrough — share intent but 9 slices → not pie (bar)", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(9));
    expect(chooseView(def({ tags: ["share"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].component).toBe("BarChart");
  });

  it("rule 5a — 2 dimensions × 1 measure → ECharts", () => {
    const r = result([col("orderDate", "date", false), col("province", "string", false), col("revenue", "number", true)],
      [{ orderDate: "2025-01", province: "تهران", revenue: 100 }]);
    const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }, { field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "chart", library: "echarts", component: "EChart" });
  });

  it("rule 5b — >25 categories → ECharts", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(26));
    expect(chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].library).toBe("echarts");
  });

  it("rule 5c — heatmap intent → ECharts", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(4));
    expect(chooseView(def({ tags: ["heatmap"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].library).toBe("echarts");
  });

  it("rule 6 — no measure / wide detail → Table (antd)", () => {
    const r = result([col("title", "string", false), col("province", "string", false), col("status", "string", false)],
      [{ title: "a", province: "تهران", status: "open" }, { title: "b", province: "قم", status: "done" }]);
    const views = chooseView(def({ columns: [{ field: "title" }, { field: "province" }, { field: "status" }] }), r, semantic);
    expect(views[0]).toMatchObject({ type: "table", library: "antd", component: "Table" });
  });

  it("always appends a Table fallback view for non-table primaries", () => {
    const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(10));
    const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    expect(views.length).toBeGreaterThanOrEqual(2);
    expect(views[views.length - 1].type).toBe("table");
  });

  it("STRICT — a chart view never uses library antd", () => {
    const r = result([col("orderDate", "date", false), col("revenue", "number", true)], [{ orderDate: "2025-01", revenue: 1 }, { orderDate: "2025-02", revenue: 2 }]);
    const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
    for (const v of views) if (v.type === "chart") expect(v.library).not.toBe("antd");
  });
});
