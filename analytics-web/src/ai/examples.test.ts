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
    const chips = examplePromptsFor("model-engineer-projects");

    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c) => c.datasetKey === "model-engineer-projects")).toBe(true);
  });

  it("does not leak project chips into the members dataset", async () => {
    const { examplePromptsFor } = await loadReal();
    const labels = examplePromptsFor("model-oz-info").map((c) => c.label);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels).not.toContain("متراژ ظرفیت به تفکیک شهر");
    expect(labels).not.toContain("دسته‌بندی نوع پروژه‌ها ۱۴۰۵");
  });

  it("keeps the two visible datasets separate", async () => {
    const { examplePromptsFor } = await loadReal();
    const members = examplePromptsFor("model-oz-info");
    const projects = examplePromptsFor("model-engineer-projects");

    // Both must be real filtered sets, not the fallback.
    expect(members.length).toBeGreaterThan(0);
    expect(projects.length).toBeGreaterThan(0);

    // Disjoint — picking a chip must never silently switch the dataset.
    const overlap = members.filter((m) => projects.some((p) => p.id === m.id));
    expect(overlap).toHaveLength(0);
  });

  it("offers no chip for a dataset that is hidden from the picker", async () => {
    const { EXAMPLE_PROMPTS } = await loadReal();
    const { HIDDEN_MODEL_IDS } = await import("../semantic/registry");

    // A chip switches the picker to its own datasetKey on click. One pointing at a hidden
    // dataset would drop the user somewhere the picker cannot show or leave.
    const stranded = EXAMPLE_PROMPTS.filter((p) => HIDDEN_MODEL_IDS.has(p.datasetKey));
    expect(stranded.map((p) => p.id)).toEqual([]);
  });

  it("carries the three reports asked for on the project dataset", async () => {
    const { examplePromptsFor } = await loadReal();
    const chips = examplePromptsFor("model-engineer-projects");
    const byId = new Map(chips.map((c) => [c.id, c]));

    // 1) نوع پروژه‌ها در ۱۴۰۵ — needs both the count and the share, and the year.
    expect(byId.get("ep-type-1405")?.prompt).toContain("درصد");
    expect(byId.get("ep-type-1405")?.prompt).toContain("۱۴۰۵");

    // 2) متر کار، عادی در برابر توسعه بنا.
    expect(byId.get("ep-meter-normal-vs-afza")?.prompt).toContain("توسعه بنا");

    // 3) متراژ به تفکیک صلاحیت، فقط ۱ تا ۸.
    expect(byId.get("ep-meter-by-qualification")?.prompt).toContain("صلاحیت");
    expect(byId.get("ep-meter-by-qualification")?.prompt).toContain("۸");
  });

  it("no chip still uses the old «متراژ کارکرد» wording", async () => {
    const { EXAMPLE_PROMPTS } = await loadReal();
    // Meter is «متراژ درگیر در ظرفیت» now. A chip using the old words would ask the AI for a
    // field name that no longer appears anywhere in the model.
    const stale = EXAMPLE_PROMPTS.filter(
      (p) => p.label.includes("متراژ کارکرد") || p.prompt.includes("متراژ کارکرد"),
    );
    expect(stale.map((p) => p.id)).toEqual([]);
  });

  it("every chip points at a dataset the picker actually offers", async () => {
    const { EXAMPLE_PROMPTS } = await loadReal();
    const { listSemanticModels } = await import("../semantic/registry");
    const offered = new Set(listSemanticModels().map((m) => m.key));

    for (const chip of EXAMPLE_PROMPTS) {
      expect(offered.has(chip.datasetKey), `chip "${chip.id}" → ${chip.datasetKey}`).toBe(true);
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
