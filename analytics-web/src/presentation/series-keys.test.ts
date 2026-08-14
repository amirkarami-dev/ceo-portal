import { describe, it, expect } from "vitest";
import type { QueryResult } from "@/contracts";
import type { ReportView } from "@/contracts/presentation";
import { seriesKeysOf } from "./series-keys";

const view = (mapping: Record<string, unknown>): ReportView =>
  ({ type: "chart", library: "recharts", component: "BarChart", mapping }) as unknown as ReportView;

const result = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "sum_amount", label: "sum_amount", type: "number", isMetric: true },
    { key: "cnt", label: "cnt", type: "number", isMetric: true },
  ],
  rows: [],
  total: 0,
} as unknown as QueryResult;

describe("seriesKeysOf", () => {
  it("takes an explicit list of y keys", () => {
    expect(seriesKeysOf(view({ x: "province", y: ["sum_amount", "cnt"] }))).toEqual([
      "sum_amount",
      "cnt",
    ]);
  });

  it("takes a single y key", () => {
    expect(seriesKeysOf(view({ x: "province", y: "sum_amount" }))).toEqual(["sum_amount"]);
  });

  it("falls back to `measure` — how a pie names its value", () => {
    expect(seriesKeysOf(view({ category: "province", measure: "sum_amount" }))).toEqual([
      "sum_amount",
    ]);
  });

  // The renderers pass no result and rely on getting nothing back: they already draw nothing for a
  // view that names no series. Adding a fallback there would change what they plot.
  it("returns nothing without a result when the view names no series", () => {
    expect(seriesKeysOf(view({ x: "province" }))).toEqual([]);
    expect(seriesKeysOf(undefined)).toEqual([]);
  });

  it("guesses the metric columns when given a result and the view names nothing", () => {
    expect(seriesKeysOf(view({ x: "province" }), result)).toEqual(["sum_amount", "cnt"]);
  });

  it("prefers what the view says over the guess", () => {
    expect(seriesKeysOf(view({ x: "province", y: "cnt" }), result)).toEqual(["cnt"]);
  });

  it("drops duplicates and blanks, so no series gets two pencils", () => {
    expect(seriesKeysOf(view({ y: ["sum_amount", "sum_amount", ""] }))).toEqual(["sum_amount"]);
  });
});
