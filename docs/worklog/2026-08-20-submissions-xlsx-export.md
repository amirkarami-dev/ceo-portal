# Submissions export: Excel, and every row the filter matches

- **Date:** 2026-08-20
- **Area:** landing-panel
- **Branch / commits:** `feat/submissions-xlsx-export` — `abef25b`
- **Status:** **live** at landing-panel.myceo.ir — the buttons have **not** been clicked by a human

## Goal

> «for now i want add the export to xlsx on the list landing-panel.myceo.ir/submissions?formId=8
> note: when export i want get all rows after filter but no only the rows on current page»

Two decisions were put to the user before any code: the sheet gets **one column per question**
(rather than repeating the CSV's single «پاسخ‌ها» blob), and the **existing CSV button is fixed
too**, so two buttons sitting next to each other cannot mean different things by "export".

## What changed

| File | What and why |
|---|---|
| `landing-panel/src/lib/submissionExport.ts` | New. The paging fetch, the sheet builder, and the CSV/XLSX writers. Pure parts kept separate from the download so they can be checked. |
| `landing-panel/src/pages/SubmissionsPage.tsx` | Two buttons («خروجی اکسل», «خروجی CSV»), both exporting the whole filter. The page-only CSV helpers are gone. |
| `landing-panel/src/pages/dev/ExportCheck.tsx` | New, **DEV only**. 15 checks over the real functions, printed on a page. |
| `landing-panel/src/app/router.tsx` | The `/dev/export-check` route, inside an `import.meta.env.DEV` block. |
| `landing-panel/package.json` | `xlsx@^0.18.5` — the version `analytics-web` already ships. |
| `landing-panel/src/components/ui/RichTextEditor.tsx` | Unrelated: removed a dead `export` that was failing lint for the whole app. See Decisions. |

## Root cause (what was actually wrong)

**The existing CSV button exported one page and looked like it exported everything.** It mapped
`rows` — the current page — and named the file `submissions-page-3.csv`. An administrator who had
paged through 400 registrations got the 20 on screen. Nothing warned them; the file opened fine.

**And the obvious fix would not have worked.** `GetKurdnezamFormSubmissionsQueryHandler` does
`Math.Clamp(request.PageSize, 1, 100)` — **silently**. Asking for `pageSize=10000` returns 100 rows
and a `total` saying there are more, so a one-shot "just fetch everything" request would have
exported the first hundred and still looked complete. The export therefore pages.

## Decisions

- **Columns are keyed by `fieldId`, headed by the field's CURRENT label.** Answers store
  `fieldLabel` as a snapshot of how the label read when they were sent (deliberate — see
  `GOTCHAS.md`, "A `FieldId` that points at user-editable metadata should not be a foreign key").
  Keying columns by that label would split one renamed question into two columns.
- **A field the form no longer has still gets a column**, under its snapshot label. Deleting a form
  field does not delete answers already sent, so those answers exist and must still export.
- **File fields get no question column.** Their content is file names, and those all land in one
  «فایل‌ها» column; a question column for them would print an empty cell on every row.
- **Dedupe by id while paging.** Rows are ordered `Created DESC, Id DESC`, so a submission arriving
  mid-export shifts every later page by one and would otherwise repeat a row.
- **Stop on an empty page, not only on `total`.** A `total` that disagrees with the rows would
  otherwise loop forever. A separate `MAX_EXPORT_ROWS` cap reports itself to the user when it bites,
  rather than quietly truncating.
- **`xlsx@0.18.5` despite two open advisories, and the reason matters.** Both (prototype pollution,
  ReDoS) are in SheetJS's **parsing** path. This code only ever writes, `analytics-web` already
  ships the same version, and adding a second spreadsheet library for a write-only use would buy
  nothing. The constraint is written at the call site: **never call `XLSX.read` in this app.**
- **The dead `export` in `RichTextEditor.tsx` was removed rather than left.** `npm run lint` was
  failing for the whole app before this task — the same shape as walfare-web's `no-redeclare`
  failure recorded on 2026-08-19. `looksLikeHtml` is used only inside its own file, so dropping one
  keyword fixed it with no risk. Stated out loud rather than fixed silently, per START-HERE.

## Verification

- `npm run build` and `npm run lint` clean, exit 0 — lint newly so, see above.
- **15 checks at `/dev/export-check`, run in a browser, all pass.** The ones that matter:
  - **250 rows collected over 3 requests**, with pages of 100 — the user's actual requirement.
  - **No duplicates** across those pages.
  - A `total` of 99,999 against 120 real rows **stopped after 3 requests** instead of spinning.
  - Exactly one full page fetched **once**, not twice.
  - A renamed field's old answer lands in the right column; a deleted field's answer survives; file
    fields stay out of the question columns; two answers for one field are joined, not dropped.
  - The CSV still starts with the UTF-8 BOM, so Excel reads Persian rather than mojibake.
  - **SheetJS produced a 17,592-byte file with a valid zip signature** from a Persian sheet name
    containing a ZWNJ, with the RTL view and column widths set — all things it could have rejected
    at write time, which a download is an awkward place to discover.
- The dev check and its fixtures are **absent from the production bundle**, and SheetJS is in its
  own 420K chunk (`xlsx-*.js`) rather than the 2.0M main one, so nobody pays for it until they click.

**Not verified.**

- **Nobody has clicked either button in the real panel.** It sits behind the IdP and no password or
  OTP was entered at any point in this work. Everything above exercises the real functions with
  invented data; none of it proves the wiring on the actual screen.
- **The toolbar was not measured at 375px**, for the same reason. The new button joins an existing
  `<Space wrap>`, which is why the risk is low rather than zero.
- **No export has been run against real data**, so the real forms' question counts and any odd
  stored values are untested.

## Follow-ups

- Click both buttons on `?formId=8` and open the file. That is the only remaining unknown.
- The export is client-side, so a form with tens of thousands of submissions means that many
  requests of 100. If one ever gets that big, a server-side export endpoint is the answer, not a
  bigger `MAX_EXPORT_ROWS`.
- `landing-panel` still has no test runner, which is why the checks are a page rather than a suite.
