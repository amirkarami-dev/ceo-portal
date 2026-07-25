import type {
  ReportDefinition,
  Drilldown,
  Filter,
  GroupBy,
} from "../contracts/report-definition";
import type { Dataset, GroupNode } from "../contracts/dataset";
import type { SemanticModel } from "../contracts/semantic";
import { runQuery, type QueryResult } from "./engine";
import { executeReport } from "../api/executeApi";

/** The drilled dimension is always the first groupBy of the parent;
 *  the pinned value comes from the clicked node. */
function drillField(parentDef: ReportDefinition): string {
  const field = parentDef.groupBy?.[0]?.field;
  if (!field) throw new Error(`Report ${parentDef.id} has no groupBy to drill from`);
  return field;
}

function pinnedFilter(dd: Drilldown, field: string, value: string | number): Filter {
  return { field, operator: dd.operator ?? "eq", value };
}

/** Next groupBy dimension AFTER the drilled field (undefined → detail rows). */
function nextDimension(parent: ReportDefinition, drilledField: string): GroupBy | undefined {
  const gb = parent.groupBy ?? [];
  const idx = gb.findIndex((g) => g.field === drilledField);
  return idx >= 0 ? gb[idx + 1] : gb[0];
}

export function buildDrilldownDefinition(parentDef: ReportDefinition, node: GroupNode): ReportDefinition {
  const dd = parentDef.drilldown;
  if (!dd) throw new Error(`Report ${parentDef.id} has no drilldown config`);
  const field = drillField(parentDef);
  const value = node.value;
  const filter = pinnedFilter(dd, field, value);

  if (dd.targetDefinition) {
    return { ...dd.targetDefinition, filters: [...(dd.targetDefinition.filters ?? []), filter] };
  }
  // targetReportId is resolved by the caller against the report store; v1 inline fallback:
  const next = nextDimension(parentDef, field);
  const childGroupBy = next ? [next] : undefined;
  return {
    ...parentDef,
    id: `${parentDef.id}__drill_${field}_${String(value)}`,
    filters: [...(parentDef.filters ?? []), filter],
    groupBy: childGroupBy,
    drilldown: undefined,
  };
}

/** Synchronous drilldown — kept for backward compatibility (mock mode, tests). */
export function drillInto(
  parentDef: ReportDefinition,
  node: GroupNode,
  dataset: Dataset,
  semantic: SemanticModel,
): { def: ReportDefinition; result: QueryResult } {
  const def = buildDrilldownDefinition(parentDef, node);
  return { def, result: runQuery(def, dataset, semantic) };
}

/**
 * Async drilldown — uses executeReport so both mock and real modes share one
 * path. The caller (useAskAi) uses this for the drill action.
 */
export async function drillIntoAsync(
  parentDef: ReportDefinition,
  node: GroupNode,
): Promise<{ def: ReportDefinition; result: QueryResult }> {
  const def = buildDrilldownDefinition(parentDef, node);
  const result = await executeReport(def);
  return { def, result };
}
