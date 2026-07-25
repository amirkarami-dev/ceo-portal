// analytics-web/src/api/executeApi.ts
// Gated execute: server-side via POST /api/Reports/execute when
// VITE_USE_MOCK_API="false"; in-browser runQuery otherwise (default/mock path).
//
// Use this function everywhere the app runs a user-facing query so both modes
// share one call site.

import type { ReportDefinition } from "../contracts/report-definition";
import type { QueryResult } from "../query/engine";
import { runQuery } from "../query/engine";
import { getDataset, getModelForDataset } from "../semantic/registry";
import { httpClient } from "./httpClient";

const USE_REAL_API =
  (import.meta.env.VITE_USE_MOCK_API as string | undefined) === "false";

/** Backend response shape from POST /api/Reports/execute */
interface BackendQueryResult {
  columns: Array<{ key: string; label: string; type: string; isMetric: boolean }>;
  rows: Array<Record<string, string | number | null>>;
  total: number;
}

function mapBackendResult(b: BackendQueryResult): QueryResult {
  return {
    columns: b.columns.map((c) => ({
      key: c.key,
      label: c.label,
      // The backend sends the FieldType string verbatim; cast it.
      type: c.type as QueryResult["columns"][number]["type"],
      isMetric: c.isMetric,
    })),
    rows: b.rows,
    total: b.total,
  };
}

/**
 * Execute a ReportDefinition and return a QueryResult.
 *
 * - REAL mode  (VITE_USE_MOCK_API="false"): POST /api/Reports/execute
 * - MOCK mode  (default / any other value):  in-browser runQuery over bundled data
 */
export async function executeReport(def: ReportDefinition): Promise<QueryResult> {
  if (USE_REAL_API) {
    const backendResult = await httpClient.post<BackendQueryResult>(
      "/api/Reports/execute",
      def,
    );
    return mapBackendResult(backendResult);
  }

  // Mock path — in-browser engine over bundled sample datasets.
  const dataset = getDataset(def.dataset);
  const semantic = getModelForDataset(def.dataset);
  return runQuery(def, dataset, semantic);
}
