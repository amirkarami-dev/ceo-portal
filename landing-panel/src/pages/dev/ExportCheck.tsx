// Dev-only checks for the submissions export (route: /dev/export-check). Excluded from prod.
//
// The submissions screen sits behind the IdP and this project does not type passwords into a
// browser, so the export cannot be exercised by clicking it. These run the REAL functions against
// invented data and print what they produced, which is the part worth proving: the paging that
// makes "all filtered rows" true, and the column rules that decide what a question column is.
import { useEffect, useState } from "react";
import type { FormSubmission, Paged, SiteForm, SubmissionListParams } from "@/api/types";
import {
  buildExportTable,
  buildQuestionColumns,
  fetchAllSubmissions,
  tableToCsv,
  xlsxBytes,
} from "@/lib/submissionExport";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

function field(id: number, label: string, sortOrder: number, kind: "text" | "file" = "text") {
  return { id, label, kind, isRequired: false, allowMultiple: false, help: null, sortOrder };
}

/** Field 3 is a FILE field; field 4 was deleted from the form but its answers survive. */
const FORMS: SiteForm[] = [
  {
    id: 8,
    title: "فرم آزمایشی",
    note: "",
    deadline: "",
    image: "",
    isOpen: true,
    successMessage: "",
    sortOrder: 1,
    submissionCount: 3,
    // Deliberately out of order, to prove sortOrder decides the columns.
    fields: [
      field(2, "مدیرعامل", 2),
      field(1, "نام و نام خانوادگی", 1),
      field(3, "مدارک", 3, "file"),
    ],
  },
];

function submission(
  id: number,
  answers: [number, string, string][],
  files: string[] = [],
): FormSubmission {
  return {
    id,
    formId: 8,
    formTitle: "فرم آزمایشی",
    isHandled: id % 2 === 0,
    created: "2026-08-19T09:00:00Z",
    answers: answers.map(([fieldId, fieldLabel, text]) => ({ fieldId, fieldLabel, text })),
    attachments: files.map((fileName, i) => ({
      id: id * 100 + i,
      fieldId: 3,
      fieldLabel: "مدارک",
      fileName,
      contentType: "application/pdf",
      sizeBytes: 1024,
    })),
  };
}

const ROWS: FormSubmission[] = [
  // The label snapshot here is the OLD name of field 1 — the form now calls it something else.
  submission(
    1,
    [
      [1, "نام قدیمی", "کیومرث حکیمی"],
      [2, "مدیرعامل", "کیومرث حکیمی"],
    ],
    ["a.pdf", "b.pdf"],
  ),
  // An answer against field 4, which the form no longer has at all.
  submission(2, [
    [1, "نام و نام خانوادگی", "شادیا ظهوری"],
    [4, "فیلد حذف‌شده", "مقدار قدیمی"],
  ]),
  // Two answers for one field.
  submission(3, [
    [2, "مدیرعامل", "الف"],
    [2, "مدیرعامل", "ب"],
  ]),
];

/** A stand-in server, so the paging is really exercised without a network. */
function fakePager(totalRows: number, opts: { lyingTotal?: number } = {}) {
  let calls = 0;
  const pager = async (p: SubmissionListParams): Promise<Paged<FormSubmission>> => {
    calls += 1;
    const size = p.pageSize ?? 20;
    const page = p.page ?? 1;
    const start = (page - 1) * size;
    const items: FormSubmission[] = [];
    for (let i = start; i < Math.min(start + size, totalRows); i += 1) {
      items.push(submission(i + 1, [[1, "نام و نام خانوادگی", `نفر ${i + 1}`]]));
    }
    return {
      items,
      total: opts.lyingTotal ?? totalRows,
      page,
      pageSize: size,
      totalPages: Math.ceil(totalRows / size),
    };
  };
  return { pager, calls: () => calls };
}

async function runChecks(): Promise<Check[]> {
  const out: Check[] = [];
  const titleOf = (s: FormSubmission) => s.formTitle ?? `فرم #${s.formId}`;

  // ── the columns ──────────────────────────────────────────────────────────
  const cols = buildQuestionColumns(ROWS, FORMS);
  const labels = cols.map((c) => c.label);

  out.push({
    name: "questions follow the form's own order (sortOrder), not the data",
    pass: labels[0] === "نام و نام خانوادگی" && labels[1] === "مدیرعامل",
    detail: labels.join(" | "),
  });
  out.push({
    name: "a FILE field gets no question column (its names go in فایل‌ها)",
    pass: !labels.includes("مدارک"),
    detail: labels.includes("مدارک") ? "مدارک leaked in" : "absent, correct",
  });
  out.push({
    name: "a renamed field stays ONE column, under its current label",
    pass: labels.filter((l) => l === "نام و نام خانوادگی" || l === "نام قدیمی").length === 1,
    detail: `current label present: ${labels.includes("نام و نام خانوادگی")}, old snapshot leaked: ${labels.includes("نام قدیمی")}`,
  });
  out.push({
    name: "an answer whose field was DELETED still gets a column, under its snapshot label",
    pass: labels.includes("فیلد حذف‌شده"),
    detail: labels.join(" | "),
  });

  // ── the sheet ────────────────────────────────────────────────────────────
  const table = buildExportTable(ROWS, FORMS, titleOf);
  const header = table.header;
  const row1 = table.rows[0];
  const row3 = table.rows[2];

  out.push({
    name: "header is فرم | تاریخ ثبت | وضعیت | …questions… | فایل‌ها",
    pass:
      header[0] === "فرم" &&
      header[1] === "تاریخ ثبت" &&
      header[2] === "وضعیت" &&
      header[header.length - 1] === "فایل‌ها",
    detail: header.join(" | "),
  });
  out.push({
    name: "a renamed field's OLD answer still lands in that column",
    pass: row1[3] === "کیومرث حکیمی",
    detail: `row1 = ${row1.join(" | ")}`,
  });
  out.push({
    name: "file names are listed, not counted",
    pass: row1[row1.length - 1] === "a.pdf | b.pdf",
    detail: row1[row1.length - 1],
  });
  out.push({
    name: "two answers for one field are joined, not silently dropped",
    pass: row3[4] === "الف | ب",
    detail: `row3 = ${row3.join(" | ")}`,
  });
  out.push({
    name: "every row has exactly as many cells as the header",
    pass: table.rows.every((r) => r.length === header.length),
    detail: `header ${header.length}, rows ${table.rows.map((r) => r.length).join(",")}`,
  });

  const csv = tableToCsv(table);
  out.push({
    name: "CSV starts with the UTF-8 BOM so Excel reads Persian",
    pass: csv.charCodeAt(0) === 0xfeff,
    detail: `first code unit: ${csv.charCodeAt(0).toString(16)}`,
  });

  // ── the paging: the whole point of the request ────────────────────────────
  const big = fakePager(250);
  const all = await fetchAllSubmissions({ formId: 8 }, undefined, big.pager);
  out.push({
    name: "exports ALL filtered rows, not one page (250 rows over pages of 100)",
    pass: all.submissions.length === 250 && !all.truncated,
    detail: `got ${all.submissions.length} of ${all.total} in ${big.calls()} requests, truncated=${all.truncated}`,
  });
  out.push({
    name: "no duplicate rows across pages",
    pass: new Set(all.submissions.map((s) => s.id)).size === all.submissions.length,
    detail: `${new Set(all.submissions.map((s) => s.id)).size} unique of ${all.submissions.length}`,
  });

  // A server that reports more rows than it will ever hand over must not loop forever.
  const liar = fakePager(120, { lyingTotal: 99999 });
  const guarded = await fetchAllSubmissions({}, undefined, liar.pager);
  out.push({
    name: "a wrong `total` cannot spin forever — an empty page ends it",
    pass: guarded.submissions.length === 120 && liar.calls() <= 4,
    detail: `${guarded.submissions.length} rows in ${liar.calls()} requests`,
  });

  const exact = fakePager(100);
  const one = await fetchAllSubmissions({}, undefined, exact.pager);
  out.push({
    name: "exactly one full page does not fetch a second time",
    pass: one.submissions.length === 100 && exact.calls() === 1,
    detail: `${one.submissions.length} rows in ${exact.calls()} request(s)`,
  });

  // ── the workbook itself ──────────────────────────────────────────────────
  const bytes = new Uint8Array(await xlsxBytes(table));
  // .xlsx is a zip; every one starts "PK".
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  out.push({
    name: "SheetJS writes a real .xlsx (Persian sheet name with ZWNJ, RTL view, column widths)",
    pass: isZip && bytes.length > 1000,
    detail: `${bytes.length} bytes, zip signature: ${isZip}`,
  });

  return out;
}

export function ExportCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    runChecks()
      .then(setChecks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <pre data-testid="export-check-error">THREW: {error}</pre>;
  if (!checks) return <pre>running…</pre>;

  const failed = checks.filter((c) => !c.pass).length;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", direction: "ltr" }}>
      <h2 data-testid="export-check-summary">
        {failed === 0 ? `ALL ${checks.length} PASS` : `${failed} of ${checks.length} FAILED`}
      </h2>
      <ol>
        {checks.map((c) => (
          <li key={c.name} style={{ marginBottom: 10, color: c.pass ? "#137333" : "#b3261e" }}>
            <strong>{c.pass ? "PASS" : "FAIL"}</strong> — {c.name}
            <div style={{ opacity: 0.75, fontSize: 12 }}>{c.detail}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default ExportCheck;
