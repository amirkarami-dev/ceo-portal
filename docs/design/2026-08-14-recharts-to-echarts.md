# Removing recharts: render every chart with ECharts

**Date:** 2026-08-14
**Area:** analytics-web
**Status:** **plan only — nothing built.** Waiting on "start step 1".

Amir asked to use ECharts only. Agreed as the goal: recharts has no RTL support, which is the whole
reason `presentation/chart-rtl.ts` exists; ECharts has a real theme system; and dropping recharts
takes ~500KB out of a 3.6MB bundle. Not agreed as a same-day change, which is why this is a plan.

The plan below came out of a read-only audit (four parallel surveys over the renderer, the tests,
the consumers and the ECharts baseline; three independent critics; one synthesis). It found 125
things the migration must reproduce and 19 gaps. **I verified its one blocker myself before
writing this down** — see immediately below. I have not re-verified every one of the other 124
line-level claims; treat file:line references as leads to check, not as facts.

---

## Verified before anything else: a live bug, today, in code that is already deployed

The audit claimed `EChartsRenderer` silently deletes null category values while the recharts path
keeps them. **It is right, and it is not only a migration concern — it is shipped.** Proven with a
throwaway test against the real renderer:

| path | categories produced |
| --- | --- |
| recharts (`aggregateByCategory`) | `["Tehran", null, "Fars"]` — 3 bars |
| **ECharts (`uniq`)** | `["Tehran", "Fars"]` — **2 bars, the third value is gone** |

Two separate defects fall out of it:

1. **A whole bar disappears** with no error and no failing test. `uniq()` at
   `EChartsRenderer.tsx:31` does `if (v === null) continue`, while `aggregateByCategory` keeps the
   bucket via `row[categoryKey] ?? null` and `formatCategory(null)` renders it as a blank tick.
2. **Drill-down then targets the wrong report.** The click handler maps `dataIndex` positionally
   into `result.groups`. In the test above `groups.length` is 3 and the axis has 2 entries, so
   clicking the second bar opens the third group.

This is reachable: the query engine deliberately buckets nulls under a stable key and pins the
behaviour in `query/engine.test.ts` — `engine.edge.test.ts:69`, "null grouping key buckets nulls
together under a stable key". Any report grouped on a column with a missing value hits it.

Today it only affects heatmaps and auto-viz rule-5 views, which are rare — **which is exactly why
it is cheap to fix now and expensive after every chart routes through this file.** It is step 3.

---

# Removing recharts: an ECharts-only migration, step by step

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