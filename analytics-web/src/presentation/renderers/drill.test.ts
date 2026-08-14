import { describe, it, expect } from "vitest";
import type { GroupNode } from "../../contracts/dataset";
import { resolveDrillTarget } from "./drill";

const group = (value: string | number | null): GroupNode =>
  ({ key: String(value), value, rows: [] }) as unknown as GroupNode;

describe("resolveDrillTarget", () => {
  it("finds the group whose value matches the clicked category", () => {
    const groups = [group("Tehran"), group("Fars"), group("Yazd")];

    expect(resolveDrillTarget(groups, "Fars")?.value).toBe("Fars");
  });

  /**
   * The bug this replaces, reproduced. `groups` is in bucket-insertion order; the chart is in sorted
   * row order. Indexing gave the wrong report for every bar.
   */
  it("is right where indexing was wrong — a sorted chart against unsorted groups", () => {
    const groups = [group("Tehran"), group("Fars"), group("Yazd")]; // insertion order
    const bars = ["Fars", "Yazd", "Tehran"]; // what a desc sort draws

    bars.forEach((bar, i) => {
      expect(resolveDrillTarget(groups, bar)?.value, `bar ${i}`).toBe(bar);
      // and the old behaviour would have been wrong here
      expect(groups[i].value).not.toBe(bar);
    });
  });

  it("survives a chart shorter than groups, which aggregation and dropped nulls both cause", () => {
    const groups = [group("Tehran"), group(null), group("Fars")];

    // Two bars against three groups: indexing bar 1 gave the null group.
    expect(resolveDrillTarget(groups, "Fars")?.value).toBe("Fars");
  });

  it("matches the null bucket, so a click on the blank tick still drills", () => {
    const groups = [group("Tehran"), group(null)];

    expect(resolveDrillTarget(groups, null)).toBeDefined();
    expect(resolveDrillTarget(groups, null)?.value).toBeNull();
    expect(resolveDrillTarget(groups, undefined)?.value).toBeNull();
  });

  it("does not confuse a missing value with an empty string", () => {
    const groups = [group(null), group("")];

    expect(resolveDrillTarget(groups, null)?.value).toBeNull();
    expect(resolveDrillTarget(groups, "")?.value).toBe("");
  });

  it("compares across number and string, because the chart round-trips values", () => {
    const groups = [group(1404), group(1405)];

    expect(resolveDrillTarget(groups, "1405")?.value).toBe(1405);
    expect(resolveDrillTarget([group("1405")], 1405)?.value).toBe("1405");
  });

  it("returns nothing rather than guessing when the category is unknown", () => {
    expect(resolveDrillTarget([group("Tehran")], "Nowhere")).toBeUndefined();
  });

  it("returns nothing when there are no groups at all", () => {
    expect(resolveDrillTarget(undefined, "Tehran")).toBeUndefined();
    expect(resolveDrillTarget([], "Tehran")).toBeUndefined();
  });
});
