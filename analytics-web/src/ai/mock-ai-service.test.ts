import { describe, it, expect } from "vitest";
import { MockReportAIService } from "./mock-ai-service";
import { normalizePrompt } from "./rules";
import { salesModel, projectModel } from "../semantic/registry";
import type { GenerateReportRequest } from "../contracts/ai";

const ai = new MockReportAIService();
const req = (
  prompt: string,
  semanticModel = salesModel,
  locale: "fa" | "en" = "fa",
): GenerateReportRequest => ({ prompt, semanticModel, locale });

describe("normalizePrompt", () => {
  it("lowercases english, normalizes arabic ي/ك and persian digits, collapses whitespace", () => {
    expect(normalizePrompt("  Monthly  Revenue ")).toBe("monthly revenue");
    expect(normalizePrompt("درآمد ماهانه")).toBe("درامد ماهانه"); // diacritic-stripped
    expect(normalizePrompt("استان كرمان ١٠")).toBe("استان کرمان 10"); // ك→ک, ١٠→10
  });
});

describe("MockReportAIService.generate — canonical example prompts", () => {
  it("fa «درآمد ماهانه به تفکیک استان» → monthly revenue by province (5.8)", async () => {
    const res = await ai.generate(req("درآمد ماهانه به تفکیک استان", salesModel));
    const d = res.definition;
    expect(res.matchedExample).toBe("revenue-monthly-by-province");
    expect(d.dataset).toBe("sales");
    expect(d.groupBy).toEqual([
      { field: "orderDate", dateBucket: "month" },
      { field: "province" },
    ]);
    expect(d.metrics).toEqual([
      expect.objectContaining({ field: "amount", aggregation: "sum", alias: "revenue" }),
    ]);
    expect(d.sorting?.[0]).toMatchObject({ field: "orderDate", direction: "asc" });
    // never invents fields / never emits SQL:
    expect(JSON.stringify(d).toLowerCase()).not.toContain("select ");
  });

  it("en «Monthly revenue by province» matches the same example", async () => {
    const res = await ai.generate(req("Monthly revenue by province", salesModel, "en"));
    expect(res.matchedExample).toBe("revenue-monthly-by-province");
    expect(res.definition.dataset).toBe("sales");
  });

  it("fa «۱۰ مشتری برتر بر اساس فروش» → top-10 customers by sales (5.9)", async () => {
    const res = await ai.generate(req("۱۰ مشتری برتر بر اساس فروش", salesModel));
    const d = res.definition;
    expect(res.matchedExample).toBe("top-customers-by-sales");
    expect(d.groupBy).toEqual([{ field: "customerName" }]);
    expect(d.metrics?.[0]).toMatchObject({ field: "amount", aggregation: "sum", alias: "totalSales" });
    expect(d.sorting?.[0]).toMatchObject({ field: "totalSales", direction: "desc" });
    expect(d.limit).toBe(10);
  });

  it("fa «پروژه‌هایی که بیش از ۳۰ روز تأخیر دارند را بر اساس استان نشان بده» → delayed projects (5.7)", async () => {
    const res = await ai.generate(req("پروژه هایی که بیش از 30 روز تاخیر دارند را بر اساس استان نشان بده", projectModel));
    const d = res.definition;
    expect(res.matchedExample).toBe("delayed-projects-by-province");
    expect(d.dataset).toBe("projects");
    expect(d.groupBy).toEqual([{ field: "province" }]);
    expect(d.filters?.some((f) => f.dynamic && f.field === "dueDate")).toBe(true);
  });
});

describe("MockReportAIService.generate — rule fallback", () => {
  it("an unknown-but-on-topic prompt still returns a schema-correct definition", async () => {
    const res = await ai.generate(req("میانگین تعداد به تفکیک کانال فروش", salesModel));
    const d = res.definition;
    expect(res.matchedExample).toBeUndefined();
    // required fields present:
    expect(d.schemaVersion).toBe("1.0");
    expect(d.dataset).toBe("sales");
    expect(d.columns.length).toBeGreaterThan(0);
    expect(d.metrics?.length).toBeGreaterThan(0);
    expect(d.presentation.views.length).toBeGreaterThan(0);
    // every referenced field id exists in the model OR is a metric alias (no invented fields):
    const fieldIds = new Set(salesModel.entities[0].fields.map((f) => f.id));
    const aliases = new Set((d.metrics ?? []).map((m) => m.alias!));
    for (const g of d.groupBy ?? []) expect(fieldIds.has(g.field)).toBe(true);
    for (const c of d.columns) expect(fieldIds.has(c.field) || aliases.has(c.field)).toBe(true);
    // never emits raw SQL:
    expect(JSON.stringify(d).toLowerCase()).not.toMatch(/select\s|from\s|where\s/);
  });

  it("a totally off-topic prompt falls back to a count metric, no crash", async () => {
    const res = await ai.generate(req("سلام خوبی", salesModel));
    expect(res.definition.metrics?.[0]).toMatchObject({ aggregation: "count" });
    expect(res.definition.presentation.views.length).toBeGreaterThan(0);
  });
});
