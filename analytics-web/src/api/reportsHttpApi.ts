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

/**
 * Shape the backend returns for each item in GET /api/Reports.
 *
 * `id` is a **number**. `SavedReportDto` declares `int Id`, so the JSON carries `2`,
 * not `"2"`. This interface used to say `string`, which TypeScript cannot check against
 * a network response — so the lie held until something compared the two.
 */
interface BackendSavedReport {
  id: number;
  name: string;
  ownerName: string;
  visibility: "private" | "tenant";
  updatedAt: string;
  definition: ReportDefinition;
}

function backendToFrontend(b: BackendSavedReport): SavedReport {
  const definition = b.definition ?? ({} as ReportDefinition);

  return {
    // SavedReport.id is a string everywhere in the app — route params, widget
    // reportIds, table keys. Make that true here, at the one place the number arrives.
    id: String(b.id),
    ownerName: b.ownerName,
    visibility: b.visibility,
    updatedAt: b.updatedAt,
    definition: {
      ...definition,
      name: definition.name?.trim() || b.name,
    },
  };
}

export const reportsHttpApi = {
  /** GET /api/Reports — returns complete definitions for library, viewer, and widgets. */
  async list(): Promise<SavedReport[]> {
    const items = await httpClient.get<BackendSavedReport[]>("/api/Reports");
    return items.map(backendToFrontend);
  },

  /**
   * "Get by id" — the backend has no GET /api/Reports/{id} endpoint yet, so we
  * fetch the complete list and find the matching entry. Returns null when not found.
   */
  async get(id: string): Promise<SavedReport | null> {
    const items = await httpClient.get<BackendSavedReport[]>("/api/Reports");
    // Compared as strings on both sides, deliberately. The backend sends a number, a
    // route param is always a string, and dashboards saved before this fix hold their
    // widget's reportId as a number — `2 === "2"` was false, which is why opening a
    // report from the library answered «گزارش یافت نشد» while the same report rendered
    // fine inside a widget.
    const found = items.find((r) => String(r.id) === String(id));
    return found ? backendToFrontend(found) : null;
  },

  /**
   * POST /api/Reports — **creates**. It does not update.
   *
   * The handler calls `Add` unconditionally and ignores the definition's id, so posting an existing
   * report inserts a second row rather than changing the first. Use {@link update} to edit one.
   * The endpoint returns the new id; we echo back a SavedReport from the definition we sent.
   */
  async save(opts: {
    definition: ReportDefinition;
    name?: string;
    visibility?: "private" | "tenant";
  }): Promise<SavedReport> {
    const { definition, name, visibility } = opts;
    const finalDef = name ? { ...definition, name } : definition;

    // The endpoint is `Task<Ok<int>>`, so the body is a bare number — `2`, not
    // `{ "id": 2 }`. This used to read `resp.id` off that number and hand back
    // `id: undefined`. Nothing reads it today, because the modal only closes and the
    // list refetches, but a wrong value sitting in a returned object is a trap.
    const newId = await httpClient.post<number>("/api/Reports", {
      definition: finalDef,
      name: finalDef.name,
      visibility: visibility ?? "private",
    });

    return {
      id: String(newId),
      definition: finalDef,
      ownerName: "",
      visibility: visibility ?? "private",
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * PUT /api/Reports/{id} — edits a report in place.
   *
   * `id` is the **row** id (`SavedReport.id`), not `definition.id`. Those are different values in
   * real mode: the row id is the database key, while `definition.id` is an AI-generated string like
   * `rpt_monthly_revenue_by_province`. They happen to be equal in the mock seed, which is exactly how
   * a mix-up would go unnoticed locally.
   *
   * No `name` argument: the server takes the report's name from the definition, because it is stored
   * both as a column and inside the definition JSON and accepting both invites them to disagree.
   *
   * Returns nothing — the endpoint is 204. Callers should invalidate rather than trust a local echo.
   */
  async update(opts: {
    id: string;
    definition: ReportDefinition;
    visibility?: "private" | "tenant";
  }): Promise<void> {
    const { id, definition, visibility } = opts;
    await httpClient.put<void>(`/api/Reports/${encodeURIComponent(id)}`, {
      definition,
      visibility,
    });
  },
};
