import { describe, it, expect } from "vitest";
import { runQuery } from "./engine";
import { financeModel } from "../semantic/models/finance";
import { salesModel } from "../semantic/models/sales";
import { financeData } from "../semantic/datasets/finance";
import type { Dataset } from "../contracts/dataset";
import type { ReportDefinition } from "../contracts/report-definition";

describe("engine edge cases", () => {
  it("empty result: a filter matching no rows → total 0, rows [], columns still resolved", () => {
    const def: ReportDefinition = {
      id: "e1", schemaVersion: "1.0", name: "x", dataset: "finance",
      columns: [{ field: "account", type: "string" }, { field: "amount", type: "number" }],
      filters: [{ field: "account", operator: "eq", value: "__does_not_exist__" }],
      groupBy: [{ field: "account" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
      presentation: { views: [] },
    };
    const r = runQuery(def, financeData, financeModel);
    expect(r.total).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.columns.map((c) => c.key)).toEqual(["account", "total"]);
  });

  it("aggregate over an empty set (no groupBy, no matching rows) → single row of zeros", () => {
    const def: ReportDefinition = {
      id: "e2", schemaVersion: "1.0", name: "x", dataset: "finance",
      columns: [{ field: "amount", type: "number" }],
      filters: [{ field: "type", operator: "eq", value: "__none__" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
      presentation: { views: [] },
    };
    const r = runQuery(def, financeData, financeModel);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].total).toBe(0);
  });

  it("all-null measure: avg over null marginPct rows → 0 (null-guarded), count still counts rows", () => {
    const def: ReportDefinition = {
      id: "e3", schemaVersion: "1.0", name: "x", dataset: "finance",
      columns: [{ field: "amount", type: "number" }],
      filters: [{ field: "marginPct", operator: "isNull" }],
      metrics: [
        { field: "marginPct", aggregation: "avg", alias: "avgMargin" },
        { field: "*", aggregation: "count", alias: "n" },
      ],
      presentation: { views: [] },
    };
    const r = runQuery(def, financeData, financeModel);
    expect(r.rows[0].n).toBe(2);        // T-010, T-015 have null marginPct
    expect(r.rows[0].avgMargin).toBe(0); // no numeric values → 0
  });

  it("countDistinct: distinct accounts = 5, distinct cost centers = 4", () => {
    const def: ReportDefinition = {
      id: "e4", schemaVersion: "1.0", name: "x", dataset: "finance",
      columns: [{ field: "amount", type: "number" }],
      metrics: [
        { field: "account", aggregation: "countDistinct", alias: "accounts" },
        { field: "costCenter", aggregation: "countDistinct", alias: "centers" },
      ],
      presentation: { views: [] },
    };
    const r = runQuery(def, financeData, financeModel);
    expect(r.rows[0].accounts).toBe(5);
    expect(r.rows[0].centers).toBe(4);
  });

  it("null grouping key buckets nulls together under a stable key", () => {
    const data: Dataset = [
      { account: "A", amount: 10, marginPct: null, costCenter: null, type: "x", txnId: "1", txnDate: "2025-01-01" },
      { account: "A", amount: 20, marginPct: null, costCenter: null, type: "x", txnId: "2", txnDate: "2025-01-01" },
      { account: "A", amount: 5,  marginPct: null, costCenter: "Z",  type: "x", txnId: "3", txnDate: "2025-01-01" },
    ];
    const def: ReportDefinition = {
      id: "e5", schemaVersion: "1.0", name: "x", dataset: "finance",
      columns: [{ field: "costCenter", type: "string" }, { field: "amount", type: "number" }],
      groupBy: [{ field: "costCenter" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
      presentation: { views: [] },
    };
    const r = runQuery(def, data, financeModel);
    expect(r.total).toBe(2); // null bucket (30) + "Z" bucket (5)
    const nullBucket = r.rows.find((x) => x.costCenter === null);
    expect(nullBucket?.total).toBe(30);
  });

  it("large dataset (10k rows) groups & sums correctly and fast", () => {
    const big: Dataset = Array.from({ length: 10_000 }, (_, i) => ({
      orderId: `S-${i}`, customerName: `C-${i % 50}`, product: "p", category: "c",
      province: i % 2 ? "تهران" : "اصفهان", channel: "آنلاین", status: "paid",
      qty: 1, amount: 100, orderDate: "2025-01-01",
    }));
    const def: ReportDefinition = {
      id: "e6", schemaVersion: "1.0", name: "x", dataset: "sales",
      columns: [{ field: "province", type: "string" }, { field: "amount", type: "number" }],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "total" }, { field: "*", aggregation: "count", alias: "n" }],
      sorting: [{ field: "total", direction: "desc" }],
      presentation: { views: [] },
    };
    const t0 = performance.now();
    const r = runQuery(def, big, salesModel);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(r.total).toBe(2);
    expect(r.rows.reduce((s, x) => s + Number(x.total), 0)).toBe(1_000_000); // 10k × 100
    expect(r.rows.reduce((s, x) => s + Number(x.n), 0)).toBe(10_000);
  });
});
