import { describe, it, expect } from "vitest";
import { BASE_CAPACITY, BASE_CONFIG, buildQuotaModels } from "./quota";
import { MOCK_QUOTA_ROW } from "./fetch";
import type { QuotaRow } from "./contract";

/**
 * The whole report is four subtractions and a clamp, so this is where correctness is decided. The
 * fixtures are the real procedure output supplied with the brief, worked through by hand in
 * `docs/design/2026-08-15-custom-reports-engineer-quota.md`.
 */
describe("buildQuotaModels", () => {
  const models = buildQuotaModels(MOCK_QUOTA_ROW);

  it("produces the four bases in display order — ارشد first, not numeric", () => {
    // Neither numeric order nor the order the procedure returns its columns in. It is the reference
    // UI's, which is why BASE_CONFIG is an ordered array and not a map keyed by base number.
    expect(models.map((m) => m.base)).toEqual([4, 1, 2, 3]);
    expect(models.map((m) => m.title)).toEqual(["پایه ارشد", "پایه یک", "پایه دو", "پایه سه"]);
  });

  it("computes used and remaining for every base", () => {
    // Asserted exactly, not with a tolerance: these sums are exact in binary floating point for this
    // row, which was checked before the numbers were written down.
    expect(
      models.map((m) => [m.title, m.usedCapacity, m.totalCapacity, m.remainingCapacity, m.engineerCount]),
    ).toEqual([
      ["پایه ارشد", 2357.45, 20_000, 17_642.55, 2],
      ["پایه یک", 10_145.98, 160_000, 149_854.02, 16],
      ["پایه دو", 8_980.25, 72_000, 63_019.75, 21],
      ["پایه سه", 11_754.55, 48_000, 36_245.45, 55],
    ]);
  });

  it("maps design and supervision to the right fields, per base", () => {
    // The brief says "do not swap the fields" — this is that instruction as a test. Base 4's
    // supervision is 0 and base 3's is 9405.64, so a swap anywhere is visible here.
    expect(models.map((m) => [m.designUsed, m.supervisionUsed])).toEqual([
      [2357.45, 0],
      [9034.42, 1111.56],
      [6362.96, 2617.29],
      [2348.91, 9405.64],
    ]);
  });

  it("combines design and supervision rather than keeping them apart", () => {
    for (const m of models) {
      expect(m.usedCapacity).toBe(m.designUsed + m.supervisionUsed);
    }
  });

  it("never reports a negative remainder", () => {
    // The procedure can report more consumed than the fixed capacity allows. Unclamped, the donut
    // would draw a negative slice — a nonsense ring rather than the overrun it represents.
    const over: QuotaRow = { ...MOCK_QUOTA_ROW, usedInTarahi_4: 19_000, usedInNezart_4: 5_000 };
    const senior = buildQuotaModels(over)[0];

    expect(senior.usedCapacity).toBe(24_000);
    expect(senior.remainingCapacity).toBe(0);
  });

  it("treats a missing or non-numeric field as nothing consumed", () => {
    // A shape the endpoint should never send, but NaN painted across a ring is a worse failure than
    // a zero, and it would reach the screen rather than a log.
    const broken = { ...MOCK_QUOTA_ROW, usedInTarahi_1: undefined, cntEngin_1: null } as unknown as QuotaRow;
    const one = buildQuotaModels(broken)[1];

    expect(one.designUsed).toBe(0);
    expect(one.usedCapacity).toBe(1111.56);
    expect(one.engineerCount).toBe(0);
    expect(Number.isNaN(one.remainingCapacity)).toBe(false);
  });
});

describe("BASE_CAPACITY", () => {
  it("is the four fixed capacities from the business rule", () => {
    expect(BASE_CAPACITY).toEqual({ 4: 20_000, 1: 160_000, 2: 72_000, 3: 48_000 });
  });

  it("is frozen, so no caller can localise a 'fix'", () => {
    // Not from SQL, not from the API, not user-editable — a second source of truth for these would
    // be a silent divergence between two cities.
    expect(Object.isFrozen(BASE_CAPACITY)).toBe(true);
  });

  it("does not vary with the report's parameters", () => {
    // Same capacities for every city and discipline: the models built from any row carry them.
    const other = buildQuotaModels({ ...MOCK_QUOTA_ROW, usedInTarahi_2: 1 });
    expect(other.map((m) => m.totalCapacity)).toEqual([20_000, 160_000, 72_000, 48_000]);
  });
});

describe("BASE_CONFIG", () => {
  it("names a distinct set of columns for each base", () => {
    // Guards the copy-paste failure the config exists to avoid: four near-identical blocks where one
    // still points at another base's column.
    const all = BASE_CONFIG.flatMap((c) => [c.designField, c.supervisionField, c.engineerCountField]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("names only fields the row actually has", () => {
    for (const c of BASE_CONFIG) {
      expect(MOCK_QUOTA_ROW).toHaveProperty(c.designField);
      expect(MOCK_QUOTA_ROW).toHaveProperty(c.supervisionField);
      expect(MOCK_QUOTA_ROW).toHaveProperty(c.engineerCountField);
    }
  });
});
