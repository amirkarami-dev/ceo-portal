# Envelope ("env") Report — In-App Preview + Print-to-PDF

- **Date:** 2026-06-09
- **Status:** Approved (design); implementation pending
- **Owner:** web
- **Scope:** Opaque envelope only (`env_opaque.html`), v1

## Context & Goal

Each project has a saved Assessment (`InputJson`/`ResultJson`, system of record on the
backend; scoring engine in the frontend via `@mabhas19/assessment-core`). The legacy
mabhas19.ir site produces a detailed Persian/RTL "energy analysis" report per section.
We want, **per project, a per-section preview + PDF export**, starting with the **پوسته
خارجی غیرنورگذر** (opaque envelope) section, faithfully reproducing the uploaded sample.

## Decisions (from brainstorming)

1. **Export mechanism:** browser **print-to-PDF**. A dedicated in-app preview page renders
   the report as styled RTL HTML; an "خروجی PDF / چاپ" button calls `window.print()`.
   Preview is pixel-identical to the exported PDF. No backend work; works offline.
2. **Scope:** **opaque envelope only** — matches the sample. Windows (`env_trans`), other
   sections, and a server-archived PDF are explicitly out of scope for v1.
3. **Visual treatment:** **modern, on-brand, print-formal** — same information architecture
   as the sample, cleaned to match the app (emerald pass / red fail, refined type/spacing,
   color layer-bar preserved). The document is **light/white on screen even in dark mode**
   and in print.

## Architecture

All client-side; **no backend changes**.

### Routing & auth
- New route: `web/src/app/[locale]/reports/env/[projectId]/page.tsx` (`"use client"`).
- Placed **outside** the `(dashboard)` route group → renders **without the dashboard
  sidebar** (a clean document), but still wrapped by `[locale]/layout.tsx` providers
  (TanStack Query, Theme, next-intl).
- `middleware.ts` PROTECTED regex extended to include `reports` so the session-cookie
  presence gate still applies (real auth is the API JWT check on the data fetches).
- Entry point: a per-section export control on the project detail page
  (`project-detail-client.tsx`) — currently just the env entry, opened in a **new tab**.
  Structured so future sections slot in.

### Data flow
```
useProject(projectId)        ─┐
useAssessment(projectId)     ─┤→ parse InputJson["env_opaque.html"]
                              │→ buildEnvReport(project, details, climateCode)
                              │      (pure; recompute requiredR/totalR/pass via
                              │       assessment-core getOpaqueTargetR + labels;
                              │       group assemblies; assign W/R/F/D codes)
                              └→ EnvReportData → <EnvReportDocument data=…/>
```
`getAssessment` returns `null` on 404 (no saved assessment) → empty state.

### Data model (`EnvReportData`)
- `header`: title, subtitle (ویرایش ۵ … اقلیم {code}), client, totalArea, floorCount,
  unitCount, deed, parcel, systemId, usage, buildingGroup label, climateCode.
- `assemblies[]`: `{ code, targetKey, label, requiredR, totalR, pass, layers[] }`;
  `layers[]`: `{ index, category, material, manufacturer, thickness, density, lambda,
  rValue, standard }`.
- `summaryGroups[]`: `{ title, rows: { code, label, rValue }[] }` — grouped wall/roof/
  floor/door, codes auto-numbered within group (W1.., R1.., F1.., D1..).
- `bridge`: `{ south, north, east, west, mitigation, allDefined, highBridge }`.
- `shading`: `{ q1, q2 }`.
- `scores`: `{ insulation (/90), shading (/15), total, max: 105 }`; `allPass`; `empty`.

### Components (small, isolated)
- `web/src/features/assessment/report/buildEnvReport.ts` — pure builder + unit tests.
- `web/src/features/assessment/report/EnvReportDocument.tsx` — presentational root.
- Pieces: `ReportHeader`, `AssemblyCard`, `LayerBar`, `SummaryTables`, `ComplianceSummary`.
- Print CSS: `@page { size: A4 }`, fixed running header/footer (title + https://mabhas19.ir
  + page number), `break-inside: avoid` per assembly card, toolbar `print:hidden`.

## Report content (mirrors the sample)
1. **Header** — title + subtitle + identity grid.
2. **Per-جداره sections** — label + R موردنیاز / R محاسبه‌شده; layer table
   (ردیف/گروه/نام مصالح/تولیدکننده/ضخامت/چگالی/λ/R/استاندارد) + مجموع مقاومت row;
   proportional **color layer-bar** (width ∝ thickness, colored by category);
   ✔ تایید (R > Min) / ✘ footer.
3. **Summary tables (جدول ۱-۵-۱۹)** — grouped دیوار/سقف/کف/در with type codes.
4. **Compliance + thermal bridges + shading** — وضعیت انطباق جداره‌ها (تایید کامل if all
   pass), 4-direction پل حرارتی, عایق حرارتی (امتیاز /۹۰), بازتاب و سایه‌اندازی (/۱۵) + the
   two special-condition answers, مجموع امتیاز.
5. **Disclaimer** (سلب مسئولیت).

## Edge cases
- No saved assessment / no `env_opaque` analyses → empty state «ابتدا ارزیابی پوسته را
  تکمیل و ذخیره کنید» + back link.
- Fixed-R layers (no λ/thickness) render `-` for λ; layer-bar falls back to equal widths
  when thickness is missing.
- Malformed `InputJson` → treated as empty (parse guarded).

## i18n
- New keys only for chrome (button label, back, empty-state, generating). Report **body
  stays Persian** (regulatory artifact; material/assembly labels are Persian in
  assessment-core).

## Testing
- Vitest unit tests for `buildEnvReport` (R recompute, pass/fail, grouping, code
  assignment, empty input).
- Manual: `npm run build` + `npm run lint` clean; visual check of preview + print.

## File list
**New**
- `web/src/app/[locale]/reports/env/[projectId]/page.tsx`
- `web/src/features/assessment/report/buildEnvReport.ts` (+ `.test.ts`)
- `web/src/features/assessment/report/EnvReportDocument.tsx`
- `web/src/features/assessment/report/ReportHeader.tsx`
- `web/src/features/assessment/report/AssemblyCard.tsx`
- `web/src/features/assessment/report/LayerBar.tsx`
- `web/src/features/assessment/report/SummaryTables.tsx`
- `web/src/features/assessment/report/ComplianceSummary.tsx`

**Changed**
- `web/src/middleware.ts` (add `reports` to PROTECTED)
- `web/src/app/[locale]/(dashboard)/projects/[id]/project-detail-client.tsx` (export entry)
- `web/src/app/globals.css` (print/@page styles)
- `web/messages/fa.json`, `web/messages/en.json` (chrome keys)
