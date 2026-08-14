# Every chart moved from recharts to ECharts

- **Date:** 2026-08-14
- **Area:** analytics
- **Branch / commits:** `feat/echarts-only` — `5cb4abf`…`1d241c2` plus the step-10 sweep
- **Status:** merged to the branch, not deployed

## Goal

Started as a question, not a task: *"in library for chart that used in this project are have set
template for color or must set hardcode palette?"* — asked while finishing the blue-palette change.

The answer was that recharts has **no theme system at all** (every colour is a per-element prop) and
**no RTL support**, while ECharts takes a theme object at `init`. The app was running both. The
decision was *"do recommended note: if you agree use only EChart"*, and the work became a ten-step
migration written up in [`docs/design/2026-08-14-recharts-to-echarts.md`](../design/2026-08-14-recharts-to-echarts.md),
executed one "start step N" at a time.

## What changed

Per-step detail lives in the design doc's memos. The shape of it:

- `components/charts/useEChart.ts` — **every chart in the app goes through here now.**
  `echarts-for-react` was dropped: its two-phase init never completes in jsdom, so a real chart could
  not be tested at all. Three effects (init/dispose on theme, `setOption` on option, handlers in a
  ref), plus a ResizeObserver and a `document.fonts.ready` redraw.
- `presentation/renderers/EChartsRenderer.tsx` — bar, line, area, pie and heatmap. The donut's total
  and key are markup this component owns, not library output.
- `presentation/renderers/RechartsRenderer.tsx` — **deleted**, with the package.
- `presentation/renderers/drill.ts` — drill by category **value**, not by index.
- `presentation/format.ts` — `formatPercent`, and a bidi isolate around negative numbers.
- `presentation/chart-rtl.ts` — `pieSweep` returns `clockwise`, not recharts' `endAngle`.
- `presentation/view-switching.ts` — `targetOfView` + `NO_TARGET`, replacing three substring ladders.
- `presentation/auto-viz.ts` — rules 2/3/4 route to ECharts; rule 5 rewritten (see below).
- `admin/system/*`, both locale files — the `advancedECharts` flag removed.

## Root cause (the bugs found along the way)

Four were live in production code and **none had a failing test**:

1. **Drill-down opened the wrong report.** Both renderers looked up `groups[clickedIndex]`, but rows
   are sorted and sliced after `groupNodes` is built, so the two lists are not parallel.
   `ai/rules.ts` adds a sort to nearly every Ask-AI report, making this the common case, not the edge
   one. Fixed by matching on the category value.

2. **The matrix rule drew all-zero bars.** `auto-viz` rule 5 emitted `component: "EChart"` with the
   second **dimension** in `mapping.y`, and `seriesKeysOf` prefers `y` over `measure` — so the chart
   plotted a string column, `Number("Tehran")` became NaN, and ECharts drew zero. Measured off a live
   instance: `series: [{ type: "bar", name: "Province", data: [0, 0] }]`. The heatmap it was reaching
   for was **unreachable**: the renderer needs `mapping.series` and `component === "heatmap"`, and the
   rule set neither.

3. **A moved ref left the donut blank.** `useEChart` returned a `useRef` object; `ref.current` is read
   once inside the init effect, whose deps never notice the ref pointing at a *different* element. The
   donut nests its chart one level deeper than every other view, so switching to it moved the ref
   while the component stayed mounted — the instance stayed bound to the node React had repurposed as
   the flex row. Empty rectangle, no error. Fixed with a callback ref, making the element a dependency.

4. **The legend line reordered in English.** «تهران — 36.97٪» mixes an RTL name and an LTR number with
   a bidi-neutral dash: the share jumped to the front and the percent sign came off its number. Fixed
   with one `<bdi>` per part. The sign itself was U+066A unconditionally, in English too.

Why they all survived review: **the tests asked what a function returned, not what it drew.** Every
one of these was found by rendering to a live ECharts instance and reading `getOption()`, or by
looking at the screen.

## Decisions

- **`echarts-for-react` dropped rather than configured.** It cannot complete an init in jsdom, so
  keeping it meant asserting against a mock — and a mock accepts options ECharts rejects, renames or
  normalises away.
- **`case "recharts":` stays in the dispatcher, forever.** Saved definitions carry it and nothing
  migrates them. Proven in a browser: remove it and a stored chart renders as a table, silently.
- **Component strings never renamed.** `"BarChart"`, `"LineChart"`, `"PieChart"` are the identity key
  the switcher matches on. Renaming them breaks it with nothing to type-check the break.
- **Area kept** though nothing emits it — six lines of insurance against a stored definition that
  names it, which only the database can rule out.
- **`advancedECharts` deleted, not renamed.** Nothing read it, and once every chart is ECharts its
  label promised control over a distinction that no longer exists. `dashboardSharing` and
  `exportFormats` are equally unread but their labels do not lie — left alone deliberately.
- **A view with no button shows no button pressed.** `targetOfView` returns undefined for a heatmap,
  and `NO_TARGET` is passed to Segmented because antd reads `undefined` as "the first option".

## Verification

**658 tests across 84 files** (was 606 at the start), lint, typecheck and build clean.
Bundle **3,613 kB → 3,171 kB** (gzip 1,128 → 1,010) — the proof recharts left the bundle.

Seen in a browser, on `localhost:5273`, in **both directions and both themes**: bar, line, donut,
heatmap, table and KPI; Ask AI; a dashboard; the switcher round-tripping; 375px mobile with no
horizontal overflow. Dark-mode contrast on `#0b0f14`: donut total and legend 16.37:1, sub-label
7.13:1.

Fixes were bite-checked by reverting them — the verbatim `pieSweep` port reports `clockwise: true` in
RTL; the pre-fix `useRef` hook fails exactly the two new tests and passes the other sixteen; the old
rule 5 fails three of the four matrix tests.

**Not verified:** the drill hit area, axis-label rotation above 8 categories, the dataZoom slider
above 25 categories, and PDF chart export — all four need richer seed data or production. PDF export
matters most now because step 9 changed its SVG fallback selector.
**Not deployed.** Everything above is `localhost` against mock data; there is no backend locally
(system settings and seeded reports live in `localStorage`).

## Follow-ups

- **Canvas accessibility, open decision.** ECharts paints axis labels and legends onto a canvas, so
  they left the accessibility tree: on `main` the dashboard's tick labels were in `innerText`, on this
  branch they are gone. Two options — enable ECharts' `aria` with translated templates (summary level
  only), or render a visually-hidden table per chart. Not started.
- **Merge and deploy the branch.**
- **Pre-existing, unrelated:** a dashboard widget renders 133×40 though its layout says `w:6 h:4`.
  Confirmed byte-identical on `main`, so not caused by this work. Worth its own task.
- **`dashboardSharing` and `exportFormats`** are toggles nothing reads. Decide whether to implement or
  remove them.
- **Ask-AI's `motion.div` key** still sniffs the component string raw; it is cosmetic (animation
  identity) rather than behavioural, so it was left.
