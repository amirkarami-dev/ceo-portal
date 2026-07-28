// analytics-web/src/ai/examples.test.ts
// The welfare chips only exist in REAL mode, so these tests stub VITE_USE_MOCK_API and
// re-import the module — the same idiom ai-service-factory.test.ts uses, because
// EXAMPLE_PROMPTS is picked at import time.

import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

/** Load examples.ts with the REAL (KurdNezam + welfare) chip set active. */
async function loadReal() {
  vi.stubEnv("VITE_USE_MOCK_API", "false");
  return import("./examples");
}

describe("examplePromptsFor — REAL mode", () => {
  it("returns only the chips for the selected dataset", async () => {
    const { examplePromptsFor } = await loadReal();
    const chips = examplePromptsFor("model-walfare-reservations");

    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c) => c.datasetKey === "model-walfare-reservations")).toBe(true);
  });

  it("does not leak welfare chips into the members dataset", async () => {
    const { examplePromptsFor } = await loadReal();
    const labels = examplePromptsFor("model-oz-info").map((c) => c.label);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels).not.toContain("رزروها به تفکیک وضعیت");
    expect(labels).not.toContain("درآمد ماهانه پرداخت‌ها");
  });

  it("keeps reservations and payments separate", async () => {
    const { examplePromptsFor } = await loadReal();
    const reservations = examplePromptsFor("model-walfare-reservations");
    const payments = examplePromptsFor("model-walfare-payments");

    // Both must be real filtered sets, not the fallback.
    expect(reservations.length).toBeGreaterThan(0);
    expect(payments.length).toBeGreaterThan(0);

    // Disjoint — picking a chip must never silently switch the dataset.
    const overlap = reservations.filter((r) => payments.some((p) => p.id === r.id));
    expect(overlap).toHaveLength(0);
  });

  it("covers every welfare model with at least one chip", async () => {
    const { examplePromptsFor } = await loadReal();

    for (const key of [
      "model-walfare-reservations",
      "model-walfare-payments",
      "model-walfare-pools",
    ]) {
      const chips = examplePromptsFor(key);
      expect(chips.every((c) => c.datasetKey === key), `${key} fell back`).toBe(true);
    }
  });
});

describe("examplePromptsFor — fallback", () => {
  it("returns every chip for an unknown key, so the row is never empty", async () => {
    const { EXAMPLE_PROMPTS, examplePromptsFor } = await loadReal();

    expect(examplePromptsFor("no-such-model")).toEqual(EXAMPLE_PROMPTS);
    expect(examplePromptsFor("")).toEqual(EXAMPLE_PROMPTS);
  });

  it("leaves mock mode untouched — its chips key off entity sources, not model ids", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    const { EXAMPLE_PROMPTS, examplePromptsFor } = await import("./examples");

    // "model-sales" matches no mock chip (they use "sales"), so the full list is shown —
    // exactly the behaviour before dataset filtering existed.
    expect(examplePromptsFor("model-sales")).toEqual(EXAMPLE_PROMPTS);
  });
});
