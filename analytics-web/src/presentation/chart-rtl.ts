// analytics-web/src/presentation/chart-rtl.ts
import type { Dir } from "./format";

/**
 * Where a chart's legend goes. Two answers, because "align" is two different questions.
 */
export interface LegendPlacement {
  /**
   * A legend UNDER the chart, laid out horizontally (bar, line, area).
   * The question is *which end the items start from* — the reading edge, so the right in RTL.
   */
  inline: "left" | "right";
  /**
   * A legend BESIDE the chart, laid out vertically (the donut).
   * The question is *which side the legend sits on*, and the chart takes the other one. The chart
   * belongs at the reading edge and the key after it, so in RTL the ring is on the right and the
   * legend on the left.
   */
  side: "left" | "right";
}

/**
 * Recharts and ECharts both take a single `align`/`left` value whose meaning depends on whether the
 * legend is horizontal or vertical. Sharing one constant between the two put the donut's legend on
 * the right in RTL *and* on the left in LTR — the wrong side in both directions. Keeping the pair
 * together, with `inline` and `side` always opposite, is what stops that from coming back.
 */
export function legendPlacement(dir: Dir): LegendPlacement {
  return dir === "rtl"
    ? { inline: "right", side: "left" }
    : { inline: "left", side: "right" };
}
