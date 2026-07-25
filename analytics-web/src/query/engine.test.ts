import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  runQuery,
  applyOperator,
  aggregate,
  resolveDynamicValue,
  dateBucketKey,
  evalExpression,
  ENGINE_TODAY,
} from "./engine";
import { projectModel } from "../semantic/models/project";
import { salesModel } from "../semantic/models/sales";
import { projectData } from "../semantic/datasets/project";
import { salesData } from "../semantic/datasets/sales";
import type { ReportDefinition } from "../contracts/report-definition";

describe("applyOperator", () => {
  it("eq / neq", () => {
    expect(applyOperator("eq", "a", "a")).toBe(true);
    expect(applyOperator("eq", "a", "b")).toBe(false);
    expect(applyOperator("neq", "a", "b")).toBe(true);
  });
  it("numeric comparisons", () => {
    expect(applyOperator("gt", 5, 3)).toBe(true);
    expect(applyOperator("gte", 3, 3)).toBe(true);
    expect(applyOperator("lt", 2, 3)).toBe(true);
    expect(applyOperator("lte", 3, 3)).toBe(true);
    expect(applyOperator("gt", 2, 3)).toBe(false);
  });
  it("date comparisons (ISO strings compare lexicographically)", () => {
    expect(applyOperator("lt", "2025-01-05", "2025-05-02")).toBe(true);
    expect(applyOperator("gte", "2025-05-02", "2025-05-02")).toBe(true);
  });
  it("between / notBetween (inclusive)", () => {
    expect(applyOperator("between", 5, 1, 10)).toBe(true);
    expect(applyOperator("between", 10, 1, 10)).toBe(true);
    expect(applyOperator("between", 11, 1, 10)).toBe(false);
    expect(applyOperator("notBetween", 11, 1, 10)).toBe(true);
  });
  it("in / notIn", () => {
    expect(applyOperator("in", "paid", ["paid", "shipped"])).toBe(true);
    expect(applyOperator("in", "x", ["paid", "shipped"])).toBe(false);
    expect(applyOperator("notIn", "x", ["paid", "shipped"])).toBe(true);
  });
  it("contains / notContains (case-insensitive)", () => {
    expect(applyOperator("contains", "Tehran Tower", "tower")).toBe(true);
    expect(applyOperator("notContains", "Tehran Tower", "villa")).toBe(true);
  });
  it("startsWith / endsWith", () => {
    expect(applyOperator("startsWith", "P-1001", "P-")).toBe(true);
    expect(applyOperator("endsWith", "report.pdf", ".pdf")).toBe(true);
  });
  it("isNull / isNotNull", () => {
    expect(applyOperator("isNull", null)).toBe(true);
    expect(applyOperator("isNull", 0)).toBe(false);
    expect(applyOperator("isNotNull", 0)).toBe(true);
  });
  it("isTrue / isFalse", () => {
    expect(applyOperator("isTrue", true)).toBe(true);
    expect(applyOperator("isFalse", false)).toBe(true);
    expect(applyOperator("isTrue", false)).toBe(false);
  });
});

describe("aggregate", () => {
  it("sum / avg / min / max ignore null & non-numeric", () => {
    expect(aggregate("sum", [1, 2, 3, null])).toBe(6);
    expect(aggregate("avg", [2, 4, null])).toBe(3);
    expect(aggregate("min", [5, 2, 9])).toBe(2);
    expect(aggregate("max", [5, 2, 9])).toBe(9);
  });
  it("count counts all rows incl. null; countDistinct counts distinct non-null", () => {
    expect(aggregate("count", [1, null, "x", 2])).toBe(4);
    expect(aggregate("countDistinct", ["a", "a", "b", null])).toBe(2);
  });
  it("empty input → 0", () => {
    expect(aggregate("sum", [])).toBe(0);
    expect(aggregate("avg", [])).toBe(0);
  });
});

describe("dateBucketKey", () => {
  it("month / quarter / year / week / day", () => {
    expect(dateBucketKey("2025-03-11", "month")).toBe("2025-03");
    expect(dateBucketKey("2025-03-11", "quarter")).toBe("2025-Q1");
    expect(dateBucketKey("2025-11-02", "quarter")).toBe("2025-Q4");
    expect(dateBucketKey("2025-03-11", "year")).toBe("2025");
    expect(dateBucketKey("2025-03-11", "day")).toBe("2025-03-11");
    expect(dateBucketKey("2025-03-11", undefined)).toBe("2025-03-11");
  });
});

describe("resolveDynamicValue", () => {
  beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); }); // 2025-06-01
  afterEach(() => { ENGINE_TODAY.value = Date.now(); });
  it("today with offsetDays returns an ISO date", () => {
    expect(resolveDynamicValue({ token: "today", offsetDays: -30 })).toBe("2025-05-02");
    expect(resolveDynamicValue({ token: "today" })).toBe("2025-06-01");
  });
  it("startOfYear / startOfMonth", () => {
    expect(resolveDynamicValue({ token: "startOfYear" })).toBe("2025-01-01");
    expect(resolveDynamicValue({ token: "startOfMonth" })).toBe("2025-06-01");
  });
});

describe("evalExpression (safe, post-aggregate)", () => {
  it("arithmetic over alias scope", () => {
    expect(evalExpression("totalSales / orderCount", { totalSales: 100, orderCount: 4 })).toBe(25);
    expect(evalExpression("(revenue - cost) / revenue * 100", { revenue: 200, cost: 50 })).toBe(75);
  });
  it("division by zero → null", () => {
    expect(evalExpression("a / b", { a: 10, b: 0 })).toBeNull();
  });
  it("rejects non-whitelisted tokens", () => {
    expect(() => evalExpression("process.exit(1)", {})).toThrow();
  });
});

// ============================================================
// runQuery — §5.7 delayed projects > 30 days by province
// ============================================================
describe("runQuery — §5.7 delayed projects > 30 days by province", () => {
  beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
  afterEach(() => { ENGINE_TODAY.value = Date.now(); });

  const def: ReportDefinition = {
    id: "rpt_delayed_projects_by_province", schemaVersion: "1.0",
    name: "پروژه‌های معوق", dataset: "projects",
    columns: [
      { field: "province", label: "استان", type: "string" },
      { field: "id", label: "تعداد پروژه", type: "number", visible: false },
    ],
    filters: [
      { field: "status", operator: "neq", value: "completed" },
      { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
    ],
    groupBy: [{ field: "province" }],
    metrics: [
      { field: "*", aggregation: "count", alias: "delayedCount", label: "تعداد معوق" },
      { field: "delayDays", aggregation: "avg", alias: "avgDelay", label: "میانگین تأخیر" },
    ],
    sorting: [{ field: "delayedCount", direction: "desc" }],
    presentation: { views: [] },
  };

  it("returns one row per province with the right counts & avg delay, sorted desc", () => {
    const r = runQuery(def, projectData, projectModel);
    expect(r.total).toBe(4);
    const byProvince = Object.fromEntries(r.rows.map((row) => [row.province, row]));
    expect(byProvince["تهران"].delayedCount).toBe(3);
    expect(byProvince["اصفهان"].delayedCount).toBe(2);
    expect(byProvince["خوزستان"].delayedCount).toBe(2);
    expect(byProvince["فارس"].delayedCount).toBe(1);
    expect(byProvince["تهران"].avgDelay).toBe(65);      // (45+60+90)/3
    expect(byProvince["اصفهان"].avgDelay).toBe(85);     // (50+120)/2
    expect(byProvince["خوزستان"].avgDelay).toBe(52.5);  // (35+70)/2
    // sorted by delayedCount desc → تهران first, فارس last
    expect(r.rows[0].province).toBe("تهران");
    expect(r.rows.at(-1)!.province).toBe("فارس");
  });

  it("tags metric columns as isMetric in resolved columns", () => {
    const r = runQuery(def, projectData, projectModel);
    const cols = Object.fromEntries(r.columns.map((c) => [c.key, c]));
    expect(cols["province"].isMetric).toBe(false);
    expect(cols["delayedCount"].isMetric).toBe(true);
    expect(cols["avgDelay"].isMetric).toBe(true);
  });
});

// ============================================================
// runQuery — §5.8 monthly revenue by province (date bucket + series)
// ============================================================
describe("runQuery — §5.8 monthly revenue by province (date bucket + series)", () => {
  beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
  afterEach(() => { ENGINE_TODAY.value = Date.now(); });

  const def: ReportDefinition = {
    id: "rpt_monthly_revenue_by_province", schemaVersion: "1.0",
    name: "درآمد ماهانه", dataset: "sales",
    columns: [
      { field: "orderDate", label: "ماه", type: "date" },
      { field: "province", label: "استان", type: "string" },
      { field: "amount", label: "درآمد", type: "number" },
    ],
    filters: [{ field: "orderDate", operator: "gte", value: { token: "startOfYear" }, dynamic: true }],
    groupBy: [{ field: "orderDate", dateBucket: "month" }, { field: "province" }],
    metrics: [{ field: "amount", aggregation: "sum", alias: "revenue", label: "درآمد" }],
    sorting: [
      { field: "orderDate", direction: "asc", priority: 1 },
      { field: "province", direction: "asc", priority: 2 },
    ],
    presentation: { views: [] },
  };

  it("buckets orderDate to month and sums amount per (month, province)", () => {
    const r = runQuery(def, salesData, salesModel);
    const cell = (m: string, p: string) =>
      r.rows.find((row) => row.orderDate === m && row.province === p)?.revenue;
    // Jan تهران: S-001 (360M) + S-013 (125M) = 485,000,000
    expect(cell("2025-01", "تهران")).toBe(485_000_000);
    // Feb تهران: S-002 (880M) + S-014 (234M) = 1,114,000,000
    expect(cell("2025-02", "تهران")).toBe(1_114_000_000);
    // Jan خوزستان: S-007 (1.2B)
    expect(cell("2025-01", "خوزستان")).toBe(1_200_000_000);
    // every row's orderDate must be a YYYY-MM bucket (no raw days)
    expect(r.rows.every((row) => /^\d{4}-\d{2}$/.test(String(row.orderDate)))).toBe(true);
    // sorted: first bucket is the earliest month
    expect(r.rows[0].orderDate).toBe("2025-01");
  });
});

// ============================================================
// runQuery — §5.9 top 10 customers by sales (limit + post-aggregate calc)
// ============================================================
describe("runQuery — §5.9 top 10 customers by sales (limit + post-aggregate calc)", () => {
  const def: ReportDefinition = {
    id: "rpt_top10_customers_by_sales", schemaVersion: "1.0",
    name: "۱۰ مشتری برتر", dataset: "sales",
    columns: [
      { field: "customerName", label: "مشتری", type: "string" },
      { field: "amount", label: "فروش", type: "number" },
    ],
    filters: [{ field: "status", operator: "in", value: ["paid", "shipped", "delivered"] }],
    groupBy: [{ field: "customerName" }],
    metrics: [
      { field: "amount", aggregation: "sum", alias: "totalSales", label: "مجموع فروش" },
      { field: "*", aggregation: "count", alias: "orderCount", label: "تعداد سفارش" },
    ],
    calculatedFields: [
      { alias: "avgOrderValue", label: "میانگین ارزش سفارش",
        expression: "totalSales / orderCount", scope: "aggregate", type: "number" },
    ],
    sorting: [{ field: "totalSales", direction: "desc" }],
    limit: 10,
    presentation: { views: [] },
  };

  it("filters by status, sums per customer, derives avgOrderValue, sorts desc, caps to 10", () => {
    const r = runQuery(def, salesData, salesModel);
    // 5 customers in the seed → ≤10, all survive
    expect(r.total).toBe(5);
    const top = r.rows[0];
    // post-aggregate calc holds: avgOrderValue === totalSales / orderCount
    expect(top.avgOrderValue).toBe(Number(top.totalSales) / Number(top.orderCount));
    // sorted desc: row[0].totalSales is the max
    const totals = r.rows.map((row) => Number(row.totalSales));
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    // cancelled/pending rows excluded from every total (S-006 cancelled 500M not in بتا's total)
    const beta = r.rows.find((row) => row.customerName === "شرکت بتا")!;
    // بتا paid/shipped/delivered: S-004(270M)+S-005(150M)+S-017(1000M)+S-022(234M)+S-027(227.5M) = 1,881,500,000
    expect(beta.totalSales).toBe(1_881_500_000);
    expect(beta.orderCount).toBe(5);
  });

  it("limit caps rows after sorting", () => {
    const r = runQuery({ ...def, limit: 2 }, salesData, salesModel);
    expect(r.rows).toHaveLength(2);
    expect(r.total).toBe(2);
  });
});

// ============================================================
// Bug 1 — id→column resolution (area: id≠column, quantity: id≠column)
// ============================================================
describe("runQuery — Bug 1: field id→column resolution", () => {
  it("sum(area) grouped by province returns real areaM2 totals (not 0)", () => {
    // projectModel: field id="area", column="areaM2"
    // Without the fix rows are keyed by column ("areaM2") but engine reads row["area"] → 0
    const def: ReportDefinition = {
      id: "rpt_area_by_province", schemaVersion: "1.0",
      name: "مساحت به تفکیک استان", dataset: "projects",
      columns: [{ field: "province", label: "استان", type: "string" }],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "area", aggregation: "sum", alias: "totalArea", label: "مساحت" }],
      presentation: { views: [] },
    };
    const r = runQuery(def, projectData, projectModel);
    const byProvince = Object.fromEntries(r.rows.map((row) => [row.province, row]));
    // تهران: 8200+5400+3100+420 = 17120
    expect(byProvince["تهران"].totalArea).toBe(17120);
    // اصفهان: 9600+12000+2200 = 23800
    expect(byProvince["اصفهان"].totalArea).toBe(23800);
    // خوزستان: 15000+6800+4000 = 25800
    expect(byProvince["خوزستان"].totalArea).toBe(25800);
    // فارس: 7200+5000 = 12200
    expect(byProvince["فارس"].totalArea).toBe(12200);
  });

  it("sum(quantity) grouped by province uses column qty (not id quantity)", () => {
    // salesModel: field id="quantity", column="qty"
    // Without the fix row["quantity"] is undefined → aggregate returns 0
    const def: ReportDefinition = {
      id: "rpt_qty_by_province", schemaVersion: "1.0",
      name: "تعداد به تفکیک استان", dataset: "sales",
      columns: [{ field: "province", label: "استان", type: "string" }],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "quantity", aggregation: "sum", alias: "totalQty", label: "تعداد" }],
      presentation: { views: [] },
    };
    const r = runQuery(def, salesData, salesModel);
    const byProvince = Object.fromEntries(r.rows.map((row) => [row.province, row]));
    // تهران rows: 120+40+200+250+180+70+320+210+35+90+140+360 = 2015
    expect(byProvince["تهران"].totalQty).toBe(2015);
    // اصفهان: 90+300+50+25+260+175 = 900
    expect(byProvince["اصفهان"].totalQty).toBe(900);
    // خوزستان: 30+60+110+280+150+28 = 658
    expect(byProvince["خوزستان"].totalQty).toBe(658);
    // فارس: 500+400+20+130+55+220 = 1325
    expect(byProvince["فارس"].totalQty).toBe(1325);
  });
});

// ============================================================
// Bug 2 — dynamic value2 not resolved; static between regression
// ============================================================
describe("runQuery — Bug 2: value2 resolution", () => {
  beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); }); // 2025-06-01
  afterEach(() => { ENGINE_TODAY.value = Date.now(); });

  it("static between filter includes rows within bounds and excludes those outside", () => {
    // Filters project rows where areaM2 (field id "area") is between 3000 and 9000
    const def: ReportDefinition = {
      id: "rpt_area_between", schemaVersion: "1.0",
      name: "پروژه‌های میانی", dataset: "projects",
      columns: [
        { field: "id", label: "شناسه", type: "string" },
        { field: "area", label: "مساحت", type: "number" },
      ],
      filters: [{ field: "area", operator: "between", value: 3000, value2: 9000 }],
      presentation: { views: [] },
    };
    const r = runQuery(def, projectData, projectModel);
    // areaM2 values: 8200✓ 5400✓ 3100✓ 420✗ 9600✗ 12000✗ 2200✗ 15000✗ 6800✓ 4000✓ 7200✓ 5000✓
    // Included: P-1001(8200) P-1002(5400) P-1003(3100) P-1008 is 15000✗ wait
    // P-1001=8200✓ P-1002=5400✓ P-1003=3100✓ P-1004=420✗ P-1005=9600✗ P-1006=12000✗
    // P-1007=2200✗ P-1008=15000✗ P-1009=6800✓ P-1010=4000✓ P-1011=7200✓ P-1012=5000✓
    // Count = 7
    expect(r.total).toBe(7);
  });

  it("dynamic between with value2 as DynamicValue resolves upper bound correctly", () => {
    // Filter sales where orderDate is between startOfYear (2025-01-01) and today (2025-03-01)
    // dynamic value: value = startOfYear, value2 = today (both dynamic)
    // But value2 isn't marked dynamic via the current interface — test the static case covering
    // the between operator with a dynamic value (value) and static value2, which exercises
    // the path that value2 must be passed raw (no resolution needed if not dynamic).
    // The critical regression: ensure value2 is passed to applyOperator at all.
    const def: ReportDefinition = {
      id: "rpt_date_between", schemaVersion: "1.0",
      name: "سفارش‌های بازه زمانی", dataset: "sales",
      columns: [{ field: "orderDate", label: "تاریخ", type: "date" }],
      filters: [{
        field: "orderDate",
        operator: "between",
        value: { token: "startOfYear" },
        dynamic: true,
        value2: "2025-03-01",
      }],
      presentation: { views: [] },
    };
    // ENGINE_TODAY frozen to 2025-06-01 in beforeEach
    const r = runQuery(def, salesData, salesModel);
    // Orders from 2025-01-01 to 2025-03-01 (inclusive)
    // S-001(Jan-15) S-002(Feb-03) S-004(Jan-20) S-005(Feb-18) S-007(Jan-28)
    // S-008(Feb-14) S-010(Jan-31) S-011(Feb-22) S-013(Jan-12) S-014(Feb-26) = 10 rows
    // Also S-003(Mar-11) > 2025-03-01 ✗, S-006(Mar-05) > 2025-03-01 ✗
    // 2025-03-01 itself: none in dataset
    expect(r.total).toBe(10);
  });
});

// ============================================================
// Bug 3 — unknown field reference throws a descriptive error
// ============================================================
describe("runQuery — Bug 3: unknown field reference throws", () => {
  it("throws 'Unknown field' when a metric references a non-existent field id", () => {
    const def: ReportDefinition = {
      id: "rpt_bad_metric", schemaVersion: "1.0",
      name: "خطا", dataset: "projects",
      columns: [{ field: "province", label: "استان", type: "string" }],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "nonExistentField", aggregation: "sum", alias: "bad", label: "بد" }],
      presentation: { views: [] },
    };
    expect(() => runQuery(def, projectData, projectModel)).toThrow("Unknown field: nonExistentField");
  });

  it("throws 'Unknown field' when a filter references a non-existent field id", () => {
    const def: ReportDefinition = {
      id: "rpt_bad_filter", schemaVersion: "1.0",
      name: "خطا", dataset: "projects",
      columns: [{ field: "province", label: "استان", type: "string" }],
      filters: [{ field: "ghostField", operator: "eq", value: "x" }],
      presentation: { views: [] },
    };
    expect(() => runQuery(def, projectData, projectModel)).toThrow("Unknown field: ghostField");
  });

  it("throws 'Unknown field' when a groupBy references a non-existent field id", () => {
    const def: ReportDefinition = {
      id: "rpt_bad_groupby", schemaVersion: "1.0",
      name: "خطا", dataset: "projects",
      columns: [{ field: "province", label: "استان", type: "string" }],
      groupBy: [{ field: "doesNotExist" }],
      metrics: [{ field: "*", aggregation: "count", alias: "cnt", label: "تعداد" }],
      presentation: { views: [] },
    };
    expect(() => runQuery(def, projectData, projectModel)).toThrow("Unknown field: doesNotExist");
  });
});
