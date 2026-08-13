import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getSemanticModel,
  getDataset,
  getModelForDataset,
  semanticModels,
  datasets,
} from "./registry";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

/** Load the registry with the REAL (KurdNezam + welfare) model set active — the set is chosen at
 *  import time from VITE_USE_MOCK_API, so the module has to be re-imported to switch. */
async function loadReal() {
  vi.stubEnv("VITE_USE_MOCK_API", "false");
  return import("./registry");
}

describe("semantic registry", () => {
  it("resolves each model by id", () => {
    expect(getSemanticModel("model-project").entities[0].source).toBe("projects");
    expect(getSemanticModel("model-sales").entities[0].source).toBe("sales");
    expect(getSemanticModel("model-finance").entities[0].source).toBe("finance");
  });

  it("throws on an unknown model id", () => {
    expect(() => getSemanticModel("nope")).toThrow(/unknown semantic model/i);
  });

  it("resolves each dataset by source and returns the seeded row counts", () => {
    expect(getDataset("projects")).toHaveLength(12);
    expect(getDataset("sales")).toHaveLength(30);
    expect(getDataset("finance")).toHaveLength(20);
  });

  it("throws on an unknown dataset source", () => {
    expect(() => getDataset("nope")).toThrow(/unknown dataset/i);
  });

  it("pairs a dataset source back to its owning model", () => {
    expect(getModelForDataset("sales").id).toBe("model-sales");
    expect(getModelForDataset("projects").id).toBe("model-project");
    expect(getModelForDataset("finance").id).toBe("model-finance");
  });

  it("throws on an unknown dataset source when pairing to a model", () => {
    expect(() => getModelForDataset("nope")).toThrow(/unknown dataset source/i);
  });

  it("exposes the maps keyed correctly", () => {
    expect(Object.keys(semanticModels).sort()).toEqual(["model-finance", "model-project", "model-sales"]);
    expect(Object.keys(datasets).sort()).toEqual(["finance", "projects", "sales"]);
  });

  it("hides the welfare datasets from the picker but keeps them resolvable", async () => {
    const reg = await loadReal();
    const offered = reg.listSemanticModels().map((m) => m.key);

    // Off the picker…
    expect(offered).toEqual(["model-oz-info", "model-engineer-projects"]);

    // …but still reachable, so a report or widget already saved against one still opens.
    // This is the whole point of hiding rather than deleting.
    for (const id of reg.HIDDEN_MODEL_IDS) {
      expect(reg.getSemanticModel(id).id, `${id} by id`).toBe(id);
    }
    expect(reg.getModelForDataset("walfare_reservations").id).toBe("model-walfare-reservations");
  });

  it("keeps «اعضا و پروانه‌ها» first, because that is the pre-selected dataset", async () => {
    const reg = await loadReal();
    // useAskAi takes listSemanticModels()[0] as the default. Filtering must not change which
    // dataset a user lands on.
    expect(reg.listSemanticModels()[0].key).toBe("model-oz-info");
  });

  it("mirrors the backend engineer-projects model, field for field", async () => {
    const reg = await loadReal();
    const model = reg.getSemanticModel("model-engineer-projects");

    expect(model.name["fa-IR"]).toBe("اطلاعات پروژه‌ای مهندسان");
    expect(model.entities[0].source).toBe("engineer_projects");

    // The backend (KurdNezamSemanticModelStore.cs) is authoritative and these ids ARE the SQL
    // column names. If the two lists drift, the picker offers a field the engine cannot resolve.
    expect(model.entities[0].fields.map((f) => f.id)).toEqual([
      "ProjectNo", "Ozviat", "TypEng", "IsHogh", "IsErja", "IsHal", "RegDate",
      "TypProject", "CityId", "HasPayan", "ExitTyp", "IsAfza", "Meter", "MeterFull",
    ]);

    // Meter is «متر کار» in the request's words — the synonym is how a prompt reaches the field.
    const meter = model.entities[0].fields.find((f) => f.id === "Meter");
    expect(meter?.role).toBe("measure");
    expect(meter?.synonyms).toContain("متر کار");
  });

  it("every entity field id is unique within its model", () => {
    for (const model of Object.values(semanticModels)) {
      for (const entity of model.entities) {
        const ids = entity.fields.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
