import type { QueryResult, ReportDefinition } from "@/contracts";

/** Serialize the full Report Definition + the computed result so the JSON
 *  export is self-describing (definition is the single source of truth). */
export function toJson(def: ReportDefinition, result: QueryResult): string {
  return JSON.stringify(
    {
      definition: def,
      result: {
        columns: result.columns,
        rows: result.rows,
        total: result.total,
        ...(result.groups ? { groups: result.groups } : {}),
      },
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}
