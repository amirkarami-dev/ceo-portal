// report-web/src/app/demo-clock.test.ts
//
// TDD RED → GREEN for Bug B: "Monthly revenue by province" returns 0 rows when
// the engine clock is at the real "now" (2026), because all sales rows are dated 2025.
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ENGINE_TODAY, runQuery } from "@/query/engine";
import { EXAMPLES } from "@/ai/examples";
import { salesModel } from "@/semantic/registry";
import { getDataset } from "@/semantic/registry";

describe("demo-clock — Bug B regression", () => {
  let originalClock: number;

  beforeEach(() => {
    // Capture whatever value is set so we can restore it cleanly.
    originalClock = ENGINE_TODAY.value;
  });

  afterEach(() => {
    // Always restore so other tests stay unaffected.
    ENGINE_TODAY.value = originalClock;
  });

  it("RED (sanity): with a real 2026 clock, revenue-monthly-by-province returns 0 rows", () => {
    // Simulate the real clock at runtime (somewhere in 2026).
    ENGINE_TODAY.value = Date.UTC(2026, 0, 1); // 2026-01-01

    const example = EXAMPLES.find((e) => e.id === "revenue-monthly-by-province");
    expect(example).toBeDefined();

    const def = example!.build(salesModel);
    const dataset = getDataset(def.dataset);
    const result = runQuery(def, dataset, salesModel);

    // With clock in 2026, startOfYear resolves to "2026-01-01".
    // All sales rows are in 2025, so the gte filter excludes everything → 0 rows.
    expect(result.total).toBe(0);
  });

  it("GREEN: after initDemoClock(), revenue-monthly-by-province returns > 0 rows", async () => {
    // Simulate the engine starting with the real clock (2026).
    ENGINE_TODAY.value = Date.UTC(2026, 0, 1);

    // Apply the demo-clock fix — must set ENGINE_TODAY to 2025-06-01.
    const { initDemoClock } = await import("@/app/demo-clock");
    initDemoClock();

    const example = EXAMPLES.find((e) => e.id === "revenue-monthly-by-province");
    expect(example).toBeDefined();

    const def = example!.build(salesModel);
    const dataset = getDataset(def.dataset);
    const result = runQuery(def, dataset, salesModel);

    // With clock pinned to 2025-06-01, startOfYear = "2025-01-01",
    // which is ≤ the oldest sale row → rows should come through.
    expect(result.total).toBeGreaterThan(0);
  });
});
