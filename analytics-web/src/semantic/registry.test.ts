import { describe, it, expect } from "vitest";
import {
  getSemanticModel,
  getDataset,
  getModelForDataset,
  semanticModels,
  datasets,
} from "./registry";

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

  it("every entity field id is unique within its model", () => {
    for (const model of Object.values(semanticModels)) {
      for (const entity of model.entities) {
        const ids = entity.fields.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
