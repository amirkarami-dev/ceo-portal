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
 * Both libraries put 0° at 3 o'clock, so **90° is 12 o'clock** either way — that half is unchanged.
 * The convention is to start the largest slice there. The sweep then follows reading direction:
 * clockwise in LTR, counter-clockwise in RTL, so a reader's eye leaves the top and travels the way
 * their language runs and the slices arrive in order rather than backwards.
 *
 * ## Why this returns `clockwise` and not `endAngle`
 *
 * It used to return `{ startAngle: 90, endAngle: -270 | 450 }`, which is **recharts' way of saying
 * it**: recharts derives direction from whether the end angle is below or above the start.
 *
 * ECharts does not. It takes an explicit `clockwise` boolean, and its `endAngle` means something
 * else entirely — where a *partial* ring stops. Handing ECharts `endAngle: 450` is not a
 * counter-clockwise circle; it is a request it quietly normalises, producing a plausible-looking
 * ring for the wrong reason.
 *
 * That is the trap worth naming: **nothing connects this function to a rendered ring**. Port the old
 * shape verbatim and the result is bit-identical to passing nothing at all, in both directions,
 * while every test here keeps passing and the RTL donut spins backwards on screen.
 */
export function pieSweep(dir: Dir): { startAngle: number; clockwise: boolean } {
  // 90 is 12 o'clock in both libraries. Direction is explicit rather than inferred from an end angle.
  return { startAngle: 90, clockwise: dir !== "rtl" };
}
