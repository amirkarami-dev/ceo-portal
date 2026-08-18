/**
 * جدول ۱۹-۲-۱ — «زمان‌بندی الزام اجرای بخش‌های مختلف ویرایش پنجم مبحث نوزدهم برای گروه‌های ساختمانی».
 *
 * Transcribed from `docs/mabhas19/mab19-v5.pdf`, PDF page 64. Which parts of the fifth edition a
 * building must obey depends on **two** things: its building group, and how long the edition has been
 * in force. Everything here is the document's; nothing is interpolated.
 *
 * ## How the marks were read, and why the rows are strings
 *
 * The ✓/✗ marks are not text — both symbols are ONE private-use codepoint (`U+E10A`, glyph id 0) in a
 * single font, size and colour, and each is drawn as a cloud of tiny filled rectangles. No text
 * extraction can tell them apart, and 480 cells is too many to eye-ball safely. They were classified
 * by shape (a ✗ inks the top-left of its box; a ✓ leaves it empty and throws its long stroke
 * top-right), which came out bimodal with nothing near the threshold, and ~60 cells across six rows
 * were then checked against the rendered page by eye. Totals: 299 ✓, 181 ✗.
 *
 * Each row is kept as a 24-character string in the **printed column order** so it can be read against
 * the document line by line, the way the appendix-2 table keeps its printed row order. Deriving sets
 * from strings is cheap; auditing a hand-written set against a scanned table is not.
 */
import type { ToolKey } from "./sections"

/** The four groups the table uses. Its footnote cites ماده ۱۲ آیین‌نامه اجرایی قانون نظام مهندسی. */
export type ScheduleGroup = "A" | "B" | "C" | "D"

export const SCHEDULE_GROUP_LABELS: Record<ScheduleGroup, string> = {
  A: "الف",
  B: "ب",
  C: "ج",
  D: "د",
}

/** «زمان اجرا» — which year of enforcement the project falls in. The table stops at five. */
export type ComplianceBand = 1 | 2 | 3 | 4 | 5

export const BAND_LABELS: Record<ComplianceBand, string> = {
  1: "سال اول",
  2: "سال دوم",
  3: "سال سوم",
  4: "سال چهارم",
  5: "سال پنجم",
}

export type RequirementKey =
  | "inspect_design"
  | "inspect_construction"
  | "inspect_completion"
  | "opaque_insulation"
  | "facade_reflectance"
  | "roof_reflectance"
  | "glazing_multipane"
  | "glazing_min_r"
  | "glazing_shgc"
  | "leak_facade_area"
  | "leak_volumetric"
  | "mech_heat_recovery"
  | "mech_equipment_efficiency"
  | "mech_plant_control"
  | "mech_control_valve"
  | "mech_four_pipe"
  | "mech_primary_secondary"
  | "mech_variable_speed_pump"
  | "elec_smart_lighting"
  | "elec_ev_charger"
  | "mon_monitoring"
  | "mon_sub_monitoring"
  | "bms_ibms"
  | "renewable_energy"

export interface Requirement {
  key: RequirementKey
  /** The column heading, as printed. */
  label: string
  /** The column *group* heading, as printed — «بازرسی», «تأسیسات مکانیکی», … */
  heading: string
  /**
   * The checklist that covers it, or `null` when the app has no tool for it. `null` is a real answer,
   * not a gap to paper over: the بازرسی stages are process steps, the two leak figures come from a
   * blower-door test, and renewables have no checklist at all. A requirement with no tool still has to
   * reach the screen — dropping it would report a project as complete against a rule it never showed.
   */
  toolKey: ToolKey | null
}

/**
 * The 24 columns, right to left, exactly as the table prints them. The order is load-bearing: the row
 * strings below are indexed by it.
 */
export const REQUIREMENTS: readonly Requirement[] = [
  { key: "inspect_design", label: "طراحی", heading: "بازرسی", toolKey: null },
  { key: "inspect_construction", label: "حین ساخت", heading: "بازرسی", toolKey: null },
  { key: "inspect_completion", label: "پایان‌کار", heading: "بازرسی", toolKey: null },

  { key: "opaque_insulation", label: "عایق‌کاری پوسته خارجی", heading: "جداره غیرنورگذر", toolKey: "env_opaque.html" },
  { key: "facade_reflectance", label: "الزامات بازتاب نما", heading: "جداره غیرنورگذر", toolKey: "env_opaque.html" },
  { key: "roof_reflectance", label: "الزامات بازتاب بام", heading: "جداره غیرنورگذر", toolKey: "env_opaque.html" },

  { key: "glazing_multipane", label: "شیشه چندجداره", heading: "جداره نورگذر", toolKey: "env_trans.html" },
  { key: "glazing_min_r", label: "حداقل مقاومت حرارتی", heading: "جداره نورگذر", toolKey: "env_trans.html" },
  { key: "glazing_shgc", label: "SHGC", heading: "جداره نورگذر", toolKey: "env_trans.html" },

  { key: "leak_facade_area", label: "نشت سطح نما", heading: "تست نشت هوا", toolKey: null },
  { key: "leak_volumetric", label: "نشت حجمی", heading: "تست نشت هوا", toolKey: null },

  { key: "mech_heat_recovery", label: "بازیافت حرارت", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_equipment_efficiency", label: "بازدهی تجهیزات انرژی‌بر", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_plant_control", label: "سیستم کنترل موتورخانه", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_control_valve", label: "شیر کنترلی و جریان‌سنج", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_four_pipe", label: "سرمایش و گرمایش ۴ لوله", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_primary_secondary", label: "مدار اولیه، ثانویه", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },
  { key: "mech_variable_speed_pump", label: "پمپ دورمتغیر", heading: "تأسیسات مکانیکی", toolKey: "mech_checklist.html" },

  { key: "elec_smart_lighting", label: "سامانه هوشمند روشنایی", heading: "تأسیسات الکتریکی", toolKey: "elec_checklist.html" },
  { key: "elec_ev_charger", label: "شارژر خودرو برقی", heading: "تأسیسات الکتریکی", toolKey: "elec_checklist.html" },

  { key: "mon_monitoring", label: "پایش", heading: "سامانه پایش و مدیریت یکپارچه", toolKey: "monitoring_checklist.html" },
  { key: "mon_sub_monitoring", label: "زیرپایش", heading: "سامانه پایش و مدیریت یکپارچه", toolKey: "monitoring_checklist.html" },
  { key: "bms_ibms", label: "سامانه مدیریت یکپارچه (IBMS)", heading: "سامانه پایش و مدیریت یکپارچه", toolKey: "integrated_mgmt.html" },

  { key: "renewable_energy", label: "انرژی تجدیدپذیر", heading: "انرژی تجدیدپذیر", toolKey: null },
] as const

/**
 * One string per (group, year), 24 characters, in `REQUIREMENTS` order: `v` = ✓ required,
 * `x` = ✗ not yet. Read straight off the page — including the three results that surprise:
 *
 * - **گروه الف never requires the بازرسی stages**, in any of the five years.
 * - **IBMS lands last**: never for الف or ب, ج from year 3, د from year 2.
 * - **ب / سال دوم requires طراحی and پایان‌کار but not حین ساخت.** Checked twice; not a misread.
 */
export const SCHEDULE_ROWS: Record<ScheduleGroup, Record<ComplianceBand, string>> = {
  A: {
    1: "xxxvxxvxxxxxxxxxxxxxxxxx",
    2: "xxxvxxvxxxxxvxxxxxxxxxxx",
    3: "xxxvxxvxxxxxvvxxxxxxxxxx",
    4: "xxxvxxvvxxxxvvxxxxxxvxxv",
    5: "xxxvvvvvvxxvvvxxxxxxvvxv",
  },
  B: {
    1: "xxxvxxvxxxxxxxxxxxxxxxxx",
    2: "vxvvxxvxxxxxvvxxxxxxxxxx",
    3: "vvvvxxvvxxxxvvxxxxxvvxxv",
    4: "vvvvvvvvvxxvvvxxxxxvvvxv",
    5: "vvvvvvvvvvvvvvvxxvvvvvxv",
  },
  C: {
    1: "vxvvxxvvxxxxvvxxxxxxxxxx",
    2: "vvvvvvvvvxvvvvxxxvxvvxxv",
    3: "vvvvvvvvvvvvvvvvvvvvvvvv",
    4: "vvvvvvvvvvvvvvvvvvvvvvvv",
    5: "vvvvvvvvvvvvvvvvvvvvvvvv",
  },
  D: {
    1: "vvvvvvvvvvvvvvvvvvvvvvxv",
    2: "vvvvvvvvvvvvvvvvvvvvvvvv",
    3: "vvvvvvvvvvvvvvvvvvvvvvvv",
    4: "vvvvvvvvvvvvvvvvvvvvvvvv",
    5: "vvvvvvvvvvvvvvvvvvvvvvvv",
  },
}

/**
 * `calcBuildingGroup` returns seven codes (`A, B, Bp, C, Cp, Cpp, D`); the regulation has four rows.
 * The plus variants are sub-divisions of the same letter — ب+ is still ب to this table — so the base
 * letter decides. Anything unrecognised falls to `D`, the strictest row: a wrong guess must not let a
 * building off a requirement it owes.
 */
export function scheduleGroupOf(groupCode: string): ScheduleGroup {
  const letter = groupCode.charAt(0).toUpperCase()
  return letter === "A" || letter === "B" || letter === "C" || letter === "D" ? letter : "D"
}

/** The requirements a group owes in a given year. */
export function requirementsIn(group: ScheduleGroup, band: ComplianceBand): Requirement[] {
  const row = SCHEDULE_ROWS[group][band]
  return REQUIREMENTS.filter((_, i) => row[i] === "v")
}

/** The requirements a group does NOT owe yet — the other half, kept because the UI shows both. */
export function requirementsNotYetIn(group: ScheduleGroup, band: ComplianceBand): Requirement[] {
  const row = SCHEDULE_ROWS[group][band]
  return REQUIREMENTS.filter((_, i) => row[i] !== "v")
}

export function isRequired(
  group: ScheduleGroup,
  band: ComplianceBand,
  key: RequirementKey
): boolean {
  const index = REQUIREMENTS.findIndex((r) => r.key === key)
  return index >= 0 && SCHEDULE_ROWS[group][band][index] === "v"
}
