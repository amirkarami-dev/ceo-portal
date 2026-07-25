import { describe, it, expect } from "vitest"
import {
  buildMechReport,
  buildElecReport,
  buildMonitoringReport,
  buildIntegratedReport,
  scoreMech,
  scoreElec,
  scoreMonitoring,
  scoreIntegrated,
  MECH_DB,
  ELEC_DB,
} from "../src/index"

describe("buildMechReport", () => {
  it("is empty for null details", () => {
    expect(buildMechReport(null).empty).toBe(true)
    expect(buildMechReport(null).maxScore).toBe(240)
  })

  it("totalScore always equals scoreMech, with one section per DB section", () => {
    for (const d of [{ group: "A" }, { group: "D" }, { group: "C", responses: { s0_c0_1: { radio: "y" } } }]) {
      const r = buildMechReport(d)
      expect(r.totalScore).toBe(scoreMech(d).score)
      expect(r.maxScore).toBe(240)
      expect(r.sections).toHaveLength((MECH_DB as unknown[]).length)
      expect(r.scoreMode).toBe("perSection")
      // every section carries a numeric max/score and a rows array
      r.sections.forEach((s) => {
        expect(typeof s.max).toBe("number")
        expect(typeof s.score).toBe("number")
        expect(Array.isArray(s.rows)).toBe(true)
        expect(s.activeCount).toBe(s.rows.length)
      })
    }
  })

  it("reflects the building group", () => {
    expect(buildMechReport({ group: "B" }).buildingGroup).toBe("B")
  })
})

describe("buildElecReport", () => {
  it("totalScore equals scoreElec and excludes the renew section", () => {
    const expectedSections = (ELEC_DB as { id: string }[]).filter((s) => s.id !== "renew").length
    for (const d of [{ group: "A" }, { group: "D" }]) {
      const r = buildElecReport(d)
      expect(r.totalScore).toBe(scoreElec(d).score)
      expect(r.maxScore).toBe(196)
      expect(r.sections).toHaveLength(expectedSections)
    }
  })
})

describe("buildMonitoringReport", () => {
  it("is all-or-nothing and matches scoreMonitoring", () => {
    const d = { toggles: {}, responses: {} }
    const r = buildMonitoringReport(d)
    expect(r.scoreMode).toBe("allOrNothing")
    expect(r.maxScore).toBe(120)
    expect(r.totalScore).toBe(scoreMonitoring(d).score)
    expect(r.allPassed).toBe(scoreMonitoring(d).allPassed)
    // the always-active "gen" section is present even with all toggles off
    expect(r.sections.length).toBeGreaterThan(0)
    expect(r.sections[0].rows.length).toBeGreaterThan(0)
  })
})

describe("buildIntegratedReport", () => {
  it("awards full score with a note when logic is inactive", () => {
    const r = buildIntegratedReport({ logicActive: false, responses: {} })
    expect(r.totalScore).toBe(77)
    expect(r.allPassed).toBe(true)
    expect(r.sections[0].note).toBeTruthy()
    expect(r.sections[0].rows).toHaveLength(0)
  })

  it("requires every row when logic is active", () => {
    const fail = buildIntegratedReport({ logicActive: true, responses: {} })
    expect(fail.totalScore).toBe(scoreIntegrated({ logicActive: true, responses: {} }).score)
    expect(fail.allPassed).toBe(false)
    expect(fail.sections[0].rows.length).toBeGreaterThan(0)

    const allYes = { logicActive: true, responses: { row_0: "y", row_1: "y", row_2: "y" } }
    const pass = buildIntegratedReport(allYes)
    expect(pass.totalScore).toBe(scoreIntegrated(allYes).score)
    expect(pass.allPassed).toBe(true)
    expect(pass.sections[0].rows.every((r) => r.pass)).toBe(true)
  })
})
