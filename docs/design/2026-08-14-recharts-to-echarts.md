# Removing recharts: render every chart with ECharts

**Date:** 2026-08-14
**Area:** analytics-web
**Status:** **steps 1-5 done (2b included) — see the memos at the end.** Branch `feat/echarts-only`.
Waiting on "start step 6". Nothing is routed to ECharts yet.

Amir asked to use ECharts only. Agreed as the goal: recharts has no RTL support, which is the whole
reason `presentation/chart-rtl.ts` exists; ECharts has a real theme system; and dropping recharts
takes ~500KB out of a 3.6MB bundle. Not agreed as a same-day change, which is why this is a plan.

## How much of this is checked

The plan came out of a read-only audit (four parallel surveys, three critics, one synthesis): 125
things the migration must reproduce, 19 gaps. It was then put through a second, **adversarial** pass
whose only job was to confirm or refute its load-bearing claims — 23 verdicts, plus a critic whose
job was to find what the verification itself missed.

| | count |
| --- | --- |
| CONFIRMED | 15 |
| PARTLY-TRUE | 5 |
| REFUTED | 3 |
| critic findings against the verification | 5 |

Mechanical sweep of the plan's own references, done by hand: of 18 cited `file:line`, **15 exact**,
2 off by one line, 1 wrong folder (`ReportView.tsx` is in `presentation/`, not
`presentation/renderers/`). Line counts 335 / 175 exact. `auto-viz.test.ts:55/61/72`,
`contracts.test.ts:132` and `view-switching.test.ts:79/89` all exact.

**What is marked CONFIRMED below was checked.** The ~100 remaining line-level claims inside the step
descriptions were *not* individually re-verified — treat their file:line as leads, not facts.

---

## The live bug: positional drill-down, and a correction to what was first reported

**This is the most important thing in this document, and the first version of it was wrong.**

First reported as: *"EChartsRenderer drops null categories, and drill-down therefore targets the
wrong report — with 3 groups and 2 bars, clicking the second bar opens the third group."*

Half of that holds. Corrected, and proved by running it:

### Half one — null categories are dropped. CONFIRMED, and ECharts-only.

| path | categories produced |
| --- | --- |
| recharts (`aggregateByCategory`) | `["Tehran", null, "Fars"]` — 3 bars |
| **ECharts (`uniq`)** | `["Tehran", "Fars"]` — **2 bars, one value silently gone** |

`uniq()` at `EChartsRenderer.tsx:30` does `if (v === null) continue`; `aggregateByCategory` keeps the
bucket via `row[categoryKey] ?? null`, and `formatCategory(null)` renders it as a blank tick. The
engine deliberately buckets nulls and pins the behaviour (`engine.edge.test.ts:69`).

### Half two — drill-down. Bigger than reported, and not what was said.

Three corrections:

1. **The arithmetic was wrong.** Groups are `[Tehran, null, Fars]` and bars are `[Tehran, Fars]`, so
   clicking the second bar opens `groups[1]` — the **null** group, the second one. `groups[2]`
   (Fars) becomes unreachable. Not "the third group".
2. **It is not caused by the null drop, and it is not ECharts-specific.**
   `RechartsRenderer.tsx:121` does the identical `result.groups?.[index]`. **The shipped recharts
   path — what almost every chart in the app uses today — has the same bug.**
3. **A plain sort is enough to break it, with no nulls anywhere.** `groupNodes.push` happens during
   collection (`engine.ts:576-580`); rows are sorted at `engine.ts:585` and sliced at `:588-589`,
   while `groupNodes` is never re-ordered or sliced. `ai/rules.ts:118-126` adds a sort to
   essentially every Ask-AI report.

Proved against the real engine — three provinces, no nulls, one `desc` sort:

```
  bars drawn (rows order): ["Fars","Yazd","Tehran"]
  groups[] order         : ["Tehran","Fars","Yazd"]
   click bar 0 "Fars"   -> groups[0] = "Tehran"  <= WRONG REPORT
   click bar 1 "Yazd"   -> groups[1] = "Fars"    <= WRONG REPORT
   click bar 2 "Tehran" -> groups[2] = "Yazd"    <= WRONG REPORT
```

**Every bar drills into the wrong report.** Reachable through `ReportViewer.tsx:272` and
`AskAiBuilder.tsx:209`, which pass `onDrill` down. Dashboard widgets do not pass it
(`WidgetFrame.tsx:207`), so they are unaffected.

Drill-down has **zero test coverage** — no test anywhere passes `onDrill` to a renderer.

**This is not really migration work.** It is a shipped, library-independent defect that resolving the
group by category *value* instead of by index would close today, in both renderers. It sits at step 3
below only because that is where the plan put it.

---

## Verdicts on the plan's load-bearing claims

### Corrections that change what a step must do

**1. The jsdom canvas stub is necessary but NOT sufficient.** *(PARTLY-TRUE)*
With the stub alone you still get one `[ECharts] Can't get DOM width or height` warning per chart,
because `EChartsRenderer.tsx:123/174` sizes with `width: "100%"` and jsdom reports `clientWidth` as
0. Measured: stub **plus** an explicit `opts={{width,height}}` gives **0 errors, 0 warnings**. So
step 2 must also stub `clientWidth`/`clientHeight`, or pass explicit sizes, or accept one warning
per chart.

**2. The SVG renderer's console noise is a one-off, not per chart.** *(PARTLY-TRUE)*
zrender caches text measurement per (text, font). Measured: first chart 11 errors, a second
identical chart **0**, a third with different Persian labels 8. Two further corrections: each
occurrence prints a ~11-line jsdom stack, so real stderr is 100+ lines rather than 12; and **SVG
renderer + canvas stub together measured 0 errors and 0 warnings**. The plan's "SVG is noisy"
argument does not survive — if SVG is chosen, the stub removes the noise.

**3. SVG output has NO class names and NO `data-*` attributes. At all.** *(REFUTED — worse than the plan said)*
The complete attribute vocabulary of a rendered chart is `baseProfile, d, dominant-baseline, fill,
fill-opacity, height, stroke, stroke-linecap, stroke-width, style, text-anchor, transform, version,
width, x, xmlns, xmlns:xlink, y`. No `class`, no `id`, no `data-*`, no `viewBox`.
What *is* assertable: `<text>` textContent (verified localized —
`["0","200","400","600","800","1,000","1,200","الف","ب","ج","درآمد"]`), tag counts, and geometry
attributes. Every `.recharts-bar-rectangle` / `.recharts-pie-sector` / `.recharts-line` selector must
be **rewritten, not translated**.

**4. PDF chart export is narrower than anyone thought, and untested.** *(PARTLY-TRUE + REFUTED)*
- Only **dashboard widgets** ever export a chart image. `WidgetFrame.tsx:151` is the sole call site
  that passes a chart root. `features/export/index.tsx:49` passes none — and that is the menu used by
  **ReportViewer** (`:210`) and **Ask-AI** (`:157`). Those PDFs have *never* contained a chart.
- **Zero test coverage.** If `chartSnapshot` returned null for every chart, `npm test` would stay
  fully green. Only a human exporting a widget PDF would notice.
- **A new defect found in passing:** `echarts-theme.ts:39` sets `backgroundColor: "transparent"`, so
  the canvas snapshot is a transparent PNG. In **dark mode its light axis text prints onto the white
  PDF page** and is unreadable. Live today, from the theme shipped this morning.
- Critic's warning: if SVG is ever chosen, `pdf.ts:19` must change **in the same step**, not deferred
  to step 9 — after step 8 the blast radius is total, not narrow.

**5. The `notMerge` rebuild is our own doing, and one of its three consequences is false.** *(PARTLY-TRUE)*
`echarts-for-react` compares props with `fast-deep-equal` (CONFIRMED) and fresh closures do make it
false on every render (CONFIRMED). But the destructive rebuild comes from **our own `notMerge`
prop** — out of the box the library does a merge `setOption`, which `echarts.js:381` skips. Of the
three claimed consequences: dataZoom reset **real**; tooltip loss **real and worse than stated** (the
DOM node is destroyed, so it vanishes mid-hover rather than flickering); animation restart
**REFUTED** — echarts deliberately reuses views across `notMerge`.

**6. The freshly-built `theme` object is harmless.** *(REFUTED — a worry the plan raised needlessly)*
`echartsTheme(mode)` returns a function-free literal, so `fast-deep-equal` returns true for two calls
with the same mode. It does **not** trigger the dispose-and-recreate path at `core.js:39`. Only the
closures matter.

**7. `pieSweep` — the dangerous path is KEEPING it, not deleting it.** *(critic, PARTLY-TRUE)*
The confirmed finding — that deleting the call is invisible to every test — points an implementer at
the safe-looking wrong choice. A verbatim port of `startAngle`/`endAngle` onto an ECharts pie is
**bit-identical to passing nothing**, in both directions, while `chart-rtl.test.ts` keeps passing.
ECharts wants `clockwise: dir !== "rtl"`. Still the highest silent-failure risk in the plan.

**8. Prefer a real mount over asserting what you handed to a mock.** *(critic)*
A `vi.mock("echarts-for-react")` capture cannot catch an option ECharts rejects, renames or
normalises away. `echarts.getInstanceByDom(el).getOption()` on a real mount can, and is stronger than
both the mock and the old recharts DOM counts.

**9. Step 2's acceptance criterion is nondeterministic as written.** *(critic)*
"Zero unhandled rejections" is not a pass/fail a partially-effective stub can satisfy reliably:
errors landing off a `requestAnimationFrame` after a file completes surface in whichever file runs
next, giving intermittently green CI and unbisectable blame.

### Confirmed exactly as written

- Un-mocked ECharts in this jsdom fails with the `dpr` **unhandled rejection**.
- zrender emits **zero** `<tspan>` ever, so `RechartsRenderer.test.tsx:151` becomes a vacuously green
  assertion under ECharts. Delete it, do not port it.
- The SVG renderer **would** silently break the PDF chart image.
- Only PDF touches chart DOM — CSV / Excel / JSON do not.
- **`advancedECharts` is read by nothing.** A user-visible admin toggle («ECharts پیشرفته») wired
  through six places and consumed by none.
- **The heatmap is unreachable from auto-viz.** Rule 5 emits `component: "EChart"` without
  `mapping.series`; the heatmap branch needs both. Every matrix report renders as a single-series bar
  with a dimension dropped.
- **No producer emits an area chart** — confirmed independently: `SwitchTarget` is
  `ViewType | "bar" | "line" | "pie"`, `CHART_SUBTYPES` has only those three, and the only
  `AreaChart` reference is the branch inside `RechartsRenderer` itself.
- ECharts' tooltip hard-codes `float:right` on the value and `margin-left:2px` on the name, and
  **neither is overridable** through `tooltip.textStyle.align`. A custom formatter is mandatory for
  RTL.

---

## Worth doing before, or independently of, the migration

Live defects, not migration work. None of them needs recharts removed first:

1. **Positional drill-down** — every bar on a sorted report opens the wrong one, in *both* renderers.
   The biggest and most reachable of these.
2. **Null categories dropped** by `EChartsRenderer.uniq()`.
3. **Dark-mode PDF chart** — transparent PNG, light text, white page.
4. **`advancedECharts`** — delete the toggle or make it mean something.
5. **The unreachable heatmap** — auto-viz rule 5 never sets `mapping.series`.

---

## The plan itself, step by step

*Everything from here down is the audit's original output, kept as written. Where the verdicts above
contradict it, **the verdicts win** — they were measured, this was reasoned.*

## Where this starts from

Commit `6b6a56f` already landed the foundation the earlier audit said was missing. Confirmed in the working tree today:

- `C:/Projects/ceo-portal/analytics-web/src/theme/echarts-theme.ts` exists and is real (84 lines: palette, transparent background, `textStyle.fontFamily`, title/legend/tooltip surfaces, all four axis types, grid, a brand-blue `visualMap.inRange` ramp, dataZoom styling).
- `C:/Projects/ceo-portal/analytics-web/src/components/charts/useEChart.ts` is a shared init/resize/dispose hook that passes `echartsTheme(themeMode)` into `echarts.init` and re-inits on mode change. The two admin charts are on it.
- `EChartsRenderer.tsx` passes `theme={echartsTheme(themeMode)}` as an object prop (not a registered name), so the register-before-init hazard does not apply.

So steps 0-2 of the older plan are done. What remains is the renderer itself. Four things are still true and are the whole job:

1. `EChartsRenderer.tsx` draws exactly two things: a heatmap and a bar. No line, no area, no pie.
2. Its data layer is wrong in ways recharts' is not (no aggregation, nulls dropped, one measure only, raw series names).
3. Every chart producer still writes `library: "recharts"` (`auto-viz.ts`, `view-switching.ts`).
4. `recharts@^2.13.0` is in `analytics-web/package.json:33`.

---

## The canvas-vs-SVG decision — decide this first, it shapes every test below

> **The table in this section is superseded — read verdicts 1, 2 and 3 above first.** Measured
> afterwards: the noise is a one-off per distinct text, not per chart; the canvas stub alone still
> warns unless the chart also gets an explicit size; and SVG **plus** the stub measured 0 errors and
> 0 warnings, which removes this section's main argument against SVG. What survives intact is the
> PDF consequence: SVG breaks the chart image, and `pdf.ts:19` would have to change in the same step.

**Recommendation: keep the default canvas renderer in production, and stub `HTMLCanvasElement.prototype.getContext` in `C:/Projects/ceo-portal/analytics-web/vitest.setup.ts`.**

Measured, not assumed (echarts 5.6.0 + echarts-for-react 3.0.6 + jsdom 25 from this repo's own `node_modules`, no `canvas` package installed):

| Option | Mounts in jsdom | Console noise | PDF export | DOM you can assert on |
|---|---|---|---|---|
| Canvas, no stub | No — unhandled **rejection** `Cannot set properties of null (setting 'dpr')` from the second `init` inside echarts-for-react's `finished` handler | ~54 error lines | works | none |
| Canvas + `getContext` stub in `vitest.setup.ts` | Yes, clean | zero | works (`canvas.toDataURL`, `features/export/pdf.ts:11`) | none |
| `opts={{ renderer: "svg" }}` | Yes | ~12 lines per chart (zrender measures text through a canvas regardless of renderer) | **silently breaks** — no canvas, and no `.recharts-surface` class either | `<path>`/`<text>` only, no classes, no `data-*`, no `<tspan>` |

Three consequences worth stating plainly:

- Without a stub, the failure is an **unhandled rejection**, which Vitest reports at run level and attributes to the wrong file. The ~25 integration tests in `WidgetFrame`, `ReportViewer`, `AskAiBuilder` and `Dashboard*` would fail pointing somewhere else. This must be fixed before any chart moves.
- The `svg` renderer is tempting for testability and is the wrong trade: it costs the PDF chart image with no failing test, and the DOM it gives you has no semantic hooks anyway.
- Therefore **all chart assertions become option-shape assertions**, following the `vi.mock("echarts-for-react")` capture already in `EChartsRenderer.test.tsx:5-10`. That is strictly stronger than counting `.recharts-bar-rectangle` nodes — you can assert aggregation, axis inversion and formatter wiring, none of which the DOM tests could see.

One assertion deserves a warning: `RechartsRenderer.test.tsx:151` checks `svg text tspan` is 0. zrender's SVG backend emits **zero** `<tspan>` elements, ever (grepped). Under ECharts that check becomes vacuously true and guards nothing while still looking green. Delete it, don't port it.

**Accessibility is a real cost of canvas and there is no free fix.** Today axis ticks are SVG `<text>` and the bar/line legend is an HTML `<ul>` — selectable, find-in-page-able, in the accessibility tree. Canvas removes all of it. `aria: { enabled: true }` produces one generated summary string, which is a partial mitigation, not parity. Given this repo tests WCAG ratios in `tokens.test.ts:41-93`, treat this as a decision the owner makes in step 1, not a detail.

---

## Step 1 — Throwaway spike: answer the seven unknowns before committing

**What changes:** nothing that ships. A scratch branch (or scratchpad scripts) that renders each question and gets a yes/no. Delete the branch when done. Output is a short decision memo appended to the design doc.

**Questions, in order of how much they change the plan:**

1. **RTL tooltip word order.** ECharts wraps the value with a hard-coded `float:right` (`echarts/lib/component/tooltip/tooltipMarkup.js:235-245`) and the name with `margin-left:2px` — both physical, neither overridable by `textStyle.align`. In an RTL block the tooltip likely reads «۶٬۵۵۰    عادی تعداد» (value first) where recharts reads «عادی تعداد : ۶٬۵۵۰». `docs/design/2026-08-13-analytics-charts-rtl.md:95-96` lists the recharts ordering as measured-correct. If this reproduces, a custom `tooltip.formatter` is mandatory in step 4, and the existing `align === "right"` test is worthless.
2. **Font race.** Vazirmatn is an async webfont (`src/theme/global.css:1-3`), nothing in `src` touches `document.fonts`, and neither echarts nor zrender listens for font loading. Canvas text is rasterised once. Render a chart on a cold cache: does it stay in the fallback font permanently, and is `grid.containLabel` sized from fallback metrics? If yes, a `document.fonts.ready.then(() => chart.resize())` belongs in the shared seam.
3. **Negative numbers in RTL.** `formatNumber` groups via `Intl.NumberFormat("en-US")`, so a negative carries an ASCII hyphen-minus — a neutral that may paint on the wrong side («۱٬۲۳۴-»). Render negative values in RTL and look. The old `tick={{ style: { direction: "ltr" } }}` trick has no canvas counterpart, but it may also be defending against an SVG-only failure that cannot recur. Do not budget work for this until it is seen.
4. **Legend click.** ECharts defaults `selectedMode: true`. With one series (the common case from auto-viz rules 2 and 3) one legend click blanks the chart, and `notMerge` restores it on the next re-render. Decide: `selectedMode: false`, or keep it deliberately.
5. **Label collision below 9 categories.** `EChartsRenderer.tsx:164` forces `interval: 0` (show every label), the opposite of recharts' `preserveEnd` thinning. With long Persian labels («آذربایجان شرقی») in a narrow widget, do 6 categories overlap? Invisible in any option test.
6. **Accessibility.** Decide canvas + `aria` vs. something more. See above.
7. **Confirm two API details on 5.6.0:** pie `padAngle` (needs ≥5.5, `package.json` pins `^5.5.0` — a fresh install could resolve 5.5.x) and `emphasis: { scale: false }` stopping the hover grow.

**Proof it worked:** a written answer to each of the seven, with a screenshot for 1, 2, 3 and 5.

**Regression risk:** none — nothing ships. The risk is skipping it. Questions 1 and 2 are silent regressions across every chart at once, and neither surfaces in any test.

---

## Step 2 — Make ECharts mountable in jsdom

**What changes:** add a `HTMLCanvasElement.prototype.getContext` stub to `C:/Projects/ceo-portal/analytics-web/vitest.setup.ts` (which today has matchMedia, ResizeObserver, getComputedStyle and antd-jalali stubs, and no canvas stub). Add one smoke test that mounts the real `EChartsRenderer` — un-mocked — and asserts it does not throw.

**Proof it worked:** `npm test` green with zero "Not implemented: HTMLCanvasElement.prototype.getContext" lines and zero unhandled rejections. The new smoke test passes. Nothing else changes.

**Regression risk:** near zero. The stub only affects the test environment. Watch that the stub returns enough of a 2D context for zrender's `measureText` — return an object with `measureText: () => ({ width: 0 })` and no-op drawing methods rather than `null`.

**Why here:** without this, every later step's tests fail in a way that blames the wrong file. It also unblocks `WidgetFrame`/`ReportViewer`/`AskAiBuilder` mounting real charts once they stop being recharts.

---

## Step 3 — Fix EChartsRenderer's data layer (before anything is routed to it)

> **The five bullets stand; the framing does not.** "Drill by value, not position" is not an
> EChartsRenderer data-layer problem — `RechartsRenderer.tsx:121` has the identical positional
> lookup, and a plain sort breaks it with no nulls involved. See the live-bug section above, where it
> is proved. Fix it in a shared helper for both renderers, or state plainly that the recharts path
> stays broken until step 9 deletes it. Do not use this step's per-bar arithmetic as the acceptance
> criterion — it was wrong.

Today this only affects heatmaps and auto-viz rule-5 views, which are rare. That is exactly why it is cheap now and expensive later.

**What changes in `C:/Projects/ceo-portal/analytics-web/src/presentation/renderers/EChartsRenderer.tsx`:**

- **Aggregation.** Replace `rows.find(r => r[x] === xc)` (lines 135-148, takes the first match and discards the rest) with `aggregateByCategory` from `renderers/chart-utils.ts` (sums duplicates, first-seen order). Derive `xCats` from the aggregated rows, not from `uniq`.
- **Null categories.** `uniq()` at line 31 does `if (v === null) continue`, which deletes a whole bar and shifts every `dataIndex` after it. The engine deliberately emits null-keyed groups and pins it (`engine.edge.test.ts:69`). `aggregateByCategory` keeps the null bucket (`row[key] ?? null`) and `formatCategory(null)` renders an empty tick — that is the recharts behaviour and the correct one.
- **Multi-measure.** `mapping.y` is typed `string | string[]` (`contracts/presentation.ts:31`). Lines 59-63 collapse to one measure. Build `ys` the way `RechartsRenderer.tsx:44` does and emit one series per y key. Both meanings of "multiple series" (several measures vs. one measure split by `mapping.series`) now have to coexist.
- **Series names.** Line 132 does `name: String(sv)` — raw. Run it through `formatCategory`, so a chart split by month does not show «۱۴۰۴/۰۲» on the axis and `2025-05` in the legend on the same page.
- **Drill by value, not position.** `result.groups` is pushed in bucket-insertion order (`query/engine.ts:576`) and never re-ordered, while rows are sorted, offset and sliced afterwards (`engine.ts:585-591`). `src/ai/rules.ts:115-127` puts a sort on essentially every Ask-AI report, so positional `dataIndex → result.groups[i]` is wrong far more often than "when aggregation collapsed rows". Resolve the group by matching the clicked category **value** (`p.name`, or the raw category behind that index) instead.

**Proof it worked:** new option-capture tests — 4 rows over 2 distinct months produce `series[0].data` of the summed values (not just 2 entries); a result with a null dimension value keeps its category; `y: ["revenue","cost"]` produces `series.length === 2` with `useColumnLabel` names; a click at `dataIndex: 1` on a sorted result reaches the correct `GroupNode`. **Note that drill-down has zero test coverage today** — no test file anywhere passes `onDrill` to a chart renderer — so these are new tests, not rewrites.

**Regression risk:** heatmap and rule-5 bar numbers change on screen — that is the point, they were wrong. If any dashboard screenshot is used as a baseline, it moves. The drill change alters which report a click opens; that is a fix, but it is user-visible.

---

## Step 4 — RTL and interaction parity in EChartsRenderer

**What changes (same file):**

- Tooltip: custom `formatter` if step 1 confirmed the float-right reversal; `confine: true` so tooltips do not spill out of the `overflow: auto` widget body (`WidgetFrame.tsx:187`); keep `valueFormatter`.
- Legend: use `legendPlacement(dir).inline` from `presentation/chart-rtl.ts:28` instead of the inline `dir === "rtl" ? {right:8} : {left:8}` at line 67, and set `bottom: 0` (ECharts defaults to top-centre; recharts was bottom). Reserve room in `grid.bottom`. Apply the `selectedMode` decision from step 1.
- `visualMap.formatter` wired to `valueFormatter` — its min/max labels currently fall back to `toFixed`, i.e. ASCII digits on a Persian page.
- `axisLabel.interval` per the step 1 finding.
- **Memoize `valueFormatter`, the `axisLabel.formatter` and `onEvents` with `useCallback`/`useMemo`.** Measured: echarts-for-react gates updates on `fast-deep-equal` (`lib/core.js:50-53`), and fresh closures make it false every render, forcing a full `setOption(option, {notMerge:true})` — a complete model rebuild that resets the dataZoom slider, dismisses an open tooltip and restarts animations. Worst during a react-grid-layout drag and on AskAiBuilder's `AnimatePresence` remount.
- Font-ready `resize()` if step 1 confirmed the race — put it in the shared seam, not per chart.

**Proof it worked:** option tests for legend side/bottom, `tooltip.confine`, `tooltip.valueFormatter` existing (today only `yAxis.axisLabel.formatter` is asserted, at `EChartsRenderer.test.tsx:145`), and a rendered-twice-with-identical-props test asserting the captured option is deep-equal by `fast-deep-equal`. Plus a live RTL screenshot of a tooltip and a dashboard drag that keeps its dataZoom position.

**Regression risk:** the tooltip formatter is hand-written HTML — easy to get the multi-series axis tooltip wrong. Legend moving to the bottom shifts plot area height slightly on every existing ECharts chart.

---

## Step 5 — Teach EChartsRenderer the four chart kinds (nothing routed yet)

**What changes:** a `kind` switch inside `EChartsRenderer.tsx`, ported wholesale from `RechartsRenderer.tsx:90` including the alias table and the silent bar default. Add:

- **line** — `type: "line", smooth: true, smoothMonotone: "x", showSymbol: false`. Plain `smooth: true` is a different spline that overshoots; recharts used monotone.
- **area** — line plus `areaStyle: { opacity: 0.25 }`, overlaid, not stacked. **Decide explicitly whether area survives**: no producer in the app emits it (`SwitchTarget` has no `"area"`, auto-viz never emits it), it has no test, and it is reachable only from a hand-written or AI-authored view. Keeping it is ~6 lines; dropping it means those views fall through to bar.
- Bar parity: height **320**, not the current 360 (`EChartsRenderer.tsx:123,174`) — 360 changes every widget's chart height; `tooltip.trigger: "axis"` with `axisPointer: {type:"shadow"}` for bar and `{type:"line"}` for line/area; dashed splitLine on **both** axes (`lineStyle: { type: [3,3] }` — ECharts hides the category splitLine by default, and `type:"dashed"` is a different pattern than recharts' `3 3`).
- Gate `onEvents` on kind, so line and area keep today's behaviour of not drilling — unless that is a deliberate product change.

`valueAxisWidth` (`RechartsRenderer.tsx:57`) is **not** ported. `grid.containLabel: true` already does the job. That is the cleanest net deletion in this migration.

**Proof it worked:** option tests per kind, including `series[0].type`, `smoothMonotone`, `showSymbol`, the 320 height, and the aggregation/multi-measure tests from step 3 repeated for line and area. Note the existing "4 rows → 2 bars" guard covers **only** the bar branch — line, area and pie all call `aggregateByCategory` too and none has a duplicate-category test.

**Regression risk:** rule-5 views (currently drawn as bar) now honour `view.component`, so an "EChart"-named view still lands on bar via the default — verify that. Nothing else is routed here yet, so the blast radius is small.

---

## Step 6 — Move bar charts to ECharts

**What changes:** `auto-viz.ts:100` and `view-switching.ts:11` (`CHART_SUBTYPES.bar`) — `library: "recharts"` → `"echarts"`. **Keep `component: "BarChart"`.** The component string is the identity key in four separate places that all do case-insensitive substring sniffing: `findViewForTarget` (`view-switching.ts:17`), `ViewSwitcher.tsx:40`, `WidgetFrame.tsx:98`, and AskAiBuilder's `motion.div` key (`AskAiBuilder.tsx:196`). Renaming to `"bar"` breaks the switcher in ways nothing type-checks.

**Proof it worked:** update the three `toMatchObject({ library: "recharts" })` expectations in `auto-viz.test.ts:55/61/72`. Manually: a saved report with a bar view renders, drills, exports to PDF with a chart image, and switches to table and back with the right button highlighted. Check a dashboard widget for height and label rotation.

**Regression risk:** the biggest visible-change step. Labels rotate above 8 categories, a dataZoom slider appears above 25, the font changes if step 1's race is unresolved, and drill hit area shrinks from the whole column to the bar rectangle (`RechartsRenderer.tsx:316` was a chart-level `onClick`). Reverting is a one-word change in two files.

---

## Step 7 — Move line charts to ECharts

**What changes:** `auto-viz.ts:86` and `CHART_SUBTYPES.line`. Same shape as step 6.

**Proof it worked:** `auto-viz.test.ts:55` updated; a date-dimension report renders with Jalali x-axis labels in RTL. Add the RTL assertion that does not exist on either side today: `option.xAxis.data` carries «۱۴۰۴/۰۲» rather than `2025-05`. **`RechartsRenderer.test.tsx` never sets `document.documentElement.dir` — the entire recharts suite runs LTR**, so none of its RTL behaviour has renderer-level coverage to inherit.

**Regression risk:** monotone-vs-smooth overshoot on sparse series; `showSymbol: false` matching `dot={false}`.

---

## Step 8 — Move the donut to ECharts (the big one)

**The donut is not a chart, it is a layout.** `RechartsRenderer.tsx:125-254` is a flex row containing a 240×240 ring box, an absolutely-positioned `data-testid="donut-total"` HTML overlay, and a hand-written `data-testid="donut-legend"` `<ul>`. All three exist because of measured recharts defects: the side legend left ~300px of dead space, `Pie.cx` and SVG `<text x="%">` resolve against different boxes, and recharts painted legend text in the series colour at 2.54:1.

**What changes:** swap **only** the inner `<ResponsiveContainer><PieChart>` for a `<ReactECharts>` of the same 240×240 box. Keep the flex row, the overlay and the `<ul>` exactly as they are — five tests then pass verbatim, and `formatFitted`'s character-count fitting survives.

ECharts config: `radius: [68, 110]`, `center: ["50%","50%"]`, `padAngle: 2`, `itemStyle: { borderRadius: 6, borderWidth: 0 }`, `label.show: false`, `labelLine.show: false`, `animation: false`, and three ECharts defaults that must be turned **off** or the ring visibly differs from today: `emphasis: { scale: false }` (sectors grow on hover), `showEmptyCircle: false` (an all-zero pie draws a grey placeholder ring), and the legend (use the HTML one).

**`pieSweep` must change shape.** `chart-rtl.ts:45` returns `{startAngle: 90, endAngle: -270|450}` — recharts' convention. ECharts expresses direction as `clockwise: dir !== "rtl"` with `startAngle: 90`; its `endAngle` means "partial ring", so feeding it 450 produces a plausible chart for the wrong reason. Rewrite the function, its doc comment (which is entirely about recharts) and its five tests in `chart-rtl.test.ts`. **This is the highest silent-failure risk in the whole migration:** nothing connects `pieSweep` to a rendered ring, so deleting the call entirely leaves every test green while the RTL donut spins backwards.

Then flip `auto-viz.ts:93` and `CHART_SUBTYPES.pie`.

**Proof it worked:** the donut-total and donut-legend tests pass unchanged. New option tests: `series[0].clockwise === false` in RTL and `true` in LTR with `startAngle === 90`; `radius` is a two-element array; the tooltip formatter output contains the two-space separator and the Persian percent sign «٪» (U+066A, currently appended unconditionally even in English — carry it verbatim or fix it deliberately, do not let it change silently). Visual check in both directions and both themes.

**Regression risk:** highest of any step. Sweep direction, the hole overlay drifting off centre if the ring's `center` is not `50%/50%`, hover scale, and the empty-result placeholder ring. Budget real RTL eyeball time here, not just tests.

---

## Step 9 — Delete recharts

**Everything below must already be true**, which is why this step is ninth:

- No producer writes `library: "recharts"` (steps 6, 7, 8).
- `EChartsRenderer` draws bar, line, area (or area was consciously dropped) and pie.
- Canvas mounts in jsdom (step 2).

**What changes:**

1. `ReportView.tsx:28` — keep `case "recharts":` as an **alias** returning `<EChartsRenderer/>`. Saved report definitions are persisted by spreading the definition verbatim (`SaveReportModal.tsx:20`), both `ReportViewer` and `useAskAi` prefer `presentation.views` over `chooseView`, and dashboard widget JSON is an opaque backend blob with no migration. Delete the case and every old saved chart falls silently through `default` to `TableRenderer` — no error, no warning. Same reasoning that keeps `WidgetViewMode: "chart"` alive.
2. Keep `"recharts"` in the `ViewLibrary` union (`contracts/presentation.ts:24`). Removing it breaks `npm run typecheck` on `contracts.test.ts:132` and `view-switching.test.ts:79/89` — and note vitest transpiles with esbuild and does not typecheck, so `npm test` stays green while `npm run build` fails.
3. Delete `RechartsRenderer.tsx` and `RechartsRenderer.test.tsx`. **First move the three `aggregateByCategory` tests (`RechartsRenderer.test.tsx:227+`) to `chart-utils.test.ts`** — they are renderer-agnostic and easy to lose as collateral in a file named after the dying library.
4. Delete the `vi.mock("./renderers/RechartsRenderer", …)` at `ReportView.test.tsx:10`. Vitest resolves mock paths eagerly; a factory mock pointing at a deleted module fails the whole file at collection. Add a case asserting a `library: "recharts"` view now lands on `EChartsRenderer`.
5. `features/export/pdf.ts:19` — change `root.querySelector("svg.recharts-surface")` to a plain `svg` fallback. The canvas branch above it keeps working, but leaving a dead class selector is a trap for whoever later tries the SVG renderer.
6. `npm uninstall recharts` (`analytics-web/package.json:33`).
7. Fix the stale comment in `vitest.setup.ts` that attributes the ResizeObserver stub to recharts (the stub itself stays — antd and others need it).

**Proof it worked:** `npm test`, `npm run typecheck`, `npm run build` all green. `grep -ri recharts analytics-web/src` returns only intentional legacy-alias mentions. `node_modules/recharts` gone; bundle shrinks. Manual pass over Ask-AI, a saved report, and a dashboard.

**Regression risk:** a stored `presentation.views` entry with a component name none of the kinds recognise — it hits the bar default, which is the same fallback recharts had. If any production definition names `AreaChart` and area was dropped in step 5, those views change shape here.

---

## Step 10 — Sweep up what the library split left behind

**What changes:**

- **`advancedECharts`.** A user-visible admin switch (`SystemSettings.tsx:23`, `admin/system/types.ts:6`, defaulted true at `api/queries.ts:329`, labelled «ECharts پیشرفته» / "Advanced ECharts" at `fa.json:440` / `en.json:440`, fixture at `SystemSettings.test.tsx:35`). **Nothing reads it.** After "every chart is ECharts" its label promises control over exactly the distinction that no longer exists. Delete it across all six sites, or rename it to what it actually means.
- **`docs/ai/GOTCHAS.md:429`** documents how to verify a recharts chart in a non-displayed pane (`requestAnimationFrame`, `.recharts-legend-icon`). Obsolete, and it must be *replaced*, not deleted — the canvas equivalent is `echarts.getInstanceByDom(el).getOption()` / `getDataURL()`. Add the jsdom canvas-stub gotcha too.
- **`tokens.test.ts:103`** — the assertion ("the echarts palette is the list recharts uses") stays valuable; only its comment goes stale.
- **`auto-viz.ts:76-82` rule 5** emits `component: "EChart"` with the second dimension in `mapping.y` and never sets `mapping.series`, while the heatmap branch requires both `seriesField` and `component === "heatmap"`. **The heatmap is unreachable from auto-viz** — every matrix/advanced report renders as a single-series bar with a dimension dropped. Also `"EChart"` matches none of `findViewForTarget`'s bar/line/pie substrings, so pressing any chart button on such a report always builds a duplicate view instead of selecting the existing one. Fix or file it, but do not leave it undocumented.
- **`ViewSwitcher.tsx:40`'s fallback** ("else → line") becomes load-bearing for more views once every chart is an ECharts view. Replace the substring sniffing with an explicit component→target map.
- Worklog entry per `CLAUDE.md`'s hard rule, plus propagation to `GOTCHAS.md` / `PROJECT-MAP.md`.

**Proof it worked:** tests and typecheck green; `grep -ri recharts` clean outside the deliberate alias.

**Regression risk:** low. Removing the flag touches a persisted tenant setting — confirm the backend tolerates its absence.

---

## Honest sizing

| Step | Rough size | Confidence |
|---|---|---|
| 1 spike | half a day, thrown away | high |
| 2 jsdom stub | 1-2 hours | high |
| 3 data layer | half a day + new tests | medium — drill-by-value may ripple into `drilldown.ts` |
| 4 RTL/interaction | half a day to a full day | **low** — depends entirely on what step 1 finds about the tooltip and the font race |
| 5 four kinds | half a day | high |
| 6 bar flip | 1-2 hours code, half a day QA | high |
| 7 line flip | 1-2 hours | high |
| 8 donut | a full day, plus RTL eyeball time | medium |
| 9 delete recharts | half a day | high |
| 10 cleanup | half a day | high |

**Roughly 4-6 working days** for one engineer, and that number is dominated by steps 4 and 8 rather than by line count. The code itself is small: `RechartsRenderer.tsx` is 335 lines and `EChartsRenderer.tsx` is 175. What costs time is that recharts rendered SVG that inherited the page's font, direction and accessibility for free, and canvas inherits none of it — so the migration is mostly re-establishing things that were never configured because they never had to be.

## What I could not determine from the code

- **Whether any saved report definition or dashboard widget on the server actually carries `library: "recharts"`.** Dashboard JSON is an opaque backend blob with no visible migration. The legacy alias in step 9 is insurance against an unknown, not a measured need — a backend query would let you drop it.
- **Whether any production view names `AreaChart`.** Nothing in the app emits it. Only stored data can answer whether the area branch can be deleted outright.
- **Whether any tenant has a brand primary set.** The brand-leads-the-palette path exists in the theme, and `previewPrimaryColor` (`ui-store.ts:14`) has never reached a chart. Step 6 may change series[0]'s colour for branded deployments; I cannot tell if any exist.
- **The real font timing.** It depends on cache state, network and device — step 1 must measure it, not reason about it.
- **Canvas performance with many widgets on one dashboard.** recharts SVG and ECharts canvas scale differently; nothing in the repo measures either.
- **Whether anyone uses legend toggling.** No telemetry visible. It arrives by ECharts default, not by decision.

---

## Step 1 — DONE. The spike's answers.

**Run on** `feat/echarts-only`, echarts **5.6.0** / echarts-for-react **3.0.6** / zrender **5.6.1**,
Chromium via the in-app browser, RTL page, Vazirmatn loaded. The spike was a throwaway
`spike.html` + `spike.tsx` at the Vite root; both are deleted.

**No screenshots.** The Browser pane is not displayed in this environment, so
`computer{action:"screenshot"}` fails outright, and ECharts draws to canvas so there is no DOM to
read. Everything below is measured instead — canvas text metrics, ink-column profiles, resolved
option read-back and tooltip DOM. Where a question could only be answered by eye, that is said.

### Q1 — RTL tooltip word order. **CONFIRMED. A custom formatter is mandatory.**

The emitted tooltip HTML carries exactly the two physical properties the plan predicted:

```html
<span style="…margin-left:2px">تعداد پروژه</span>
<span style="float:right;margin-left:20px;…">6,550</span>
```

Measured geometry in an RTL block: the name occupies x 907–967, the value x 1001–1037. **The value
sits to the right of the name**, and right is the reading edge in RTL — so the tooltip reads
*value, then name*, reversing recharts' «name : value». Neither `float:right` nor `margin-left`
comes from anything reachable through `tooltip.textStyle`.

→ **Step 4 must ship a custom `tooltip.formatter`.** The existing
`EChartsRenderer.test.tsx` assertion that `textStyle.align === "right"` guards nothing.

### Q2 — Font race. **CONFIRMED, and it changes layout, not just glyphs.**

| | `document.fonts.check("12px Vazirmatn")` | measured width of «آذربایجان شرقی» |
| --- | --- | --- |
| first paint | **false** | 62.27px |
| after `document.fonts.ready` | true | **71.97px** |

A **15.6%** metric shift. Canvas text is rasterised once and `grid.containLabel` sizes the plot from
those metrics, so a chart painted before the webfont lands keeps fallback glyphs *and* a plot box
measured for the wrong font.

→ **`document.fonts.ready.then(() => chart.resize())` belongs in the shared seam**
(`components/charts/useEChart.ts` and the renderer), not per chart. Not reproduced from a genuinely
cold HTTP cache — the font was already cached in this session — but the metric difference is the
mechanism and it is not in doubt.

### Q3 — Negatives in RTL. **CONFIRMED BROKEN, and a fix is measured.**

The app's real `formatNumber` (`presentation/format.ts:16-27`) emits **`-۱٬۲۳۴`** — ASCII
hyphen-minus, Persian digits, Persian comma «٬».

The chart canvas reports **`ctx.direction === "rtl"`** (it inherits the CSS direction; zrender never
sets it), so the bidi algorithm runs RTL. Rendering that string at 20px and reading ink-column
heights — a hyphen is ~2px tall, a digit ~7–10px:

| `ctx.direction` | leading glyph | trailing glyph | where the minus lands |
| --- | --- | --- | --- |
| `ltr` | **2px** | 7px | left — correct |
| `rtl` | 10px | **2px** | **right — «۱٬۲۳۴-»** |

recharts defended this with `tick={{ style: { direction: "ltr" } }}`. **That has no canvas
counterpart** — `ctx.direction` is not exposed by any echarts option.

Remedies tested on the RTL canvas:

| candidate | result |
| --- | --- |
| as-is | RIGHT (wrong) |
| **`U+2066` LRI … `U+2069` PDI** | **LEFT (correct)** |
| **`U+200E` LRM prefix** | **LEFT (correct)** |
| `U+2212` MINUS SIGN instead of hyphen | RIGHT (wrong) |
| `U+200F` RLM suffix | RIGHT (wrong) |

→ **Step 4: wrap negative output in an LRI…PDI isolate** (or an LRM prefix) inside `formatNumber`.
Note this affects the **table and export paths too**, which use the same formatter — so it is worth
doing deliberately rather than only for charts. Swapping to U+2212 does *not* help.

### Q4 — Legend click. **`selectedMode` is `true` by default; one click blanks a single-series chart.**

Measured: `legend[0].selectedMode === true`; `legendUnSelect` sets `{"تعداد پروژه": false}` while the
series still holds its 3 data points — hidden, not removed. With one series (auto-viz rules 2 and 3,
the common case) a stray legend click empties the chart, and our own `notMerge` restores it on the
next re-render, so it reads as a flicker rather than a toggle.

→ **Step 4: set `selectedMode: false` when there is one series**, keep it for multi-series.

### Q5 — Label collision under 9 categories. **CONFIRMED. `interval: 0` is wrong for narrow widgets.**

Six real province names, 12px Vazirmatn, in a 360px chart with the renderer's `grid.left/right: 48`:

- plot width ceiling **264px** → **44px per category**
- label widths: 72.0, 93.6, 98.3, 93.6, 65.6, 38.5 px
- **5 of 6 exceed their slot**; the widest is 98.3px in 44px — more than double

`EChartsRenderer.tsx` forces `interval: 0` (draw every label), the opposite of recharts'
`preserveEnd` thinning.

→ **Step 4: drop the forced `interval: 0`.** Let ECharts thin (`interval: "auto"`), or rotate.
Rotation is arithmetically sufficient here — rotated labels collide when the slot is below
`labelHeight / sin θ` ≈ 14/0.5 ≈ 28px, and the slot is 44px — but that is arithmetic, not measured.

### Q6 — Accessibility. **Better than the plan implied, still not parity. A decision for Amir.**

`aria: { enabled: true }` **does** work, and my first reading of it was wrong: it puts the attributes
on the **container div**, not on any child, which is why an inner-element query found nothing.
Measured output:

```html
<div role="img" aria-label="This is a chart with type Bar chart named مقدار.
     The data is as follows: the data for الف is 0, 3, the data for ب is 1, 7. ">
```

Three things follow. It is **off by default** — the other six charts in the spike had no aria
attributes at all. The boilerplate is **hard-coded English on a Persian page**, though every template
is overridable (`aria.label.general.*`, `.series.*`, `.data.*`). And the data phrasing emits index and
value together — *"the data for الف is 0, 3"* — which reads as noise.

What is lost against recharts either way: axis ticks and legend text stop being real DOM, so no
selection, no find-in-page, no per-datum navigation. `role="img"` plus one summary string is a
mitigation, not parity.

→ **Amir's call.** The cheap, honest position: enable `aria` with translated templates in step 4 and
accept summary-level access. If per-datum access matters, the alternative is a visually-hidden table
beside each chart — real work, not a flag.

### Q7 — API details on the installed build. **All confirmed.**

`echarts@5.6.0` is installed and `analytics-web/package.json` pins `^5.5.0`, which guarantees
≥ 5.5.0 — so `padAngle` (added in 5.5.0) can never resolve away. No need to tighten the range.

Every option the plan's donut config depends on survived the round trip through `getOption()`:
`padAngle: 2`, `clockwise: false`, `startAngle: 90`, `showEmptyCircle: false`,
`emphasis.scale: false`, `radius: [68, 110]`.

### What this changes in the plan

- **Step 4 grows**, as its "low confidence" sizing anticipated. It now definitely carries: a custom
  RTL tooltip formatter (Q1), a font-ready `resize()` in the shared seam (Q2), a bidi isolate for
  negatives (Q3), `selectedMode` (Q4), and removing the forced `interval: 0` (Q5).
- **Q3 reaches past the charts.** `formatNumber` is shared with the table and the exporters, so the
  isolate is a formatter change with wider blast radius than "RTL chart parity".
- **Step 8's donut config is safe to write as specified** — all six options verified on 5.6.0.
- **Q6 is the only open decision**, and it is Amir's.
- **Not answered by this spike**, because it needs eyes and the pane cannot be shown: whether the
  rotated 6-label layout actually looks right, and whether the donut's ring reads correctly in RTL.
  Both are step 4 / step 8 visual checks on a real screen.

---

## Step 2 — DONE. ECharts mounts for real in jsdom, but not through the wrapper.

**What shipped:** two stubs in `analytics-web/vitest.setup.ts`, and one real-mount test at
`src/components/charts/useEChart.mount.test.tsx`. Nothing in `src/` that ships changed.

### The stubs, and proof each one is load-bearing

**1. A 2D canvas context.** jsdom returns `null` from `getContext("2d")`. A Proxy rather than a
hand-listed object, because zrender reaches for a long tail of context members and a missing one is a
TypeError deep inside a render; unknown members answer with a no-op. `measureText` estimates 6px per
character rather than the plan's `{ width: 0 }` — zero-width text quietly collapses
`grid.containLabel` maths. It is not real font metrics and the comment says so.

**2. `clientWidth` / `clientHeight` on `HTMLElement.prototype`.** Inline px wins where given, else
800×600. Verdict 1 called this and it was right: the canvas stub alone is not enough.

Removing each one, measured:

| removed | what happens |
| --- | --- |
| canvas stub | `Cannot set properties of null (setting 'dpr')` — the exact error the plan named |
| size stub | one `console.warn` "[ECharts] Can't get DOM width or height", and `clientWidth` reads 0 instead of 400 |

The improvement over the status quo is not only that it mounts: it now **fails in the right file**. The
old failure was an unhandled rejection that Vitest attributes at run level, so it landed on whichever
file ran next.

### Verdict 9 addressed

The plan's acceptance criterion — "zero unhandled rejections across the run" — is not a thing a test
can assert, and a half-working stub satisfies it intermittently depending on file order. Replaced with
a file-local, deterministic equivalent: spy on `console.error`/`console.warn` and assert both are empty
for one mount. Same question, asked somewhere it can be answered.

### The finding that changes the plan: **`echarts-for-react` cannot complete an init in jsdom**

Its `initEchartsInstance` (`node_modules/echarts-for-react/lib/core.js:68-89`) is two-phase: create a
temporary instance, wait for **that instance's `finished` event**, `dispose` it, then re-init using the
container's measured `clientWidth`/`clientHeight`.

Measured, with both stubs in place: the container ends up carrying `_echarts_instance_`, a `<canvas>`
sits inside it, `clientWidth`/`clientHeight` report 400/300, **zero errors are logged** — and
`getInstanceByDom` returns undefined, because the last thing to happen to the element was the dispose.
Neither pumping 80 animation frames nor passing explicit `opts={{width,height}}` rescues it. A separate
probe confirmed `finished` *does* fire for a directly-created instance, so the event is not the whole
story.

**A direct `echarts.init` works perfectly** — instance registered, option readable, palette applied,
disposes cleanly. That is what `components/charts/useEChart.ts` already does, and what the two admin
charts already use.

So the smoke test the plan asked for exists, but against `useEChart` rather than `EChartsRenderer`.
`EChartsRenderer` keeps its `vi.mock("echarts-for-react")` option-shape tests for now.

### The decision this raises — for Amir

**Move `EChartsRenderer` off `echarts-for-react` and onto `useEChart`.** It is not required by any
later step, but it buys a lot:

- **Real-mount tests for the renderer**, which is verdict 8's whole point — option-shape assertions
  against a mock cannot catch an option ECharts rejects or normalises away.
- **One init path** for every chart in the app instead of two.
- **One less dependency**, and the end of the dispose-and-re-init churn that also causes the
  `notMerge` tooltip/dataZoom loss described in verdict 5.

Cost: `EChartsRenderer` currently leans on the wrapper's prop diffing (`fast-deep-equal`) and its
`onEvents` plumbing; both would move into the hook. Roughly half a day, and it belongs before step 5
rather than after, since step 5 adds three more chart kinds to whichever path is chosen.

If the answer is no, later steps still work — they just keep testing options rather than charts.

### Verified

546 front-end tests across 80 files (up from 538/79), lint, typecheck and build clean. Both stubs were
removed one at a time to confirm the failure they prevent. The eight new tests read a live instance
rather than a mock: series survived, `xAxis.data` carries «تهران»/«فارس», the palette resolved to
`#326BFC` rather than ECharts' own `#5470c6`, and unmount leaves no instance on the node.

Incidental: on echarts 5.6.0 `isDisposed()` returns `undefined` for a live chart, not `false`.

---

## Step 2b — DONE. `echarts-for-react` is gone; every chart inits through `useEChart`.

Amir's call on the decision step 2 raised, taken **before step 3** rather than before step 5: steps 3
and 4 both rewrite `EChartsRenderer` heavily, and step 4's memoization work exists *because* of
`echarts-for-react`'s `fast-deep-equal` prop diffing. Doing it first avoids writing code for a wrapper
about to be deleted.

### The trap this nearly walked into

`useEChart`'s effect was keyed `[option, themeMode]`. That is fine for the two admin charts, which
memoize their option — and catastrophic for the renderer, which rebuilds its option every render. A
naïve swap would have **disposed and re-inited the chart on every render**: worse than the wrapper,
resetting the dataZoom slider and dismissing any open tooltip each time.

So the hook now has three concerns instead of one:

- **init/dispose** keyed on `[themeMode, hasOption, eventNames]` — a boolean and a joined string, so a
  new option *object* cannot retrigger it.
- **setOption** keyed on the option, updating the live instance. Guarded by an `applied` ref so mount
  does not send the same option twice (both effects run after the same commit).
- **handlers** held in a ref and read at dispatch time, so a fresh closure each render does not mean
  unbinding and rebinding listeners. A test dispatches through the recorded listener and asserts the
  *second* handler runs — the ref indirection is the thing being tested, and binding directly would
  send a drill click to a stale callback.

The init effect also re-applies the current option, or a light/dark switch would leave the rebuilt
chart blank until the next option change — which may never come.

### `EChartsRenderer` restructured

It had **two return points**, each rendering its own `<ReactECharts>`. Hooks cannot be called
conditionally, so the branch moved inside a single `useMemo` and there is now one `useEChart` call and
one `<div>`. The two option shapes are unchanged.

### The tests got stronger, which was the point

`EChartsRenderer.test.tsx` mocked `echarts-for-react` and asserted the option handed to it. It now
mounts for real and reads the option back off the live instance — verdict 8, finally actionable. A mock
accepts anything, so the old version would have passed just as happily if ECharts ignored the option
entirely.

**`getOption()` returns the NORMALISED option**, which is both the value and the gotcha: ECharts wraps
single components in arrays and fills defaults, so it is `xAxis[0].inverse`, not `xAxis.inverse`.
Asserting the un-normalised shape is exactly what a mock lets you get away with. One assertion changed
character usefully: the RTL legend test can no longer say "the other side is undefined", because
ECharts fills a default — it now says "the other side is not ours".

### Verified

- **557 front-end tests** across 80 files (up from 546), lint, typecheck and build clean.
- `grep -rn echarts-for-react src/` returns **comments only**; `npm uninstall` took it out of
  `analytics-web/package.json`.
- Bundle **3,627.20 kB → 3,609.20 kB** (gzip 1,132.71 → 1,126.23). Small, and real.
- 22 real-mount tests now exist where there were none: 14 on the renderer, 8 on the hook.
- The app still renders after a reload — heading, canvas and recharts legend all present, no error
  boundary.

**Not verified in the browser:** `EChartsRenderer`'s new mount path. No local report produces a
`library: "echarts"` view — the heatmap is unreachable from auto-viz (a known finding) and the two
admin charts sit behind `ai:manage`, which 403s locally. It rests on the 22 real-mount tests. The first
browser sighting of it will be step 6, when bar charts start routing to ECharts.

**A grep that lied, worth remembering:** searching the built bundle for `getInstanceByDom` returns
**0** even though echarts is bundled — Rollup resolves a static namespace property access into a
renamed local, so the symbol never appears. `zrender` returning 1 is the honest control. The reliable
signals for "is this dependency gone" are the import graph and the size delta, not a symbol grep.

---

## Step 3 — DONE. The data layer, and the drill bug fixed in both renderers.

All five bullets. None of these threw before; they produced quietly wrong charts, which is worse.

### Aggregation

`rows.find(r => r[x] === xc)` took the **first** matching row and discarded the rest. Four rows over
two months drew two bars each holding one row's value. Now `aggregateByCategory`, with the category
axis derived from the aggregated rows rather than from `uniq`. Duplicates inside a *split* series are
summed too, which the old code also got wrong.

### The missing bucket

`uniq` did `if (v === null) continue`, deleting a whole category. It now keeps one missing bucket,
using a separate flag rather than a sentinel string so no real category can collide with it, and
`formatCategory(null)` renders it as the blank tick recharts already shows. `undefined` joins `null`
in that one bucket.

### More than one measure

`mapping.y` is `string | string[]` and this collapsed to the first. Now one series per y key, named
through `useColumnLabel` — the same names the legend, the table and the exports use. The other meaning
of multi-series (one measure split by `mapping.series`) still works; both coexist.

### Series names

`name: String(sv)` was raw, so a chart split by month showed a Jalali date on the axis and an ISO one
in the legend at the same time. Now through `formatCategory`, the same function the axis uses.

### Drill by value — fixed in BOTH renderers

The verdict correction stands: this was never ECharts-specific, and `RechartsRenderer` — the path
almost every chart uses today — had the identical positional lookup. Fixed in both via a shared
`renderers/drill.ts`, rather than leaving the recharts path knowingly broken until step 9.

The recharts side needed one extra thing: `withCategoryLabels` **overwrites** the category with its
formatted label, which is precisely why the click handler had nothing but an index to work with. The
raw categories are now captured before that.

`resolveDrillTarget` matches on value, comparing as strings (a year is `1405` on one side and `"1405"`
on the other), and treats `null`/`undefined` as one bucket so a click on the blank tick still drills.

### Verified

**582 tests** across 82 files (up from 557), lint, typecheck and build clean. 8 tests on the shared
helper, 17 on the renderer's data layer.

Each fix was reverted to confirm it is load-bearing:

| reverted | result |
| --- | --- |
| positional drill | `expected 'Tehran' to be 'Fars'` |
| first-match instead of aggregation | `expected [100, 40] to deeply equal [350, 100]` |
| `uniq` dropping nulls | **passed — 13/13** |

**That third row is the useful one.** The null fix had *no coverage*: every null test went through the
single-series path, which `aggregateByCategory` covers, while `uniq` is what covers the other two paths
— the heatmap matrix and a split series. Four tests were added for those, and reverting the fix now
fails four times instead of zero.

### Not verified

No browser sighting. No local report produces a `library: "echarts"` view — the heatmap is unreachable
from auto-viz and the admin charts 403 locally — so this rests on 25 real-mount tests. Step 6 is the
first time these code paths appear on a screen.

The drill change is **user-visible on the recharts path today**: clicking a bar on a sorted report now
opens a different report than it did yesterday. That is the fix, not a regression, but it is worth
knowing before someone reports it as a change in behaviour.

---

## Step 4 — DONE. RTL and interaction parity, on everything step 1 loaded onto it.

### The tooltip is hand-built now, because ECharts' own is physically laid out

Step 1 measured it: ECharts emits `float:right` on the value and `margin-left:2px` on the name, and in
an RTL block `float:right` puts the value at the *reading* edge — so the tooltip read **value then
name**, reversing recharts' «name : value». Neither property is reachable through
`tooltip.textStyle`, which is why the old `align === "right"` assertion guarded nothing and has been
deleted rather than ported.

The replacement uses logical properties only (`margin-inline-start`, `margin-block-end`), so one
formatter serves both directions, escapes category values (they are data, and they reach markup), and
reads a heatmap datum's `[x, y, value]` triple as well as a plain value. `confine: true` is set too —
widget bodies scroll, and an unconfined tooltip is positioned against the viewport, so near an edge it
spilled outside the widget.

### Negatives in RTL — fixed in `formatNumber`, which reaches further than the charts

The measurement from step 1: `-۱٬۲۳۴` renders with the minus on the **wrong side** because
U+002D is bidi-neutral and the chart canvas reports `ctx.direction === "rtl"`. recharts defended this
with `tick={{ style: { direction: "ltr" } }}`, a CSS property with **no canvas counterpart**.

`formatNumber` now wraps a negative in `U+2066 … U+2069` (LRI…PDI). Of five candidates tested on the
RTL canvas, that and an LRM prefix work; U+2212 MINUS SIGN and a trailing RLM do not.

Placed there rather than in each chart formatter deliberately: **the on-screen table and the PDF go
through `formatCell` → `formatNumber`, so they are fixed too, while CSV and Excel take raw row values
and get no control characters in a spreadsheet cell.** Only negatives are wrapped, so every positive
number stays byte-identical — verified on the live page, zero stray isolates.

**A pre-existing bug fell out of writing that test.** `Intl.NumberFormat` formats `-0` as `"-0"`, so an
axis tick or a delta that rounded down to zero read as «-۰». Zero is not negative; normalised.

### Legend

`legendPlacement(dir).inline` instead of a second inline copy of the same decision, plus `bottom: 0` —
ECharts defaults a legend to top-centre while recharts put it underneath, so without it the legend
landed on the plot. `grid.bottom` clears it.

`selectedMode` is now `series.length > 1`. Step 1 measured the default as `true`, and with a single
series — the common shape auto-viz produces — one click empties the chart while our `notMerge` puts it
back on the next re-render. A toggle that blanks everything and then undoes itself reads as a glitch,
not a control. With several series it is genuinely useful, so it stays.

### Axis labels

The forced `interval: 0` is gone, replaced by `hideOverlap: true`. Step 1's arithmetic: at 360px with
six real province names the plot gives **44px per category** against label widths of 72.0, 93.6, 98.3,
93.6, 65.6 and 38.5px — five of six overflow, the widest by more than double. recharts thinned with
`preserveEnd`; ECharts hides what will not fit rather than overlapping it.

### The heatmap's colour scale

`visualMap.formatter` wired to the same value formatter. Its min/max labels fell back to `toFixed` —
ASCII digits with no grouping, the one number on the chart not going through our formatter.

### The font race

`document.fonts.ready.then(() => instance.resize())`, in `useEChart` rather than per chart, since every
chart now comes through it. Step 1 measured «آذربایجان شرقی» at 62.27px in the fallback face and
71.97px in Vazirmatn — a 15.6% shift that `grid.containLabel` sizes the plot box from, so a chart drawn
before the font lands keeps both the wrong glyphs and a plot measured for the wrong font.

### One bullet became moot rather than done

The plan asked for `valueFormatter`, `axisLabel.formatter` and `onEvents` to be memoized, because
`echarts-for-react` gated updates on `fast-deep-equal` and fresh closures forced a destructive
`notMerge` rebuild every render. **Step 2b deleted that wrapper.** The option is built inside a
`useMemo` and handlers are held in a ref, so there is no per-render rebuild left to prevent. Recorded
rather than silently skipped.

### Verified

**599 tests** across 82 files (up from 582), lint, typecheck and build clean. Four guards were reverted
to confirm they bite:

| reverted | result |
| --- | --- |
| value before name, with `float:right` | 2 failures, including the name/value ordering |
| `interval: 0` restored | `expected +0 not to be +0` |
| `selectedMode` removed | `expected true to be false` |
| — negatives and −0 — | covered by 6 new `formatNumber` tests |

On the live page: axis ticks unchanged («۱٬۵۰۰٬۰۰۰٬۰۰۰»), **zero stray isolate characters**, no console
errors.

**Not verified:** the negative-number fix on a real screen — no seeded report contains a negative, so
there is nothing local to look at. It rests on the canvas ink-column measurement from step 1 and the
unit tests. Also still unseen: the ECharts tooltip and legend in a browser, since no local report
produces an `echarts` view. Step 6 is the first time any of this appears on screen.

---

## Step 5 — DONE. Line, area and bar parity. Still nothing routed.

### The decision the plan left open: **area stays**

Confirmed again that nothing in the app emits it — `SwitchTarget` is `ViewType | "bar" | "line" | "pie"`,
`CHART_SUBTYPES` has only those three, and the only other `AreaChart` reference is the branch inside
`RechartsRenderer` itself. So it is reachable only from a hand-written or AI-authored view.

Kept anyway. Whether a *stored* definition names it cannot be answered from the code, only from the
database, and the cost of being wrong is asymmetric: keeping it costs six lines, dropping it silently
changes the shape of a report someone saved. Same reasoning that keeps the legacy `library: "recharts"`
alias alive in step 9. If a backend query later shows no stored view names it, deleting it is trivial.

### The kinds

An alias table ported from `RechartsRenderer` verbatim, **including the silent bar default** — a stored
view whose component string nothing recognises draws a bar rather than nothing, which is what saved
definitions already rely on.

- **line** — `smooth: true, smoothMonotone: "x", showSymbol: false`. The monotone part is not
  decoration: plain `smooth: true` is a different spline that overshoots between points, so a sparse
  series dips below zero where recharts' curve did not. `showSymbol: false` matches `dot={false}`.
- **area** — the line shape plus `areaStyle: { opacity: 0.25 }`, **overlaid not stacked**, which is what
  recharts drew.

The shape is spread into every series, so a multi-measure or split-series chart is not half bar and
half line.

### Parity details, each of which would otherwise be a silent visual change

| | |
| --- | --- |
| **height 320, not 360** | The renderer had 360. Routing views here would have made every dashboard widget's chart 40px taller — a layout change disguised as a library change. |
| `axisPointer` | `shadow` for bars, `line` for curves; recharts drew the same distinction. |
| grid lines | recharts dashed **both** axes; ECharts hides the category one by default, so it is asked for explicitly. |
| dash pattern | `[3, 3]`, in the theme where grid appearance belongs — not `type: "dashed"`, which is a visibly longer pattern. |
| **only bars drill** | recharts' `onClick` lived on `<BarChart>` alone, so line and area never drilled. Giving them one would be a product change wearing a migration's clothes. |

`valueAxisWidth` is **not** ported. `grid.containLabel` already measures the value labels and reserves
room. That is the cleanest net deletion in this migration.

### Verified

**619 tests** across 83 files (up from 599), lint, typecheck and build clean. 20 new, covering all six
component aliases, the unrecognised-component fallback, the curve settings, area fill and non-stacking,
and the parity table above.

Guards reverted to confirm they bite:

| reverted | result |
| --- | --- |
| height back to 360 | `expected '360px' to be '320px'` |
| plain `smooth`, no monotone | 3 failures |
| drill gating removed | line and area both drilled — `called 1 times` |

### Not verified

Nothing on a screen, still. No local report produces a `library: "echarts"` view, so line, area and the
parity details rest on the tests. **Step 6 is the first time any of this is visible**, and it is the
step to slow down on: it flips `auto-viz` and `CHART_SUBTYPES`, so every bar chart in the app changes
library at once.
