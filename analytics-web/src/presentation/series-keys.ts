import type { QueryResult } from "@/contracts";
import type { ReportView } from "@/contracts/presentation";

/**
 * The result columns a view plots as series — the keys whose labels become legend entries and
 * tooltip names.
 *
 * Shared so the label editor cannot disagree with the chart. Offering someone a pencil for a series
 * the chart does not draw, or missing one it does, is worse than not offering it at all, and the rule
 * lived privately inside `RechartsRenderer` where nothing else could reach it.
 *
 * `result` is optional on purpose. Without it there is **no fallback**, which is exactly what the
 * renderers want: they already handle "no series" by drawing nothing. Pass it when you need a best
 * guess, as the label editor does.
 */
export function seriesKeysOf(view: ReportView | undefined, result?: QueryResult): string[] {
  const out: string[] = [];

  const y = view?.mapping?.y;
  if (Array.isArray(y)) out.push(...y);
  else if (typeof y === "string") out.push(y);
  else if (view?.mapping?.measure) out.push(view.mapping.measure);

  // Only reached when the view names nothing — a hand-written or AI-authored view, or a table.
  if (out.length === 0 && result) {
    out.push(...result.columns.filter((c) => c.isMetric).map((c) => c.key));
  }

  return [...new Set(out.filter(Boolean))];
}
