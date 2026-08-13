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

/**
 * Where the ring starts and which way it sweeps.
 *
 * Recharts measures angles the way maths does — 0° at 3 o'clock, positive counter-clockwise — and by
 * default starts a pie at 0° and sweeps counter-clockwise, so the first and largest slice begins at
 * the right edge. The convention is to start the largest slice at **12 o'clock**, which is 90°.
 *
 * The sweep follows reading direction: clockwise in LTR, counter-clockwise in RTL. A reader's eye
 * leaves the top and travels the way their language runs, so the slices arrive in order rather than
 * backwards.
 */
export function pieSweep(dir: Dir): { startAngle: number; endAngle: number } {
  // 90 is 12 o'clock. Ending 360° below it sweeps clockwise; 360° above, counter-clockwise.
  return dir === "rtl" ? { startAngle: 90, endAngle: 450 } : { startAngle: 90, endAngle: -270 };
}
