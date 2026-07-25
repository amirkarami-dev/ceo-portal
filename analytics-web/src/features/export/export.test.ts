import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { QueryResult, ReportDefinition } from "@/contracts";
import { toCsv } from "./csv";
import { toJson } from "./json";
import { buildExportMenuItems } from "./index";

const result: QueryResult = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "revenue", label: "درآمد", type: "number", isMetric: true },
  ],
  rows: [
    { province: "Tehran", revenue: 1200 },
    { province: 'Is"fahan', revenue: 800 },
    { province: "Has, Comma", revenue: null },
    { province: "Line\nBreak", revenue: 0 },
  ],
  total: 4,
};

const def = {
  id: "rpt_x",
  schemaVersion: "1.0",
  name: "Revenue by Province",
  dataset: "sales",
  columns: [{ field: "province" }, { field: "revenue" }],
  presentation: { views: [] },
} as unknown as ReportDefinition;

describe("toCsv", () => {
  it("writes a header row from column labels then one row per result row", () => {
    const csv = toCsv(result);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("استان,درآمد");
    expect(lines).toHaveLength(5); // header + 4 rows
  });

  it("escapes quotes, commas, and newlines per RFC 4180; null → empty", () => {
    const csv = toCsv(result);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("Tehran,1200");
    expect(lines[2]).toBe('"Is""fahan",800'); // doubled quote, wrapped
    expect(lines[3]).toBe('"Has, Comma",'); // comma wrapped, null → empty
    expect(lines[4]).toBe('"Line\nBreak",0'); // newline wrapped, 0 preserved
  });

  it("returns just the header for an empty result", () => {
    const csv = toCsv({ columns: result.columns, rows: [], total: 0 });
    expect(csv).toBe("استان,درآمد");
  });
});

describe("toJson", () => {
  it("emits a pretty object with the full definition + columns + rows + total", () => {
    const obj = JSON.parse(toJson(def, result));
    expect(obj.definition.id).toBe("rpt_x");
    expect(obj.result.total).toBe(4);
    expect(obj.result.columns).toHaveLength(2);
    expect(obj.result.rows[0]).toEqual({ province: "Tehran", revenue: 1200 });
  });
});

describe("buildExportMenuItems", () => {
  it("offers CSV, JSON, Excel, and PDF — all enabled", () => {
    const items = buildExportMenuItems(def, result) as Array<{
      key: string;
      disabled?: boolean;
    }>;
    const byKey = Object.fromEntries(items.filter((i) => i && i.key).map((i) => [i.key, i]));
    expect(byKey.csv.disabled).toBeFalsy();
    expect(byKey.json.disabled).toBeFalsy();
    expect(byKey.pdf.disabled).toBeFalsy();
    expect(byKey.excel.disabled).toBeFalsy();
  });

  it("CSV/JSON click handlers trigger a download (Blob + anchor)", () => {
    const click = vi.fn();
    const realAnchor = Object.assign(document.createElement("a"), { click });
    const createEl = vi.spyOn(document, "createElement").mockReturnValue(
      realAnchor as unknown as HTMLAnchorElement,
    );
    const items = buildExportMenuItems(def, result) as Array<{
      key: string;
      onClick?: () => void;
    }>;
    const csv = items.find((i) => i.key === "csv")!;
    csv.onClick?.();
    expect(click).toHaveBeenCalledTimes(1);
    createEl.mockRestore();
  });
});

beforeEach(() => {
  // jsdom: stub object-URL APIs used by downloadBlob
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());
