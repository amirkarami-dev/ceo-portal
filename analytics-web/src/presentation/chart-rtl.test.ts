import { describe, it, expect } from "vitest";
import { legendPlacement, pieSweep } from "./chart-rtl";

describe("legendPlacement", () => {
  it("puts the ring at the reading edge and the key after it", () => {
    // RTL reads from the right, so the chart takes the right and the legend the left.
    expect(legendPlacement("rtl").side).toBe("left");
    expect(legendPlacement("ltr").side).toBe("right");
  });

  it("starts a legend under the chart from the reading edge", () => {
    // A horizontal legend is a row of items; they begin where reading begins.
    expect(legendPlacement("rtl").inline).toBe("right");
    expect(legendPlacement("ltr").inline).toBe("left");
  });

  it("starts the ring at 12 o'clock in both directions", () => {
    // 0° is 3 o'clock in both libraries, so 90° is the top either way. This half did not change.
    expect(pieSweep("rtl").startAngle).toBe(90);
    expect(pieSweep("ltr").startAngle).toBe(90);
  });

  /**
   * Direction is now an explicit boolean, not something inferred from an end angle.
   *
   * The old shape was recharts': `{ startAngle: 90, endAngle: -270 | 450 }`, where the library works
   * out the direction from whether the end is below or above the start. ECharts takes `clockwise`
   * outright, and its `endAngle` means where a PARTIAL ring stops — so feeding it 450 is not a
   * counter-clockwise circle, it is a value it quietly normalises into a plausible-looking ring for
   * the wrong reason.
   */
  it("sweeps the way the language runs", () => {
    expect(pieSweep("ltr").clockwise, "LTR reads left-to-right, so the ring runs clockwise").toBe(true);
    expect(pieSweep("rtl").clockwise, "RTL reads right-to-left, so it runs the other way").toBe(false);
  });

  it("says direction outright rather than encoding it in an angle", () => {
    // The guard against a verbatim port. `endAngle` is ECharts' partial-ring control, and handing it
    // recharts' ±360 values renders something plausible while meaning nothing — with every test here
    // still green, because nothing joins this function to a rendered ring.
    for (const dir of ["rtl", "ltr"] as const) {
      const sweep = pieSweep(dir) as Record<string, unknown>;
      expect(typeof sweep.clockwise, dir).toBe("boolean");
      expect(sweep.endAngle, `${dir}: endAngle means "partial ring" to ECharts, not a direction`).toBeUndefined();
    }
  });

  it("gives the two directions opposite sweeps, never the same one", () => {
    expect(pieSweep("rtl").clockwise).not.toBe(pieSweep("ltr").clockwise);
  });

  it("never gives the two legends the same value", () => {
    // This is the whole bug in one line. Both charts were handed ONE constant, so the donut's
    // side legend inherited the horizontal legend's answer and landed on the wrong side — in RTL
    // *and* in LTR. The two questions have opposite answers by definition.
    for (const dir of ["rtl", "ltr"] as const) {
      const p = legendPlacement(dir);
      expect(p.inline, `${dir}: inline and side must differ`).not.toBe(p.side);
    }
  });
});
