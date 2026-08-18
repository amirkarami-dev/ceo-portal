import { describe, it, expect } from "vitest"
import {
  ALL_TOOLS,
  BAND_LABELS,
  EDITION5_START,
  REQUIREMENTS,
  SCHEDULE_ROWS,
  bandStartDate,
  complianceBandOf,
  gregorianToJdn,
  isRequired,
  jalaliToJdn,
  jdnToGregorian,
  jdnToJalali,
  requirementsForProject,
  requirementsIn,
  scheduleGroupOf,
  toJalali,
  toolStateOf,
  type ComplianceBand,
  type ScheduleGroup,
} from "../src/index"

const GROUPS: ScheduleGroup[] = ["A", "B", "C", "D"]
const BANDS: ComplianceBand[] = [1, 2, 3, 4, 5]

// A date at midday Tehran, so no test result can hinge on the timezone shift.
const at = (gy: number, gm: number, gd: number) =>
  new Date(Date.UTC(gy, gm - 1, gd, 8, 30, 0))

describe("جدول ۱۹-۲-۱ — the transcription itself", () => {
  it("has 24 requirement columns, each with a distinct key", () => {
    expect(REQUIREMENTS).toHaveLength(24)
    expect(new Set(REQUIREMENTS.map((r) => r.key)).size).toBe(24)
  })

  it("has a 24-character row for all 4 groups × 5 years, using only v/x", () => {
    for (const g of GROUPS) {
      for (const b of BANDS) {
        const row = SCHEDULE_ROWS[g][b]
        expect(row, `${g}/${b}`).toHaveLength(24)
        expect(row.replace(/[vx]/g, ""), `${g}/${b}`).toBe("")
      }
    }
  })

  /**
   * The count is the transcription's fingerprint. 480 cells were classified by shape off the PDF; if a
   * later edit flips one, this fails instead of quietly changing what a building owes.
   */
  it("totals 299 required and 181 not-yet across the whole table", () => {
    let v = 0
    let x = 0
    for (const g of GROUPS) {
      for (const b of BANDS) {
        for (const ch of SCHEDULE_ROWS[g][b]) ch === "v" ? v++ : x++
      }
    }
    expect([v, x]).toEqual([299, 181])
  })

  it("never takes a requirement away as the years pass", () => {
    // Monotonic per group: once something is required it stays required. Worth pinning — a single
    // mistyped character would otherwise read as the regulation relaxing a rule.
    for (const g of GROUPS) {
      for (const b of [2, 3, 4, 5] as ComplianceBand[]) {
        const prev = SCHEDULE_ROWS[g][(b - 1) as ComplianceBand]
        const now = SCHEDULE_ROWS[g][b]
        for (let i = 0; i < 24; i++) {
          if (prev[i] === "v") expect(now[i], `${g} year ${b} col ${i}`).toBe("v")
        }
      }
    }
  })

  it("keeps the three results that read like mistakes", () => {
    // گروه الف is exempt from the inspection stages in all five years.
    for (const b of BANDS) {
      expect(isRequired("A", b, "inspect_design")).toBe(false)
      expect(isRequired("A", b, "inspect_construction")).toBe(false)
      expect(isRequired("A", b, "inspect_completion")).toBe(false)
    }
    // IBMS never applies to الف or ب; ج from year 3; د from year 2.
    for (const b of BANDS) {
      expect(isRequired("A", b, "bms_ibms")).toBe(false)
      expect(isRequired("B", b, "bms_ibms")).toBe(false)
    }
    expect([1, 2].map((b) => isRequired("C", b as ComplianceBand, "bms_ibms"))).toEqual([false, false])
    expect([3, 4, 5].map((b) => isRequired("C", b as ComplianceBand, "bms_ibms"))).toEqual([true, true, true])
    expect(isRequired("D", 1, "bms_ibms")).toBe(false)
    expect(isRequired("D", 2, "bms_ibms")).toBe(true)
    // ب / سال دوم: طراحی and پایان‌کار, but not حین ساخت.
    expect(isRequired("B", 2, "inspect_design")).toBe(true)
    expect(isRequired("B", 2, "inspect_completion")).toBe(true)
    expect(isRequired("B", 2, "inspect_construction")).toBe(false)
  })

  it("asks only two things of الف and ب in the first year", () => {
    for (const g of ["A", "B"] as ScheduleGroup[]) {
      expect(requirementsIn(g, 1).map((r) => r.key)).toEqual([
        "opaque_insulation",
        "glazing_multipane",
      ])
    }
  })

  it("maps every requirement to a real checklist or explicitly to none", () => {
    const keys = new Set(ALL_TOOLS.map((t) => t.toolKey))
    const unmapped = REQUIREMENTS.filter((r) => r.toolKey === null).map((r) => r.key)
    for (const r of REQUIREMENTS) {
      if (r.toolKey !== null) expect(keys.has(r.toolKey), r.key).toBe(true)
    }
    // The six with no tool: the three inspection stages, two leak figures, renewables.
    expect(unmapped).toEqual([
      "inspect_design",
      "inspect_construction",
      "inspect_completion",
      "leak_facade_area",
      "leak_volumetric",
      "renewable_energy",
    ])
  })

  it("folds the plus group variants onto their base letter, and unknown onto the strictest", () => {
    expect(["A", "B", "Bp", "C", "Cp", "Cpp", "D"].map(scheduleGroupOf)).toEqual([
      "A",
      "B",
      "B",
      "C",
      "C",
      "C",
      "D",
    ])
    expect(scheduleGroupOf("")).toBe("D")
    expect(scheduleGroupOf("Z")).toBe("D")
  })
})

describe("the clock", () => {
  it("round-trips both calendars", () => {
    for (const [jy, jm, jd] of [
      [1404, 10, 19],
      [1405, 1, 1],
      [1403, 12, 30],
      [1399, 6, 31],
    ]) {
      const jdn = jalaliToJdn({ jy, jm, jd })
      expect(jdnToJalali(jdn)).toEqual({ jy, jm, jd })
      const g = jdnToGregorian(jdn)
      expect(gregorianToJdn(g)).toBe(jdn)
    }
  })

  it("puts ۱۴۰۴/۱۰/۱۹ on 2026-01-07", () => {
    expect(jdnToGregorian(jalaliToJdn(EDITION5_START))).toEqual({ gy: 2026, gm: 1, gd: 7 })
  })

  it("reads today's date in the Tehran calendar", () => {
    expect(toJalali(at(2026, 8, 17))).toEqual({ jy: 1405, jm: 5, jd: 27 })
  })

  it("has no band before the edition is in force", () => {
    expect(complianceBandOf(at(2026, 1, 6))).toBeNull()
    expect(complianceBandOf(at(2025, 12, 31))).toBeNull()
  })

  it("starts band 1 on the day itself", () => {
    expect(complianceBandOf(at(2026, 1, 7))).toBe(1)
  })

  it("moves band on each anniversary, and not a day early", () => {
    const starts: Array<[ComplianceBand, [number, number, number]]> = [
      [2, [2027, 1, 8]],
      [3, [2028, 1, 8]],
      [4, [2029, 1, 7]],
      [5, [2030, 1, 7]],
    ]
    for (const [band, [gy, gm, gd]] of starts) {
      expect(bandStartDate(band)).toEqual({ gy, gm, gd })
      expect(complianceBandOf(at(gy, gm, gd)), `${band} start`).toBe(band)
      const dayBefore = jdnToGregorian(gregorianToJdn({ gy, gm, gd }) - 1)
      expect(
        complianceBandOf(at(dayBefore.gy, dayBefore.gm, dayBefore.gd)),
        `${band} minus a day`
      ).toBe((band - 1) as ComplianceBand)
    }
  })

  it("holds at band 5 beyond the table, rather than dropping requirements", () => {
    expect(complianceBandOf(at(2031, 6, 1))).toBe(5)
    expect(complianceBandOf(at(2045, 1, 1))).toBe(5)
  })

  it("labels the bands", () => {
    expect(BAND_LABELS[1]).toBe("سال اول")
    expect(BAND_LABELS[5]).toBe("سال پنجم")
  })
})

describe("what a project owes", () => {
  const model = (groupCode: string, created: Date) =>
    requirementsForProject({ groupCode, created })!

  it("answers for a group-ب project created today", () => {
    const m = model("B", at(2026, 8, 17))
    expect([m.groupLabel, m.bandLabel]).toEqual(["ب", "سال اول"])
    expect(m.bandStart).toEqual({ gy: 2026, gm: 1, gd: 7 })
    expect(m.nextBandStart).toEqual({ gy: 2027, gm: 1, gd: 8 })

    // The envelope section is partly required; everything else is untouched so far.
    const env = m.sections.find((s) => s.sectionKey === "env")!
    expect(env.state).toBe("partial")
    expect(env.tools.map((t) => [t.toolKey, t.state])).toEqual([
      ["env_opaque.html", "partial"],
      ["env_trans.html", "partial"],
    ])
    expect(env.tools[0].required.map((r) => r.label)).toEqual(["عایق‌کاری پوسته خارجی"])
    expect(env.tools[1].required.map((r) => r.label)).toEqual(["شیشه چندجداره"])

    for (const key of ["mech", "elec", "mon", "bms"]) {
      expect(m.sections.find((s) => s.sectionKey === key)!.state, key).toBe("not-yet")
    }
  })

  it("keeps the band frozen at creation, not recomputed against a later date", () => {
    // Same project, asked in year two: still year one, because that is when it started.
    const created = at(2026, 8, 17)
    expect(model("B", created).bandLabel).toBe("سال اول")
    // …whereas a project started after the anniversary is year two.
    expect(model("B", at(2027, 2, 1)).bandLabel).toBe("سال دوم")
  })

  it("marks a group-د project as owing everything except IBMS in year one", () => {
    const m = model("D", at(2026, 8, 17))
    expect(m.sections.find((s) => s.sectionKey === "bms")!.state).toBe("not-yet")
    for (const key of ["env", "mech", "elec", "mon"]) {
      expect(m.sections.find((s) => s.sectionKey === key)!.state, key).toBe("required")
    }
    expect(m.unmapped.required.map((r) => r.key)).toEqual([
      "inspect_design",
      "inspect_construction",
      "inspect_completion",
      "leak_facade_area",
      "leak_volumetric",
      "renewable_energy",
    ])
    expect(m.unmapped.notYet).toEqual([])
  })

  it("surfaces the requirements no checklist covers", () => {
    // Group ب, year one owes none of them — and they must still be listed as pending, not vanish.
    const m = model("B", at(2026, 8, 17))
    expect(m.unmapped.required).toEqual([])
    expect(m.unmapped.notYet.map((r) => r.label)).toEqual([
      "طراحی",
      "حین ساخت",
      "پایان‌کار",
      "نشت سطح نما",
      "نشت حجمی",
      "انرژی تجدیدپذیر",
    ])
  })

  it("folds ب+ onto ب and ج++ onto ج", () => {
    expect(model("Bp", at(2026, 8, 17)).groupLabel).toBe("ب")
    expect(model("Cpp", at(2026, 8, 17)).groupLabel).toBe("ج")
  })

  it("returns null when the edition did not apply, or the date is nonsense", () => {
    expect(requirementsForProject({ groupCode: "B", created: at(2025, 5, 1) })).toBeNull()
    expect(requirementsForProject({ groupCode: "B", created: "not a date" })).toBeNull()
  })

  it("answers per checklist, for the assessment workspace", () => {
    const m = model("C", at(2026, 8, 17))
    expect(toolStateOf(m, "env_opaque.html")).toBe("partial")
    expect(toolStateOf(m, "mech_checklist.html")).toBe("partial")
    expect(toolStateOf(m, "monitoring_checklist.html")).toBe("not-yet")
    expect(toolStateOf(m, "integrated_mgmt.html")).toBe("not-yet")
  })

  it("accepts the ISO string the API actually returns", () => {
    const m = requirementsForProject({ groupCode: "B", created: "2026-08-17T09:12:33.123+03:30" })!
    expect(m.bandLabel).toBe("سال اول")
  })
})
