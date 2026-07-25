import { describe, it, expect } from "vitest"
import {
  scoreEnvOpaque,
  scoreEnvTrans,
  scoreMech,
  scoreElec,
  scoreMonitoring,
  scoreIntegrated,
  scoreTool,
  calcBuildingGroup,
  getOpaqueTargetR,
  INTEGRATED_ITEMS,
  TOTAL_MAX_SCORE,
} from "../src/index"

describe("calcBuildingGroup", () => {
  it("classifies small low-rise as A", () => {
    expect(calcBuildingGroup({ area: 300, floors: 2, units: 4 }).code).toBe("A")
  })
  it("classifies tall building as D", () => {
    expect(calcBuildingGroup({ area: 6000, floors: 12, units: 40 }).code).toBe("D")
  })
})

describe("env_opaque scoring", () => {
  it("is 0 when no analyses pass", () => {
    const r = scoreEnvOpaque({ analyses: [], bridge: undefined, shading: undefined }, "3B")
    expect(r.score).toBe(0)
    expect(r.maxScore).toBe(105)
  })

  it("awards 90 for a passing envelope + bridge, +15 for shading", () => {
    const requiredR = getOpaqueTargetR("wall_ext_open", "3B") // 1.43
    const r = scoreEnvOpaque(
      {
        analyses: [{ targetKey: "wall_ext_open", layers: [{ rValue: requiredR + 1 }] }],
        bridge: { south: 1, north: 1, east: 1, west: 1, mitigation: false },
        shading: { q1: "yes", q2: "no" },
      },
      "3B",
    )
    expect(r.envelopePass).toBe(true)
    expect(r.bridgePass).toBe(true)
    expect(r.score).toBe(105)
  })

  it("fails the bridge when a value > 5 without mitigation", () => {
    const r = scoreEnvOpaque(
      {
        analyses: [{ targetKey: "wall_ext_open", layers: [{ rValue: 99 }] }],
        bridge: { south: 9, north: 1, east: 1, west: 1, mitigation: false },
        shading: { q1: "no", q2: "no" },
      },
      "3B",
    )
    expect(r.bridgePass).toBe(false)
    expect(r.score).toBe(0)
  })
})

describe("env_trans scoring", () => {
  it("is 0 with no windows", () => {
    expect(scoreEnvTrans({ windows: [] }, "3B").score).toBe(0)
  })
})

describe("section-conditional checklists default to full credit when nothing is active", () => {
  it("mech: empty responses → score 0 (active rows are unanswered)", () => {
    // Every mechanical section has at least one active row at group A, so an
    // empty checklist scores 0 (a section only earns its max when all active rows pass).
    const r = scoreMech({ group: "A", responses: {}, logicOffRows: [] })
    expect(r.score).toBe(0)
    expect(r.maxScore).toBe(240)
  })

  it("elec: empty responses → sections with active rows fail (score 0)", () => {
    const r = scoreElec({ group: "A", responses: {} })
    expect(r.maxScore).toBe(196)
    expect(r.score).toBe(0)
  })
})

describe("monitoring + integrated", () => {
  it("monitoring is all-or-nothing", () => {
    const r = scoreMonitoring({ toggles: {}, responses: {} })
    expect(r.maxScore).toBe(120)
  })

  it("integrated scores full when logic is inactive", () => {
    const r = scoreIntegrated({ logicActive: false, responses: {} })
    expect(r.allPassed).toBe(true)
    expect(r.score).toBe(77)
  })

  it("integrated requires every row when logic is active", () => {
    const r = scoreIntegrated({ logicActive: true, responses: {} })
    expect(r.allPassed).toBe(false)
    expect(r.score).toBe(0)
  })

  it("integrated awards full score only when every active row passes", () => {
    const items = INTEGRATED_ITEMS as unknown[]
    const allYes = Object.fromEntries(items.map((_, i) => [`row_${i}`, "y"]))
    const full = scoreIntegrated({ logicActive: true, responses: allYes })
    expect(full.passedRows).toBe(items.length)
    expect(full.allPassed).toBe(true)
    expect(full.score).toBe(77)

    // One missing answer -> all-or-nothing, no credit.
    const oneMissing = { ...allYes }
    delete oneMissing.row_0
    const partial = scoreIntegrated({ logicActive: true, responses: oneMissing })
    expect(partial.allPassed).toBe(false)
    expect(partial.score).toBe(0)
  })
})

describe("dispatcher + totals", () => {
  it("scoreTool routes by toolKey", () => {
    expect(scoreTool("integrated_mgmt.html", { logicActive: false }, "3B").score).toBe(77)
  })
  it("total max score is 831", () => {
    expect(TOTAL_MAX_SCORE).toBe(831)
  })
})
