// analytics-web/src/api/semanticModelsHttpApi.test.ts
// Tests for the real-API semantic models fetcher.  httpClient is mocked so no
// network calls are made.  Verifies correct URL and response mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./httpClient", () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

import { httpClient } from "./httpClient";
import { semanticModelsHttpApi } from "./semanticModelsHttpApi";

const mockGet = vi.mocked(httpClient.get);

const BACKEND_MODELS = [
  {
    modelKey: "farsnezam-projects",
    name: "پروژه‌های فارس نظام",
    source: "farsnezam_projects",
    fields: [
      { id: "projectId", name: "کد پروژه", type: "string", role: "dimension", column: "ProjectId" },
      { id: "area", name: "مساحت", type: "number", role: "measure", column: "Area" },
    ],
  },
];

describe("semanticModelsHttpApi.list()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_MODELS);
  });

  it("calls GET /api/SemanticModels", async () => {
    await semanticModelsHttpApi.list();
    expect(mockGet).toHaveBeenCalledWith("/api/SemanticModels");
  });

  it("maps modelKey to SemanticModel.id", async () => {
    const [model] = await semanticModelsHttpApi.list();
    expect(model.id).toBe("farsnezam-projects");
  });

  it("maps name to both fa-IR and en-US labels", async () => {
    const [model] = await semanticModelsHttpApi.list();
    expect(model.name["fa-IR"]).toBe("پروژه‌های فارس نظام");
    expect(model.name["en-US"]).toBe("پروژه‌های فارس نظام");
  });

  it("maps source as entity.source", async () => {
    const [model] = await semanticModelsHttpApi.list();
    expect(model.entities[0].source).toBe("farsnezam_projects");
  });

  it("maps fields with id/column/type/role", async () => {
    const [model] = await semanticModelsHttpApi.list();
    const fields = model.entities[0].fields;
    expect(fields).toHaveLength(2);
    expect(fields[0].id).toBe("projectId");
    expect(fields[0].column).toBe("ProjectId");
    expect(fields[0].type).toBe("string");
    expect(fields[0].role).toBe("dimension");
    expect(fields[1].id).toBe("area");
    expect(fields[1].role).toBe("measure");
  });

  it("falls back column to id when column is absent", async () => {
    mockGet.mockResolvedValue([
      {
        modelKey: "m1",
        name: "Model",
        source: "src",
        fields: [{ id: "myField", name: "My Field", type: "string", role: "dimension" }],
      },
    ]);
    const [model] = await semanticModelsHttpApi.list();
    expect(model.entities[0].fields[0].column).toBe("myField");
  });
});
