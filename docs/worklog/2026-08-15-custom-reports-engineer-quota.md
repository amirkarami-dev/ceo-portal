# Custom reports, and the first one: engineer quota by city and discipline

- **Date:** 2026-08-15
- **Area:** analytics
- **Branch / commits:** `feat/custom-reports` — `e32b110`…`0ec9a59`
- **Status:** merged to the branch, **not deployed** (the backend endpoint does not exist yet)

## Goal

*"i have big question for implement the new report"* — «وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و
رشته», driven by `[dbo].[F_ShowQuataInCity] @CityId, @Reshte` on KurdNezam, with a reference
screenshot. The question was whether to hand-code a page, let AI generate the report, or build a
"custom report / custom widget" capability.

Design: [`docs/design/2026-08-15-custom-reports-engineer-quota.md`](../design/2026-08-15-custom-reports-engineer-quota.md),
built in eight steps.

## The answer to the question

**It cannot be an ordinary report, and no AI could make it one.** Three structural reasons:
`SqlQueryEngine` builds `SELECT … FROM [table] … GROUP BY …` and never calls a stored procedure; the
proc returns one wide row with its dimension in the *column names*, so there is nothing to group by;
and `@CityId`/`@Reshte` are procedure parameters, not column filters. Ask AI emits `ReportDefinition`s
for that same engine, so it can only ever produce what the engine already expresses.

So: a registered **custom report**, dispatched through the existing report shell on a new
`library: "custom"` — not a parallel `/reports/custom/:id` world, which would make the library
listing, favourites, permissions, export, the widget picker and the breadcrumb each learn that there
are two kinds of report.

## What changed

- `presentation/custom/registry.ts` — the contract, the registry, `isCustomDefinition`, `EMPTY_RESULT`.
- `presentation/custom/CustomRenderer.tsx` + `CustomReportParams.tsx` — dispatch, and a generic
  picker bar driven by each entry's declared `ParamSpec[]`.
- `presentation/custom/engineer-quota/` — `contract` (wire shape, city/discipline lists), `fetch`
  (mock row + the real-mode call), `quota` (the arithmetic), `QuotaDonut`, `EngineerQuotaReport`,
  `index` (registration only).
- `contracts/presentation.ts` — `ViewLibrary` gains `"custom"`.
- `ReportView.tsx`, `ReportViewer.tsx`, `WidgetFrame.tsx` — the exemptions.
- `presentation/format.ts` — `currentDir` moved here from `EChartsRenderer`.
- `api/seed.ts` — the report, and a dashboard widget for it.

## Root cause notes (things that bit)

**The design said "one branch in `ReportViewer`". There were four**, each failing differently: the
execute effect (predicted), the render guard where `!semantic` is checked a *second* time far from
the first (an error screen), `result.total === 0` (an empty state that looked like working software),
and `FilterBar`, which needs a semantic model a custom report has not got. Only the first was found
by reading.

Writing that down paid for itself: **`WidgetFrame` was five**, and because the note said to expect it,
the file was mapped before being touched. The one reading nearly missed: a **disabled** react-query
reports `isLoading` forever, so the card would have spun permanently.

**The quota table clipped two columns on a phone** and I shipped it that way for one commit. With no
`scroll.x` the table is 394px in a 287px box with `overflow: visible` everywhere — ~107px unreachable,
in RTL «ظرفیت باقی‌مانده» and «ظرفیت کل». My check passed because the *page* did not scroll sideways,
which I read as "the table scrolls inside its wrapper". Nothing scrolled. Then `max-content` fixed the
phone and broke the desktop. A numeric `scroll.x: 640` does both.

**The donut colours were backwards.** Taking `series[0]`/`series[1]` in data order put orange on the
majority of every ring, so a base with 12% consumed looked alarming. Remaining is the brand colour;
consumed is the accent.

## Decisions

- **Parameters live in `view.options`, not `view.mapping`.** `ViewMapping` is a fixed set of named
  chart bindings with no index signature; widening it would weaken every chart's typing for one report.
- **An unknown `component` renders an empty state, not a fallback chart.** `chartKind` defaults an
  unknown *chart* to a bar because there is a sensible chart to fall back to; here there is nothing,
  and a silent fallback would hide a deleted registry id behind a plausible screen.
- **The picker uses a draft and an explicit «نمایش».** Each apply is a stored-procedure call; live
  selects would fire one query per dropdown touched and discard all but the last.
- **The donuts are `aria-hidden` and the table is their text alternative** — every number in a ring is
  a column above. That holds *only because this report shows both*; a future custom report without a
  table needs its own alternative, and the design doc says so.
- **No export on a custom report.** CSV, Excel and PDF all serialise a `QueryResult`; there is none,
  so all three would hand over an empty file that looks like a successful export.
- **The registry stores erased types with one cast** inside `registerCustomReport`, rather than `any`
  at three lookups. React props are contravariant, so the cast is not a formality.

## Verification

**718 tests across 88 files** (606 at the start of the day's work), lint, typecheck and build clean.
Every behavioural decision above bites when reverted — the field mapping, the clamp, the draft, the
colour assignment, the `aria-hidden`, both `WidgetFrame` exemptions, and the grid guard.

In a browser, RTL and LTR, light and dark, desktop and 375px: the report renders with the fixture
values exactly, the picker applies only on «نمایش», the donuts mirror and reorder, and the
accessibility tree carries the whole table and **no chart nodes**. Same again inside a dashboard
widget.

**Not verified:** anything against the real procedure. The whole feature runs on the supplied mock row
and **nothing is deployed** — the endpoint does not exist. Also not verified: no screen-reader test,
and no drag-to-persist on the dashboard.

## Follow-ups

- **The .NET endpoint.** `POST /api/Reports/custom/engineer-quota { cityId, reshte }` returning the
  twelve numbers, contract pinned in the design doc. Nothing ships until it exists.
- **Base titles stay Persian in English mode** — «پایه ارشد» beside translated headers. They sit with
  city and discipline names that are Persian-only data, but writing "Senior level" would be guessing
  at the engineering order's terminology. Raised rather than invented.
- **Export on custom reports** is deliberately absent, not designed. If a custom report should export,
  the registry entry needs a way to describe what.
- **`"grid"` is still a dead `ViewLibrary` member**, now beside a live `"custom"`.
