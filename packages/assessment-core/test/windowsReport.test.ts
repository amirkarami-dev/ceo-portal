import { describe, it, expect } from "vitest"
import { buildEnvTransReport, scoreEnvTrans, calcWindowU } from "../src/index"

// A double-glazed UPVC (5-cavity) fixed window with argon — low U, and SHGC at the limit.
const passingWindow = {
  name: "پنجره جنوبی",
  type: "fixed",
  profileIdx: 1, // UPVC 5-cavity (u_f 1.8)
  l1Idx: 0, // float glass 4mm (λ 1.0)
  l2Idx: 1, // argon (λ 0.018)
  l3Idx: 0, // float glass
  l1Th: 6,
  l2Th: 12,
  l3Th: 6,
  shgc: 0.3,
  pf: 0,
}

describe("buildEnvTransReport", () => {
  it("is empty with no windows", () => {
    expect(buildEnvTransReport(null, "3B").empty).toBe(true)
    expect(buildEnvTransReport({ windows: [] }, "3B").empty).toBe(true)
  })

  it("derives per-window U/SHGC/pass matching the scorer", () => {
    const r = buildEnvTransReport({ windows: [passingWindow] }, "3B")
    expect(r.windows).toHaveLength(1)
    const w = r.windows[0]
    expect(w.uTotal).toBe(calcWindowU(passingWindow).uTotal)
    expect(w.uLimit).toBe(2.38) // fixed
    expect(w.uPass).toBe(true)
    expect(w.shgcLimit).toBe(0.3) // 3B (normal), pf < 0.2
    expect(w.shgcPass).toBe(true)
    expect(w.pass).toBe(true)
    expect(w.layers).toHaveLength(3) // glass / gas / glass
    expect(w.frameU).toBe(1.8)
    expect(r.allPassed).toBe(true)
    expect(r.score).toBe(93)
    expect(r.score).toBe(scoreEnvTrans({ windows: [passingWindow] }, "3B").score)
  })

  it("fails when SHGC exceeds the climate limit", () => {
    const hot = { ...passingWindow, shgc: 0.5 }
    const r = buildEnvTransReport({ windows: [hot] }, "3B")
    expect(r.windows[0].shgcPass).toBe(false)
    expect(r.allPassed).toBe(false)
    expect(r.score).toBe(0)
    expect(r.score).toBe(scoreEnvTrans({ windows: [hot] }, "3B").score)
  })

  it("carries climate metadata", () => {
    const r = buildEnvTransReport({ windows: [passingWindow] }, "1")
    expect(r.warm).toBe(true) // climate 1 is warm
    expect(r.climateLabel).toContain("گرم")
  })
})
