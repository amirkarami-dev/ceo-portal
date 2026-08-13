import { describe, it, expect } from "vitest";
import { legendPlacement } from "./chart-rtl";

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
