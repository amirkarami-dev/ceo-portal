import type { QueryResult, ResultRow } from "@/contracts";

/** RFC 4180 field escaping: wrap in quotes if it contains a quote, comma,
 *  CR or LF; double any embedded quote. */
function escapeField(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Serialize a QueryResult to CSV: header (column labels) + one line per row.
 *  Cells are taken by column key; missing/null → empty. CRLF line endings. */
export function toCsv(result: QueryResult): string {
  const header = result.columns.map((c) => escapeField(c.label)).join(",");
  if (result.rows.length === 0) return header;
  const body = result.rows
    .map((row: ResultRow) =>
      result.columns.map((c) => escapeField(row[c.key] ?? null)).join(","),
    )
    .join("\r\n");
  return `${header}\r\n${body}`;
}
