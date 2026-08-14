# Charts were invisible to a screen reader; each one now carries its data as a table

- **Date:** 2026-08-15
- **Area:** analytics
- **Branch / commits:** `main`
- **Status:** merged, deployment pending

## Goal

The follow-up left open by the recharts→ECharts migration
([`2026-08-14-recharts-to-echarts.md`](2026-08-14-recharts-to-echarts.md)): *"now do the
accessibility fix"*. ECharts paints axis labels, legends and values onto a **canvas**, so moving off
recharts' SVG took all of that out of the DOM.

## What changed

- `presentation/renderers/EChartsRenderer.tsx` — a new `ChartDataTable`, rendered visually hidden
  beside every chart, plus `A11yTable` models built inside the option memo (`rwTable`, following the
  file's existing `rwCategories`/`rwKind` idiom). The chart container is now `aria-hidden`.
- `i18n/locales/{fa,en}.json` — a `chartA11y` group: caption, category, value, share.

## Root cause

Not a regression introduced carelessly — a known consequence of the canvas move, measured rather
than assumed. `read_page` on `/reports/rep-revenue` before the fix: the accessibility tree ended at
the last toolbar button (`ref_100`) and **the chart was absent entirely**. Not an unlabelled image,
which a screen reader at least announces as "image" — nothing at all. The page's whole point was
missing, a WCAG 1.1.1 failure.

## Decisions

- **A data table, not ECharts' `aria` option.** `aria: { enabled: true }` puts `role="img"` and a
  generated sentence on the container, built from **English** templates ("the chart type is bar, and
  the data is —"), so every template would need translating into Persian before it said anything.
  Even then it is a summary. A table is the data, navigable cell by cell, and it reuses the
  formatters the visible UI already uses — Persian digits, the Jalali calendar and «٪» come free and
  cannot drift from what is drawn.
- **Built inside the option memo, from the same local variables the series are built from.** Not
  recomputed from the rows. A second derivation is a second chance to disagree, which is precisely
  the class of bug this migration kept producing.
- **The canvas is `aria-hidden`.** It has nothing to read; announcing an empty region is noise.
- **The donut's visible key is `aria-hidden` too.** It carries name and share; the table carries
  name, value **and** share. Two partial announcements of the same slices is worse than one complete
  one. The key stays visible on screen — hidden from assistive tech only.
- **Heatmap cells with no matching row stay blank, not zero.** The chart paints nothing there, and
  "no data" and "zero" are different claims to make to someone who cannot see the gap.

## Verification

**666 tests across 84 files** (was 658), lint, typecheck, build clean. Eight new tests; removing the
table fails seven of them.

Read back from a real browser, which is the only place the accessibility tree exists:

| chart | what a screen reader now gets |
|---|---|
| bar | `table` with caption «داده‌های نمودار: درآمد ماهانه به تفکیک استان», headers «استان»/«مجموع درآمد», four provinces with «۵٬۵۶۳٬۰۰۰٬۰۰۰»-style values |
| donut | name, value and share per slice — «تهران / ۵٬۵۶۳٬۰۰۰٬۰۰۰ / ۳۶.۹۷٪» |
| heatmap | the full matrix, Jalali month headers («۱۴۰۳/۱۰» …) across, provinces down |

`read_page` now ends at `table [ref_101]` where it previously ended at `ref_100`.

**One real defect found while verifying:** `.sr-only` pins width to 1px and a `<table>` ignores it —
the table layout algorithm treats `width` as a floor, so the bare table measured **251×149** and sat
absolutely positioned over the page. It painted nothing and took no clicks (`clip-path: inset(50%)`
clips hit-testing too), so it was invisible in both senses, but a 251px box parked over the layout is
one stacking-context change from being a real bug. Wrapped in a `<div className="sr-only">`; measured
1×1 after. No horizontal overflow at 375px.

**Not verified:** no test with an actual screen reader (NVDA/VoiceOver). The tree structure and the
text are confirmed; how a specific reader announces a table caption is not.

## Follow-ups

- **Keyboard drill-down is still not possible.** Bars drill on a canvas click; there is no keyboard
  path to it, and this change does not add one — the table is read-only. That was already true before
  today, so it is a gap, not a regression.
- Deploy to `analytic.myceo.ir`.
