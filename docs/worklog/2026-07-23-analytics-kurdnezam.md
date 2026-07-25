# Analytics retargeted to KurdNezam + full dashboards

- **Date:** 2026-07-23
- **Area:** analytics
- **Branch / commits:** `feat/walfare-service` — `a5e3bab`, `bd31db8`, `2c62f49`, `6736cc1`,
  `9556624`, `aa5c76b`, `e595772`
- **Status:** shipped to production (merged to `main` in `20f96b3`)

## Goal
Point the reporting system at the real organisation warehouse instead of the old sample source,
show human labels instead of raw codes, fix the Persian/RTL presentation, and make the
dashboards page genuinely usable (drag, resize, table/chart, per-widget export).

## What changed
- **Semantic layer**: `KurdNezamSemanticModelStore` replaces the old store — two catalogues
  (`tblDW_OzviatInfo`, `tblDW_EngineerProjectInfo`) with a `Description` **and** a `ValueLabels`
  map per field (پایه, رشته, نوع شخصیت, نوع دفتر, …). Descriptions are fed into the AI prompt so
  the model knows what the codes mean; labels are applied **after** SQL, display-only, so filters
  still run on raw codes.
- **Presentation**: Jalali dates everywhere (DB Jalali strings pass through untouched; Gregorian
  values convert), themed chart tooltips (dark mode was white-on-white), and a computed y-axis
  width so RTL value labels stop being painted over by the bars.
- **Dashboards**: hero header, draggable + resizable widgets, per-widget chart/table toggle, and
  per-widget CSV / XLSX / PDF export. Widgets now run through the gated execute path, so they
  work against the **real** backend (they previously called the in-browser mock engine only).
- **Contract fix**: dashboard `layout` is an **array** of grid items; the API declared an object,
  so every create/save was rejected with a 400 — nobody, including admins, could make a
  dashboard. Save is now a real upsert instead of always inserting.

## Root causes worth remembering
- **Widgets would not drag**: `react-draggable` reads `process.env`, which does not exist in a
  browser — the drag-start handler threw silently. Shimmed at the app entry.
- **The y-axis "values were wrong"**: they were not; in RTL the tick labels were drawn into the
  plot area and the bars painted over them.
- Both are in `docs/ai/GOTCHAS.md`.

## Decisions
- **Decode labels server-side, after the query.** Keeps filtering/grouping on the real codes
  while the user sees «معماری» instead of `1`.
- **SheetJS loaded on demand** for XLSX so the main bundle does not carry ~400 KB.
- **PDF via a print document, not jsPDF** — jsPDF cannot shape Persian text correctly; the print
  window renders the chart image plus the data table with proper RTL.

## Verification
- 312 frontend tests pass; build and lint clean; backend unit tests run on the server.
- Live: `analytic.myceo.ir` returns 200 and the served bundle contains the new strings
  (checked explicitly, because a healthy container can still serve an old bundle).

## Follow-ups
- Engineer **names** in reports: only the membership code is available in the warehouse today;
  a joinable members table would be needed.
- Setting `KURDNEZAM_DB_CONN` woke the municipality sync worker, which fails on an expired
  remote certificate — unrelated to analytics; decide whether to disable it or renew the cert.
