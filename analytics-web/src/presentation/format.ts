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
/** U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE. */
const LRI = "⁦";
const PDI = "⁩";

export function formatNumber(
  value: number | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  // `Intl.NumberFormat` formats -0 as "-0", so an axis tick or a delta that rounded down to zero read
  // as «-۰». Zero is not negative. (`value === 0` is true for -0, which is the point.)
  const n = value === 0 ? 0 : value;
  if (dir === "ltr") {
    return new Intl.NumberFormat("en-US").format(n);
  }
  // Group with ASCII first, then transliterate separators + digits.
  const grouped = new Intl.NumberFormat("en-US").format(n);
  const fa = toPersianDigits(grouped).replace(/,/g, "٬");

  /**
   * A negative needs a directional isolate, or the minus paints on the wrong side.
   *
   * U+002D HYPHEN-MINUS is bidi-neutral, so in an RTL run it reorders to the *end* of the number:
   * «۱٬۲۳۴-» instead of «-۱٬۲۳۴». Measured on a canvas at 20px by ink-column height — a hyphen is ~2px
   * tall and a digit ~7-10px — with only `ctx.direction` differing:
   *
   * | ctx.direction | leading glyph | trailing glyph |
   * | ltr           | 2px (hyphen)  | 7px (digit)    |
   * | rtl           | 10px (digit)  | 2px (hyphen)   |
   *
   * The chart canvas reports `rtl` (it inherits the CSS direction; zrender never sets it), so this is
   * what real charts do. recharts defended it with `tick={{ style: { direction: "ltr" } }}` — a CSS
   * property with **no canvas counterpart**, since `ctx.direction` is not exposed by any ECharts
   * option. An isolate is the only fix that works in both.
   *
   * Tested against four alternatives: LRI…PDI and a U+200E LRM prefix both fix it; swapping the
   * hyphen for U+2212 MINUS SIGN and appending U+200F RLM both do not.
   *
   * Only wrapped when there is actually a sign, so positive numbers stay byte-identical. Applied here
   * rather than at each call site so the on-screen table and the PDF get it too — CSV and Excel take
   * raw row values, so no control characters reach a spreadsheet cell.
   */
  return fa.startsWith("-") ? `${LRI}${fa}${PDI}` : fa;
}

/**
 * A share, with its sign: «۳۶٫۹۷٪» or "36.97%".
 *
 * The sign is not decoration. U+066A ARABIC PERCENT SIGN and U+0025 PERCENT SIGN are different
 * characters, and the donut's legend and tooltip appended U+066A **unconditionally** — so an English
 * reader saw "36.97٪". Inherited from the recharts donut and fixed here deliberately while moving
 * that donut to ECharts, rather than carried across because it was already there.
 */
export function formatPercent(value: number | null | undefined, dir: Dir): string {
  const n = formatNumber(value, dir);
  if (n === "") return "";
  return dir === "rtl" ? `${n}٪` : `${n}%`;
}

/**
 * Shortened number for somewhere with a fixed width: «۱۵ میلیارد», "15B".
 *
 * Only for places where the full number physically cannot fit — it trades digits for room, and a
 * number that fits should never be shortened. `formatFitted` decides.
 */
export function formatCompact(
  value: number | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(dir === "rtl" ? "fa-IR" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * The full grouped number when it is short enough, the shortened one when it is not.
 *
 * The donut's centre is a hole of fixed size while the number in it is whatever the data says.
 * «۹٬۵۶۷» fits and stays exact; «۱۵٬۰۴۵٬۵۰۰٬۰۰۰» is fourteen characters and overflowed the ring, so
 * it becomes «۱۵ میلیارد». Precision is given up only when the alternative is text drawn over the
 * chart.
 *
 * @param maxChars width of the space, in characters.
 */
export function formatFitted(
  value: number | null | undefined,
  dir: Dir,
  maxChars = 10,
): string {
  const full = formatNumber(value, dir);
  return full.length <= maxChars ? full : formatCompact(value, dir);
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
 * A moment in time, for the places that record when something happened — last
 * updated, last run, created. `formatDate` answers "which day"; this answers
 * "when", and the difference matters on a timestamp you are checking for
 * freshness.
 *
 * Two things it does that a bare `.toLocaleString()` does not:
 *
 * - **It follows the app's language, not the browser's.** `fa-IR` gives the
 *   Persian calendar and Persian digits; `en-GB` gives a Gregorian day/month.
 *   Reading the browser locale would show a Jalali date to someone who has
 *   switched the app to English.
 * - **It shows the reader's own clock.** The API sends UTC (`…+00:00`); Tehran
 *   is three and a half hours ahead, so the raw value is never the time anyone
 *   there saw it happen.
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  dir: Dir,
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  // Anything unparseable is handed back untouched rather than shown as "Invalid Date".
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(dir === "rtl" ? "fa-IR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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
