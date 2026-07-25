// Real .xlsx export via SheetJS. The library is ~400KB so it is loaded on
// demand (dynamic import) — the main bundle pays nothing until the first click.
import type { QueryResult } from "@/contracts";

/** Pure worksheet builder: header row of column labels + one row per result row.
 *  Kept separate from the download side effect so it is unit-testable. */
export function resultToAoa(result: QueryResult): (string | number | null)[][] {
  const header = result.columns.map((c) => c.label);
  const rows = result.rows.map((r) => result.columns.map((c) => r[c.key] ?? null));
  return [header, ...rows];
}

export async function exportXlsx(fileName: string, result: QueryResult): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(resultToAoa(result));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  // Persian sheets read right-to-left.
  wb.Workbook = { Views: [{ RTL: document.documentElement.dir === "rtl" }] };
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
