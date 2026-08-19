import { submissionsApi } from "@/api/endpoints";
import type { FormSubmission, Paged, SiteForm, SubmissionListParams } from "@/api/types";
import { formatDateTime } from "@/lib/format";

/**
 * The server clamps `pageSize` to 100 (`GetKurdnezamFormSubmissionsQueryHandler`), and does it
 * SILENTLY — asking for 10,000 returns 100 rows and a `total` saying there are more. So "export
 * everything the filter matches" has to page: a single big request would quietly export the first
 * hundred rows while looking like it had exported the lot.
 */
const EXPORT_PAGE_SIZE = 100;

/** A stop, so a wrong `total` can never spin forever. Reported to the caller when it bites. */
export const MAX_EXPORT_ROWS = 20_000;

export interface FetchAllResult {
  submissions: FormSubmission[];
  /** What the server said the filter matches, before the cap below. */
  total: number;
  /** True when MAX_EXPORT_ROWS stopped us — the file is incomplete and the user must be told. */
  truncated: boolean;
}

/**
 * Every submission matching the CURRENT filters, not just the page on screen.
 *
 * Rows are deduplicated by id: paging is ordered `Created DESC, Id DESC`, so a submission arriving
 * while the export runs shifts every later page by one and would otherwise repeat a row.
 */
export async function fetchAllSubmissions(
  params: Omit<SubmissionListParams, "page" | "pageSize">,
  onProgress?: (loaded: number, total: number) => void,
  /** Injectable so the paging can be exercised without a server. Defaults to the real endpoint. */
  listPage: (p: SubmissionListParams) => Promise<Paged<FormSubmission>> = submissionsApi.list,
): Promise<FetchAllResult> {
  const byId = new Map<number, FormSubmission>();
  let page = 1;
  let total = 0;
  let truncated = false;

  for (;;) {
    const result = await listPage({ ...params, page, pageSize: EXPORT_PAGE_SIZE });
    total = result.total;
    for (const item of result.items) byId.set(item.id, item);
    onProgress?.(byId.size, total);

    // An empty page is the real end of the data. Trusting `total` alone would loop forever if it
    // ever disagreed with the rows actually returned.
    if (result.items.length === 0) break;
    if (byId.size >= total) break;
    if (byId.size >= MAX_EXPORT_ROWS) {
      truncated = true;
      break;
    }
    page += 1;
  }

  return { submissions: [...byId.values()], total, truncated };
}

// ── the sheet ───────────────────────────────────────────────────────────────

export interface ExportTable {
  header: string[];
  rows: string[][];
}

const FIXED_HEADERS = ["فرم", "تاریخ ثبت", "وضعیت"];
const FILES_HEADER = "فایل‌ها";

interface QuestionColumn {
  fieldId: number;
  label: string;
}

/**
 * One column per question, in the order the form asks them.
 *
 * Two rules that are easy to get wrong here:
 *
 * 1. **Columns are keyed by `fieldId`, and the header uses the field's CURRENT label.** Answers
 *    carry `fieldLabel` as a snapshot of how the label read when they were sent, on purpose, so a
 *    renamed field does not make old answers unreadable. Keying by the label would therefore split
 *    one renamed question into two columns.
 * 2. **A field the form no longer has still gets a column.** Deleting a form field deliberately
 *    does not delete answers already sent (`KurdnezamFormAnswer.FieldId` is not a foreign key for
 *    exactly this reason), so those answers exist and must still export — under the snapshot
 *    label, which is the only name left for them.
 *
 * File fields are skipped: their content is file names, which all land in one «فایل‌ها» column, and
 * giving them a question column too would print an empty one on every row.
 */
export function buildQuestionColumns(
  submissions: FormSubmission[],
  forms: SiteForm[],
): QuestionColumn[] {
  const columns: QuestionColumn[] = [];
  const seen = new Set<number>();

  const formById = new Map(forms.map((f) => [f.id, f]));

  // The forms these rows actually belong to, first-seen first. With one form picked there is only
  // one; with «همه فرم‌ها» the questions stay grouped by form instead of interleaving.
  const formOrder: number[] = [];
  for (const s of submissions) {
    if (!formOrder.includes(s.formId)) formOrder.push(s.formId);
  }

  for (const formId of formOrder) {
    const fields = [...(formById.get(formId)?.fields ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const field of fields) {
      if (field.kind === "file" || seen.has(field.id)) continue;
      seen.add(field.id);
      columns.push({ fieldId: field.id, label: field.label });
    }
  }

  // Answers whose field is gone from the form. Newest row first, so a renamed-then-deleted field
  // shows the most recent name anybody actually saw.
  for (const s of submissions) {
    for (const answer of s.answers ?? []) {
      if (seen.has(answer.fieldId)) continue;
      seen.add(answer.fieldId);
      columns.push({ fieldId: answer.fieldId, label: answer.fieldLabel });
    }
  }

  return columns;
}

function filesOf(submission: FormSubmission): string {
  return (submission.attachments ?? []).map((a) => a.fileName).join(" | ");
}

/**
 * Builds the whole sheet. Pure, so the shape can be tested without a network or a browser.
 *
 * @param formTitleOf how to name the form a row belongs to — the page already resolves this,
 *   falling back through the row's own `formTitle` and the forms list.
 */
export function buildExportTable(
  submissions: FormSubmission[],
  forms: SiteForm[],
  formTitleOf: (submission: FormSubmission) => string,
): ExportTable {
  const columns = buildQuestionColumns(submissions, forms);
  const header = [...FIXED_HEADERS, ...columns.map((c) => c.label), FILES_HEADER];

  const rows = submissions.map((s) => {
    // A field can hold more than one answer; join rather than silently keeping the last.
    const byField = new Map<number, string[]>();
    for (const answer of s.answers ?? []) {
      const list = byField.get(answer.fieldId);
      if (list) list.push(answer.text);
      else byField.set(answer.fieldId, [answer.text]);
    }

    return [
      formTitleOf(s),
      formatDateTime(s.created),
      s.isHandled ? "رسیدگی‌شده" : "در انتظار",
      ...columns.map((c) => (byField.get(c.fieldId) ?? []).join(" | ")),
      filesOf(s),
    ];
  });

  return { header, rows };
}

// ── files ───────────────────────────────────────────────────────────────────

/** RFC-4180 cell: wrap in quotes, double any inner quote. */
function csvCell(value: string): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export function tableToCsv(table: ExportTable): string {
  const lines = [table.header, ...table.rows].map((row) => row.map(csvCell).join(","));
  // Leading BOM (U+FEFF) so Excel opens the Persian text as UTF-8 rather than as mojibake.
  return "﻿" + lines.join("\r\n");
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(table: ExportTable, fileName: string): void {
  saveBlob(new Blob([tableToCsv(table)], { type: "text/csv;charset=utf-8;" }), fileName);
}

/**
 * Real .xlsx through SheetJS, loaded on demand — the library is ~400KB and the panel should not
 * pay for it until somebody exports. Same approach as `analytics-web/src/features/export/xlsx.ts`.
 *
 * WRITE ONLY. `xlsx@0.18.5` carries two advisories (prototype pollution, ReDoS) and BOTH are in the
 * parsing path. Never call `XLSX.read`/`readFile` in this app; this file never does.
 */
async function buildWorkbook(table: ExportTable) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([table.header, ...table.rows]);

  // A readable starting width; Excel lets the reader change it, but a wall of «###» does not
  // invite that. Persian is wider per character than Latin, so this is generous on purpose.
  sheet["!cols"] = table.header.map((h) => ({ wch: Math.min(Math.max(h.length + 4, 14), 40) }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "ثبت‌نام‌ها");
  // Persian sheets read right-to-left; without this Excel opens the columns mirrored.
  book.Workbook = { Views: [{ RTL: true }] };

  return { XLSX, book };
}

/**
 * Real .xlsx through SheetJS, loaded on demand — the library is ~400KB and the panel should not
 * pay for it until somebody exports. Same approach as `analytics-web/src/features/export/xlsx.ts`.
 *
 * WRITE ONLY. `xlsx@0.18.5` carries two advisories (prototype pollution, ReDoS) and BOTH are in the
 * parsing path. Never call `XLSX.read`/`readFile` in this app; this file never does.
 */
export async function downloadXlsx(table: ExportTable, fileName: string): Promise<void> {
  const { XLSX, book } = await buildWorkbook(table);
  XLSX.writeFile(book, fileName);
}

/**
 * The same workbook as bytes instead of a download, so its construction can be checked without a
 * browser save dialog. A Persian sheet name carrying a ZWNJ, the RTL view and `!cols` are all
 * things SheetJS could reject at write time, and a download is an awkward place to find that out.
 */
export async function xlsxBytes(table: ExportTable): Promise<Uint8Array> {
  const { XLSX, book } = await buildWorkbook(table);
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
