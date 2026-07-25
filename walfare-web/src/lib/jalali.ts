/**
 * Jalali (شمسی) calendar helpers built on Intl only — no date library. The API talks Jalali
 * strings like "1405/05/01" (Latin digits); the UI renders Persian digits itself.
 */

const latnParts = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/** Gregorian Date → Jalali numbers. */
export function toJalali(date: Date): JalaliParts {
  const parts = latnParts.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

/** "1405/05/01" — the exact format the API expects. */
export function toApiDate(p: JalaliParts): string {
  return `${p.jy}/${String(p.jm).padStart(2, "0")}/${String(p.jd).padStart(2, "0")}`;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function faDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function faMoney(rials: number): string {
  return faDigits(rials.toLocaleString("en-US")) + " ریال";
}

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

/** Week starts Saturday (شنبه) — the same convention as the API's ActiveDays bitmask. */
export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** 0=شنبه … 6=جمعه for a Gregorian date. */
export function weekdayBit(date: Date): number {
  const dow = date.getDay(); // Sunday=0 … Saturday=6
  return dow === 6 ? 0 : dow + 1;
}

export interface CalendarDay {
  /** Midnight local time. */
  date: Date;
  jalali: JalaliParts;
  apiDate: string;
  weekdayBit: number;
}

/**
 * All days of the Jalali month containing `anchor`, in order. Implemented by scanning outward
 * from the anchor day — ~62 Intl calls per month, imperceptible next to a network request.
 */
export function jalaliMonthDays(anchor: Date): CalendarDay[] {
  const target = toJalali(anchor);
  const days: CalendarDay[] = [];

  // Walk back to day 1 of the month, then forward until the month changes.
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (target.jd - 1));

  for (let i = 0; i < 32; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const j = toJalali(d);
    if (j.jm !== target.jm || j.jy !== target.jy) break;
    days.push({ date: d, jalali: j, apiDate: toApiDate(j), weekdayBit: weekdayBit(d) });
  }
  return days;
}

/** The same Jalali month shifted by `delta` months (for the calendar's next/prev buttons). */
export function shiftJalaliMonth(anchor: Date, delta: number): Date {
  const current = toJalali(anchor);
  // Jump from day 1 in ~31-day steps; correct by re-reading the Jalali month each hop.
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (current.jd - 1)); // day 1 of this month
  d.setDate(d.getDate() + delta * 31);
  // Snap to day 1 of whatever month we landed in.
  const landed = toJalali(d);
  d.setDate(d.getDate() - (landed.jd - 1));
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
