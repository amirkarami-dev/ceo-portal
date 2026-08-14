import type { GroupNode } from "../../contracts/dataset";

/**
 * Find the engine group behind a clicked category.
 *
 * ## Why not just index into `result.groups`
 *
 * Both renderers used to do `result.groups?.[dataIndex]`, and it is wrong far more often than it
 * looks. The engine pushes `groupNodes` while it collects rows (`query/engine.ts`), then sorts the
 * rows and applies offset/limit **afterwards** — and never re-orders or slices `groupNodes`. So the
 * moment a report carries a sort, position N in the chart is not position N in `groups`.
 *
 * `ai/rules.ts` puts a sort on essentially every Ask-AI report. Measured against the real engine with
 * three provinces, no nulls, and one `desc` sort:
 *
 * ```
 *   bars drawn (rows order): ["Fars","Yazd","Tehran"]
 *   groups[] order         : ["Tehran","Fars","Yazd"]
 *    click bar 0 "Fars"   -> groups[0] = "Tehran"   WRONG REPORT
 *    click bar 1 "Yazd"   -> groups[1] = "Fars"     WRONG REPORT
 *    click bar 2 "Tehran" -> groups[2] = "Yazd"     WRONG REPORT
 * ```
 *
 * Every bar opened the wrong report, silently. Aggregation and dropped nulls make it worse by
 * shortening the chart relative to `groups`, but they are not the cause.
 *
 * Extracted rather than fixed in place because the defect was never ECharts-specific — the recharts
 * renderer carried the identical lookup, and leaving that path broken until it was deleted would have
 * meant shipping a known wrong-report bug in the meantime. That renderer is now gone; this stays a
 * separate function because a positional-vs-value lookup is worth naming and testing on its own.
 */
export function resolveDrillTarget(
  groups: GroupNode[] | undefined,
  category: unknown,
): GroupNode | undefined {
  if (!groups?.length) return undefined;
  return groups.find((g) => sameCategory(g.value, category));
}

/**
 * Whether two category values are the same bucket.
 *
 * Compared as strings because a group's `value` comes back off a row while the clicked category has
 * been through the chart, and a year that is `1405` in one and `"1405"` in the other is the same
 * province either way. `null` and `undefined` are one bucket — the engine deliberately groups missing
 * values together and pins it (`engine.edge.test.ts`), so a click on that blank tick must find it.
 */
function sameCategory(a: unknown, b: unknown): boolean {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) return aMissing && bMissing;
  return String(a) === String(b);
}
