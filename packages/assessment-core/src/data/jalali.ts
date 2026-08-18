/**
 * Jalali ↔ Gregorian, and «زمان اجرا» — which enforcement year a date falls in.
 *
 * Written here rather than pulled in: `mabhas19-web` has no date library at all, and this needs three
 * functions, not a dependency. Everything goes through the **Julian day number**, so a conversion is
 * integer arithmetic with no month-length special cases and no drift.
 *
 * `Intl` with the `persian` calendar could answer some of this, but its result depends on the ICU
 * version shipped with the runtime, and two runtimes disagreeing by a day would move a project between
 * enforcement years. Deterministic arithmetic that a test can pin is worth more here than brevity.
 */
import { BAND_LABELS, type ComplianceBand } from "./schedule19"

export interface JalaliDate {
  jy: number
  jm: number
  jd: number
}

export interface GregorianDate {
  gy: number
  gm: number
  gd: number
}

export function gregorianToJdn({ gy, gm, gd }: GregorianDate): number {
  const a = Math.floor((14 - gm) / 12)
  const y = gy + 4800 - a
  const m = gm + 12 * a - 3
  return (
    gd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

export function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    gy: 100 * b + d - 4800 + Math.floor(m / 10),
    gm: m + 3 - 12 * Math.floor(m / 10),
    gd: e - Math.floor((153 * m + 2) / 5) + 1,
  }
}

export function jalaliToJdn({ jy, jm, jd }: JalaliDate): number {
  const epbase = jy - (jy >= 0 ? 474 : 473)
  const epyear = 474 + (epbase % 2820)
  const monthDays = jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6
  return (
    jd +
    monthDays +
    Math.floor((epyear * 682 - 110) / 2816) +
    (epyear - 1) * 365 +
    Math.floor(epbase / 2820) * 1029983 +
    (1948320 - 1)
  )
}

export function jdnToJalali(jdn: number): JalaliDate {
  const depoch = jdn - jalaliToJdn({ jy: 475, jm: 1, jd: 1 })
  const cycle = Math.floor(depoch / 1029983)
  const cyear = depoch % 1029983
  let ycycle: number
  if (cyear === 1029982) {
    ycycle = 2820
  } else {
    const aux1 = Math.floor(cyear / 366)
    const aux2 = cyear % 366
    ycycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1
  }
  let jy = ycycle + 2820 * cycle + 474
  if (jy <= 0) jy -= 1
  const yday = jdn - jalaliToJdn({ jy, jm: 1, jd: 1 }) + 1
  if (yday <= 186) {
    const jm = Math.floor((yday - 1) / 31) + 1
    return { jy, jm, jd: yday - (jm - 1) * 31 }
  }
  const jm = Math.floor((yday - 187) / 30) + 8
  return { jy, jm, jd: yday - 186 - (jm - 8) * 30 }
}

/**
 * Tehran is a fixed **UTC+03:30** — Iran abolished DST in 2022 — so the calendar day there is the UTC
 * day of the shifted instant. Reading the browser's local parts instead would put a project in a
 * different enforcement year depending on where the engineer happens to be sitting.
 */
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30

export function tehranCalendarDate(date: Date): GregorianDate {
  const shifted = new Date(date.getTime() + TEHRAN_OFFSET_MINUTES * 60_000)
  return {
    gy: shifted.getUTCFullYear(),
    gm: shifted.getUTCMonth() + 1,
    gd: shifted.getUTCDate(),
  }
}

export function toJalali(date: Date): JalaliDate {
  return jdnToJalali(gregorianToJdn(tehranCalendarDate(date)))
}

/** The day the fifth edition became binding: ۱۴۰۴/۱۰/۱۹ — which is 2026-01-07. */
export const EDITION5_START: JalaliDate = { jy: 1404, jm: 10, jd: 19 }

/** The Gregorian date each enforcement year begins on. Band 1 starts on the day itself. */
export function bandStartDate(band: ComplianceBand): GregorianDate {
  return jdnToGregorian(jalaliToJdn({ ...EDITION5_START, jy: EDITION5_START.jy + band - 1 }))
}

/**
 * Which enforcement year a date falls in.
 *
 * Before the start date the fifth edition is not in force at all, so there is nothing to report:
 * `null`, not band 1. Past year five the table simply stops — treated as year 5, the strictest row
 * that group ever reaches, because the alternative is silently dropping requirements a building owes.
 */
export function complianceBandOf(date: Date): ComplianceBand | null {
  const { jy, jm, jd } = toJalali(date)
  const startJdn = jalaliToJdn(EDITION5_START)
  if (gregorianToJdn(tehranCalendarDate(date)) < startJdn) return null

  const monthsElapsed =
    (jy - EDITION5_START.jy) * 12 + (jm - EDITION5_START.jm) - (jd < EDITION5_START.jd ? 1 : 0)
  const band = Math.floor(monthsElapsed / 12) + 1
  return (band > 5 ? 5 : band) as ComplianceBand
}

export function bandLabelOf(band: ComplianceBand): string {
  return BAND_LABELS[band]
}
