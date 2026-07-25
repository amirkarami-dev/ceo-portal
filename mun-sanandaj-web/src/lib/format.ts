/** Absolute local date-time in Persian (fa-IR) — e.g. for tooltips. */
export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("fa-IR");
}

/** Compact relative time in Persian — e.g. "۵ دقیقه پیش". Falls back to absolute for old dates. */
export function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const MIN = 60_000;
  const HR = 3_600_000;
  const DAY = 86_400_000;
  if (abs < MIN) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < HR) return rtf.format(Math.round(diffMs / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diffMs / HR), "hour");
  if (abs < 7 * DAY) return rtf.format(Math.round(diffMs / DAY), "day");
  return absoluteTime(iso);
}

/** Persian-digit integer, e.g. 1234 -> "۱٬۲۳۴". */
export function faNumber(n: number): string {
  return n.toLocaleString("fa-IR");
}

/** Public URL of the report PDF, named by the Peygiri tracking code. */
export function reportPdfUrl(peygiri: string): string {
  return `https://eservice.kurdnezam.ir/sm/pdf/${peygiri}.pdf`;
}
