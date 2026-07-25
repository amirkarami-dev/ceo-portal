import { describe, it, expect } from "vitest"
import { buildEnvOpaqueReport, getOpaqueTargetR, scoreEnvOpaque } from "../src/index"

// A realistic saved env_opaque detail: one passing wall built from two layers, like the
// shape AssessmentWorkspace persists into InputJson["env_opaque.html"].
const wallLayers = [
  {
    categoryKey: "g6",
    materialName: "EPS (یونولیت) - دانسیته 29-40",
    manufacturer: "",
    thickness: 40,
    density: "34.5",
    lambda: 0.039,
    rValue: 1.026,
    standard: "10950",
  },
  {
    categoryKey: "g10",
    materialName: "بلوک ۲۰ (۳ حفره بزرگ)",
    manufacturer: "",
    thickness: 200,
    density: "",
    lambda: null,
    rValue: 0.6,
    standard: "70-1",
  },
]

describe("buildEnvOpaqueReport", () => {
  it("flags empty input", () => {
    const r = buildEnvOpaqueReport({ analyses: [] }, "3B")
    expect(r.empty).toBe(true)
    expect(r.assemblies).toHaveLength(0)
    expect(r.summaryGroups).toHaveLength(0)
    expect(r.allPass).toBe(false)
    expect(r.scores.max).toBe(105)
  })

  it("treats null/undefined details as empty", () => {
    expect(buildEnvOpaqueReport(null, "3B").empty).toBe(true)
    expect(buildEnvOpaqueReport(undefined, "3B").empty).toBe(true)
  })

  it("derives requiredR, totalR, pass and per-layer fields for one assembly", () => {
    const r = buildEnvOpaqueReport(
      { analyses: [{ targetKey: "wall_ext_open", layers: wallLayers }] },
      "3B",
    )
    const a = r.assemblies[0]
    expect(a.code).toBe("W1")
    expect(a.group).toBe("wall")
    expect(a.label).toContain("دیوار خارجی")
    expect(a.requiredR).toBe(getOpaqueTargetR("wall_ext_open", "3B")) // 1.43
    expect(a.totalR).toBeCloseTo(1.626, 3)
    expect(a.pass).toBe(true) // 1.626 > 1.43
    expect(a.layers).toHaveLength(2)
    expect(a.layers[0]).toMatchObject({
      index: 1,
      categoryKey: "g6",
      categoryLabel: "۶. شیشه و عایق‌های پلیمری (فوم)",
      thickness: 40,
      lambda: 0.039,
      rValue: 1.026,
      standard: "10950",
    })
    // Fixed-R layer keeps null lambda (renders "-" downstream).
    expect(a.layers[1].lambda).toBeNull()
  })

  it("marks an assembly failing when totalR <= requiredR", () => {
    const r = buildEnvOpaqueReport(
      { analyses: [{ targetKey: "roof_flat", layers: [{ rValue: 1 }] }] }, // needs 4.55
      "3B",
    )
    expect(r.assemblies[0].pass).toBe(false)
    expect(r.allPass).toBe(false)
  })

  it("assigns sequential codes per group and groups the summary", () => {
    const r = buildEnvOpaqueReport(
      {
        analyses: [
          { targetKey: "wall_ext_open", layers: [{ rValue: 9 }] },
          { targetKey: "wall_ext_semi", layers: [{ rValue: 9 }] },
          { targetKey: "roof_flat", layers: [{ rValue: 9 }] },
          { targetKey: "floor_soil", layers: [{ rValue: 9 }] },
          { targetKey: "door_opaque", layers: [{ rValue: 9 }] },
        ],
      },
      "3B",
    )
    expect(r.assemblies.map((a) => a.code)).toEqual(["W1", "W2", "R1", "F1", "D1"])
    expect(r.summaryGroups.map((g) => g.group)).toEqual(["wall", "roof", "floor", "door"])
    expect(r.summaryGroups[0].rows).toHaveLength(2) // two walls
    expect(r.allPass).toBe(true)
  })

  it("computes bridge pass/highBridge and matches scoreEnvOpaque", () => {
    const input = {
      analyses: [{ targetKey: "wall_ext_open", layers: [{ rValue: 9 }] }],
      bridge: { south: 9, north: 1, east: 1, west: 1, mitigation: true },
      shading: { q1: "yes", q2: "no" },
    }
    const r = buildEnvOpaqueReport(input, "3B")
    expect(r.bridge.allDefined).toBe(true)
    expect(r.bridge.highBridge).toBe(true)
    expect(r.bridge.pass).toBe(true) // mitigated
    // Numbers agree with the official scorer.
    const score = scoreEnvOpaque(input, "3B")
    expect(r.scores.total).toBe(score.score)
    expect(r.scores.insulation).toBe(90)
    expect(r.scores.shading).toBe(15)
  })

  it("fails the bridge when undefined directions", () => {
    const r = buildEnvOpaqueReport(
      {
        analyses: [{ targetKey: "wall_ext_open", layers: [{ rValue: 9 }] }],
        bridge: { south: 1, north: null, east: 1, west: 1, mitigation: false },
      },
      "3B",
    )
    expect(r.bridge.allDefined).toBe(false)
    expect(r.bridge.pass).toBe(false)
    expect(r.scores.insulation).toBe(0)
  })
})
