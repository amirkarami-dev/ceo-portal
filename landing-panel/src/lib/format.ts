/** Persian display helpers. The Jalali calendar comes from Intl (fa-IR), so no date lib is needed. */

const DATE_TIME = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

/** ISO-8601 (e.g. `FormSubmission.created`) -> "۱۴ تیر ۱۴۰۵، ۱۶:۲۰". */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_TIME.format(d);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DATE_ONLY.format(d);
}

/** 1234 -> "۱٬۲۳۴". */
export function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("fa-IR");
}

/** Truncates long body/summary text for a table cell. */
export function truncate(text: string | null | undefined, max = 60): string {
  const t = (text ?? "").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
