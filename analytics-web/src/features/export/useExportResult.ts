import { useMemo } from "react";
import type { QueryResult, ReportDefinition } from "@/contracts";
import { useColumnLabel } from "@/presentation/labels";

/**
 * The result an export should be handed: the same rows, with every column label resolved the way the
 * screen resolves it.
 *
 * Exports read `result.columns[].label`, which the **engine** produces — `metric.label ?? key`
 * (`query/engine.ts`). `useColumnLabel` never enters into it. So a series renamed on the chart still
 * came out of Excel as `sum_amount`: the picture said one thing and the spreadsheet another, with no
 * error anywhere.
 *
 * Resolving here rather than inside `toCsv` / `resultToAoa` / `exportPdf` keeps all three signatures
 * alone — and, more usefully, keeps the rule in one place instead of three. Those functions are plain
 * functions and cannot call a hook, which is why `resolveColumnLabel` exists as a non-hook form
 * underneath this.
 *
 * Every export path must go through this. `export/export-labels.test.ts` asserts the output carries an
 * override, so bypassing it fails a test rather than shipping a spreadsheet that disagrees with the
 * screen.
 */
export function useExportResult(
  def: ReportDefinition | undefined,
  result: QueryResult | undefined,
): QueryResult | undefined {
  const label = useColumnLabel(def, result);

  return useMemo(() => {
    if (!result) return undefined;
    return {
      ...result,
      columns: result.columns.map((c) => ({ ...c, label: label(c.key) })),
    };
  }, [result, label]);
}
