// analytics-web/src/api/reportsHttpApi.ts
// HTTP implementations of the report CRUD calls that back the useReports /
// useReport / useSaveReport hooks when VITE_USE_MOCK_API !== "false".
//
// Backend endpoints (all live under /api/Reports):
//   GET  /api/Reports                              → BackendSavedReport[]
//   POST /api/Reports/execute  { <def> }           → BackendQueryResult  (not wired here; engine is frontend)
//   POST /api/Reports/generate { prompt, semanticModelId } → ReportDefinition (wired in http-ai-service)
//   POST /api/Reports          { definition, name, visibility } → { id: string }
//
// The hooks only need list / get (by id from list cache) / save.

import type { ReportDefinition } from "../contracts/report-definition";
import { httpClient } from "./httpClient";
import type { SavedReport } from "./queries";

/** Shape the backend returns for each item in GET /api/Reports */
interface BackendSavedReport {
  id: string;
  name: string;
  ownerName: string;
  visibility: "private" | "tenant";
  updatedAt: string;
  // The backend list endpoint does NOT return the full definition.
  // definition is only populated after we POST to save or reconstruct from generate.
  definition?: ReportDefinition;
}

/** Shape the backend returns from POST /api/Reports */
interface BackendSaveResponse {
  id: string;
}

function backendToFrontend(b: BackendSavedReport): SavedReport {
  return {
    id: b.id,
    ownerName: b.ownerName,
    visibility: b.visibility,
    updatedAt: b.updatedAt,
    // definition may be absent in list responses; callers that need it must
    // fetch the individual record (the mock get() delegates back into the list).
    definition: b.definition ?? ({} as ReportDefinition),
  };
}

export const reportsHttpApi = {
  /** GET /api/Reports — returns the list; definition may be partial/empty. */
  async list(): Promise<SavedReport[]> {
    const items = await httpClient.get<BackendSavedReport[]>("/api/Reports");
    return items.map(backendToFrontend);
  },

  /**
   * "Get by id" — the backend has no GET /api/Reports/{id} endpoint yet, so we
   * fetch the list and find the matching entry. Returns null when not found.
   */
  async get(id: string): Promise<SavedReport | null> {
    const items = await httpClient.get<BackendSavedReport[]>("/api/Reports");
    const found = items.find((r) => r.id === id);
    return found ? backendToFrontend(found) : null;
  },

  /**
   * POST /api/Reports — saves a new report or updates an existing one.
   * The backend returns { id } for new records; we echo back a SavedReport
   * using the provided definition so the caller has an up-to-date object.
   */
  async save(opts: {
    definition: ReportDefinition;
    name?: string;
    visibility?: "private" | "tenant";
  }): Promise<SavedReport> {
    const { definition, name, visibility } = opts;
    const finalDef = name ? { ...definition, name } : definition;

    const resp = await httpClient.post<BackendSaveResponse>("/api/Reports", {
      definition: finalDef,
      name: finalDef.name,
      visibility: visibility ?? "private",
    });

    return {
      id: resp.id,
      definition: finalDef,
      ownerName: "",
      visibility: visibility ?? "private",
      updatedAt: new Date().toISOString(),
    };
  },
};
