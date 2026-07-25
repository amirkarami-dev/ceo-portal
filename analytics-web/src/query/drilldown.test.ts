import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { drillInto, buildDrilldownDefinition } from "./drilldown";
import { ENGINE_TODAY } from "./engine";
import { projectModel } from "../semantic/models/project";
import { salesModel } from "../semantic/models/sales";
import { projectData } from "../semantic/datasets/project";
import { salesData } from "../semantic/datasets/sales";
import type { ReportDefinition } from "../contracts/report-definition";
import type { GroupNode } from "../contracts/dataset";

// helper: a clicked group node carrying the pinned dimension value
const node = (value: string | number): GroupNode => ({ key: String(value), value, rows: [] });

const delayedByProvince: ReportDefinition = {
  id: "rpt_delayed", schemaVersion: "1.0", name: "معوق", dataset: "projects",
  columns: [
    { field: "name", label: "نام", type: "string" },
    { field: "dueDate", label: "موعد", type: "date" },
    { field: "delayDays", label: "تأخیر", type: "number" },
  ],
  filters: [
    { field: "status", operator: "neq", value: "completed" },
    { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
  ],
  groupBy: [{ field: "province" }],
  metrics: [{ field: "*", aggregation: "count", alias: "delayedCount" }],
  drilldown: {
    enabled: true, paramField: "province", operator: "eq",
    targetDefinition: {
      id: "rpt_delayed_detail", schemaVersion: "1.0", name: "جزئیات", dataset: "projects",
      columns: [
        { field: "name", label: "نام", type: "string" },
        { field: "dueDate", label: "موعد", type: "date" },
        { field: "delayDays", label: "تأخیر", type: "number" },
      ],
      filters: [
        { field: "status", operator: "neq", value: "completed" },
        { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
      ],
      sorting: [{ field: "delayDays", direction: "desc" }],
      presentation: { views: [] },
    },
  },
  presentation: { views: [] },
};

describe("buildDrilldownDefinition", () => {
  it("injects the clicked value as a filter into the targetDefinition", () => {
    const child = buildDrilldownDefinition(delayedByProvince, node("تهران"));
    expect(child.id).toBe("rpt_delayed_detail");
    expect(child.filters).toEqual(
      expect.arrayContaining([{ field: "province", operator: "eq", value: "تهران" }]),
    );
  });

  it("falls back to an inline child (parent minus groupBy + pinned filter) when no target is given", () => {
    const noTarget: ReportDefinition = { ...delayedByProvince, drilldown: { enabled: true, paramField: "province" } };
    const child = buildDrilldownDefinition(noTarget, node("اصفهان"));
    expect(child.groupBy).toBeUndefined();
    expect(child.filters).toEqual(
      expect.arrayContaining([{ field: "province", operator: "eq", value: "اصفهان" }]),
    );
  });

  it("honours a custom drill operator", () => {
    const noTarget: ReportDefinition = {
      ...delayedByProvince,
      drilldown: { enabled: true, paramField: "province", operator: "contains" },
    };
    const child = buildDrilldownDefinition(noTarget, node("تهران"));
    expect(child.filters).toEqual(
      expect.arrayContaining([{ field: "province", operator: "contains", value: "تهران" }]),
    );
  });
});

describe("drillInto", () => {
  beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
  afterEach(() => { ENGINE_TODAY.value = Date.now(); });

  it("returns the 3 delayed projects in تهران, sorted by delay desc", () => {
    const { result: r } = drillInto(delayedByProvince, node("تهران"), projectData, projectModel);
    expect(r.total).toBe(3);
    expect(r.rows.map((x) => x.name)).toEqual([
      "ساختمان اداری پارس", // 90
      "مجتمع تجاری آرین",   // 60
      "برج مسکونی نیلوفر",  // 45
    ]);
    expect(r.rows.every((x) => x.dueDate !== undefined)).toBe(true);
  });

  it("drilling into a province with one delayed project returns one row", () => {
    const { result: r } = drillInto(delayedByProvince, node("فارس"), projectData, projectModel);
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("مرکز خرید فارس");
  });

  it("inline drill (no target) advances to the next groupBy dimension", () => {
    const twoDim: ReportDefinition = {
      id: "rpt_sales_prov_chan", schemaVersion: "1.0", name: "x", dataset: "sales",
      columns: [{ field: "province", type: "string" }, { field: "channel", type: "string" }, { field: "amount", type: "number" }],
      groupBy: [{ field: "province" }, { field: "channel" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "rev" }],
      drilldown: { enabled: true, paramField: "province" },
      presentation: { views: [] },
    };
    const { result: r } = drillInto(twoDim, node("تهران"), salesData, salesModel);
    // pinned to تهران, now grouped by the next dim (channel) only
    expect(r.rows.every((x) => x.channel !== undefined && x.province === undefined)).toBe(true);
    expect(new Set(r.rows.map((x) => x.channel)).size).toBe(r.rows.length); // one row per channel
  });
});
