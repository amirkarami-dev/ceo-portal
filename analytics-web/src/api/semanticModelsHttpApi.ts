// analytics-web/src/api/semanticModelsHttpApi.ts
// HTTP implementation for listing semantic models from the backend.
// Used when VITE_USE_MOCK_API="false".
//
// Backend endpoint: GET /api/SemanticModels
// Returns: [{ modelKey, name, source, fields: [{id, name, type, role, column?}] }]
//
// We map the backend shape to the frontend SemanticModel contract so the rest
// of the app (AI generate, dataset picker) can work with it transparently.

import type { SemanticModel, Field, Entity } from "../contracts/semantic";
import { httpClient } from "./httpClient";

/** Shape returned by GET /api/SemanticModels */
interface BackendSemanticModelField {
  id: string;
  name: string;
  type: string;
  role: string;
  column?: string;
}

interface BackendSemanticModel {
  modelKey: string;
  name: string;
  source: string;
  fields: BackendSemanticModelField[];
}

function mapBackendField(f: BackendSemanticModelField): Field {
  return {
    id: f.id,
    column: f.column ?? f.id,
    type: f.type as Field["type"],
    role: f.role as Field["role"],
    label: { "fa-IR": f.name, "en-US": f.name },
    synonyms: [],
  };
}

function mapBackendModel(b: BackendSemanticModel): SemanticModel {
  const entity: Entity = {
    id: b.modelKey,
    name: { "fa-IR": b.name, "en-US": b.name },
    source: b.source,
    fields: b.fields.map(mapBackendField),
  };

  return {
    id: b.modelKey,
    tenantId: "global",
    name: { "fa-IR": b.name, "en-US": b.name },
    defaultLocale: "fa-IR",
    version: 1,
    entities: [entity],
  };
}

export const semanticModelsHttpApi = {
  /** GET /api/SemanticModels — returns the list of backend semantic models. */
  async list(): Promise<SemanticModel[]> {
    const items = await httpClient.get<BackendSemanticModel[]>("/api/SemanticModels");
    return items.map(mapBackendModel);
  },
};
