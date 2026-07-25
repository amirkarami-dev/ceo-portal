import type { FieldType } from "../contracts/common";

export type Dir = "rtl" | "ltr";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Map ASCII 0-9 to Persian digits; all other characters pass through. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Grouped thousands formatting. LTR uses ASCII comma grouping; RTL uses
 * Persian digits with the Persian thousands separator (U+066C).
 */
export function formatNumber(
  value: number | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (dir === "ltr") {
    return new Intl.NumberFormat("en-US").format(value);
  }
  // Group with ASCII first, then transliterate separators + digits.
  const grouped = new Intl.NumberFormat("en-US").format(value);
  return toPersianDigits(grouped).replace(/,/g, "٬");
}

// The KurdNezam DB stores dates as Jalali strings ("1405/03/16") — a 4-digit
// year in the 1200–1599 range is Jalali and must pass through untouched, never
// go through `new Date()` (which would read it as Gregorian year 1405).
const JALALI_RE = /^1[2-5]\d{2}([/-])\d{1,2}(?:\1\d{1,2})?$/;
const GREGORIAN_RE = /^(?:19|20)\d{2}([/-])(\d{1,2})(?:\1(\d{1,2}))?$/;

function toJalaliParts(d: Date): { y: string; m: string; d: string } {
  // Persian calendar with Latin digits so the parts are plain ASCII we can
  // reassemble as y/m/d (Intl's own fa-IR pattern order is not guaranteed).
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Date display as YYYY/MM/DD. Jalali strings from the DB pass through; RTL
 * converts Gregorian values to the Persian (Jalali) calendar, LTR keeps
 * Gregorian.
 */
export function formatDate(
  value: string | number | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined || value === "") return "";
  const s = String(value).trim();
  if (JALALI_RE.test(s)) return dir === "rtl" ? toPersianDigits(s) : s;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (dir === "rtl") {
    const j = toJalaliParts(d);
    return toPersianDigits(`${j.y}/${j.m}/${j.d}`);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * Chart category / axis-label display. Date-like strings follow formatDate's
 * calendar rules but keep their granularity ("2025-05" → "۱۴۰۴/۰۲", not a full
 * date); everything else passes through unchanged.
 */
export function formatCategory(
  value: string | number | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (JALALI_RE.test(s)) return dir === "rtl" ? toPersianDigits(s) : s;
  const m = s.match(GREGORIAN_RE);
  if (!m) return String(value);
  if (dir !== "rtl") return s;
  const day = m[3];
  const d = new Date(
    Date.UTC(Number(s.slice(0, 4)), Number(m[2]) - 1, day ? Number(day) : 1),
  );
  if (Number.isNaN(d.getTime())) return s;
  const j = toJalaliParts(d);
  return toPersianDigits(day ? `${j.y}/${j.m}/${j.d}` : `${j.y}/${j.m}`);
}

/** Dispatch a single cell value to the right formatter by semantic type. */
export function formatCell(
  value: string | number | null,
  type: FieldType,
  dir: Dir,
): string {
  if (value === null || value === undefined) return "";
  switch (type) {
    case "number":
      return formatNumber(typeof value === "number" ? value : Number(value), dir);
    case "date":
      return formatDate(value, dir);
    case "boolean": {
      // ResultRow values are string|number|null, but callers may pass a real boolean
      // (e.g. from Dataset rows before aggregation). Cast through unknown to allow it.
      const v = value as unknown;
      const truthy = v === true || v === 1 || v === "true";
      return truthy ? (dir === "rtl" ? "بله" : "Yes") : dir === "rtl" ? "خیر" : "No";
    }
    default: {
      // DB date columns are typed "string" in the semantic model (they hold
      // Jalali strings) — still render them as dates, not raw ASCII.
      const s = String(value).trim();
      if (typeof value === "string" && (JALALI_RE.test(s) || GREGORIAN_RE.test(s))) {
        return formatCategory(value, dir);
      }
      return String(value);
    }
  }
}
