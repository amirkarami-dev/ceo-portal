import { describe, it, expect } from "vitest";
import { aggregateByCategory } from "./chart-utils";

/**
 * These lived in `RechartsRenderer.test.tsx` and moved here when that file was deleted.
 *
 * Nothing in them is about a chart library — `aggregateByCategory` is a pure function over rows, and
 * both renderers called it. They were only ever in a file named after the library because that is
 * where the function used to live. Left there they would have been deleted as collateral, and the
 * loss would have been silent: the helper is still used by the donut and by the cartesian path.
 */
describe("aggregateByCategory", () => {
  it("merges duplicate categories and sums the value keys (first-seen order)", () => {
    const rows = [
      { m: "2025-01", v: 100 },
      { m: "2025-01", v: 50 },
      { m: "2025-02", v: 30 },
    ];
    const result = aggregateByCategory(rows, "m", ["v"]);
    expect(result).toEqual([
      { m: "2025-01", v: 150 },
      { m: "2025-02", v: 30 },
    ]);
  });

  it("passes through already-unique categories unchanged (no-op)", () => {
    const rows = [
      { province: "Tehran", revenue: 1200 },
      { province: "Fars", revenue: 800 },
      { province: "Isfahan", revenue: 600 },
    ];
    const result = aggregateByCategory(rows, "province", ["revenue"]);
    expect(result).toEqual([
      { province: "Tehran", revenue: 1200 },
      { province: "Fars", revenue: 800 },
      { province: "Isfahan", revenue: 600 },
    ]);
  });

  it("treats null and non-numeric values as 0 in the sum", () => {
    const rows = [
      { cat: "A", val: null },
      { cat: "A", val: 42 },
      { cat: "B", val: "not-a-number" },
      { cat: "B", val: 10 },
    ];
    const result = aggregateByCategory(rows, "cat", ["val"]);
    expect(result).toEqual([
      { cat: "A", val: 42 },
      { cat: "B", val: 10 },
    ]);
  });
});
