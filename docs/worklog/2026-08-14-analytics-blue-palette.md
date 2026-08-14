# The palette moved from emerald to blue, and the charts got two lists instead of one

- **Date:** 2026-08-14
- **Area:** analytics
- **Branch / commits:** `main` — `6b6a56f`
- **Status:** **live** on analytic.myceo.ir

## Goal

Amir supplied a six-colour palette from an image and asked to *"change color palette according this
image and update the analytics template with chart color"*:

| role | hex |
| --- | --- |
| Primary Blue | `#326BFC` |
| Orange | `#FE8113` |
| Yellow | `#FCBB21` |
| Red | `#FD411E` |
| Green | `#24AF7E` |
| Cyan | `#06B5F8` |

Two decisions he made before the work started: apply it to **both** the chart series and the
analytics brand, and **deepen only in light mode** — keep the supplied hex exactly in dark.

## What changed

- `analytics-web/src/theme/tokens.ts` — `primary` / `primaryInk` / `primarySolid` are now all
  `#326BFC` (the emerald needed a different value for each). `primaryInkDark` is `#5e8bfd`. The one
  `SERIES` array became `SERIES_DARK` (the supplied hex) and `SERIES_LIGHT` (deepened twins), and
  `chartColors(mode)` returns the matching one.
- `analytics-web/src/theme/theme.ts` — `tokens.primary` now imports the brand from `tokens.ts`
  instead of restating `#10b981`; `accent` is the palette cyan. `buildAntdTheme` picks
  `primaryInkFor(mode)` when the brand is ours, so dark gets the lifted blue. `buildEChartsTheme`
  now returns `chartColors(mode).series` — it used to invent series 3 and 4 by lightening the brand
  a fixed amount. Deleted the now-unused `lighten` helper.
- `analytics-web/src/theme/global.css` — `--rw-primary`, `--rw-accent`, `--rw-primary-ink`
  (+ dark), `--rw-primary-solid`.
- Five CSS files under `features/` and `layout/` — the green **fallbacks** inside
  `var(--ant-color-primary, #0f6e56)`. Only reachable if the var fails to resolve, but a green flash
  in a blue app is a trap for the next reader.
- `admin/tenants/TenantFormModal.tsx`, `api/seed.ts` — a new tenant defaulted to the old emerald.
- `theme/tokens.test.ts` — rewritten. The old file asserted the *emerald* story, including a test
  named "the colour that actually renders is too light for text".

Then Amir asked whether the chart libraries have a colour template or need a hardcoded palette.
Answering it honestly turned up two real problems, so a second pass followed:

- `theme/echarts-theme.ts` **(new)** — a real ECharts theme: palette, font, title, legend, tooltip,
  all four axis types, grid, dataZoom, and the heatmap ramp.
- `components/charts/useEChart.ts` **(new)** — one hook for every raw `echarts.init`, themed and
  keyed on `themeMode` so the chart is rebuilt when the user switches light/dark.
- `presentation/renderers/EChartsRenderer.tsx` — takes `theme={…}`; colour, axis and tooltip styling
  deleted from both options. Only direction-dependent values stay (`inverse`, `position`, legend
  side, tooltip `align`, the number formatter).
- `admin/ai/usage/AIUsageCost.tsx`, `admin/audit/AuditCostChart.tsx` — were calling
  `echarts.init(el)` bare. Now use the shared hook. `AuditCostChart` had its option built inside the
  effect, so it moved to a `useMemo` first.
- `theme/theme.ts` — **deleted `buildEChartsTheme`**. It was dead: only its own test called it.
- `theme/echarts-theme.test.ts`, `components/charts/useEChart.test.tsx` **(new)**, plus theme
  assertions added to `EChartsRenderer.test.tsx`.

## Root cause (of the near-miss, not of a reported bug)

Nothing was reported broken, but the browser check found a real defect the unit tests would have
missed, and the cause is worth writing down.

The first dark ink was `#5a88fd`, solved against antd's `colorBgContainer` `#15211d`, where it reads
**5.03:1**. Reading the rendered page showed the report viewer draws its chart on `--rw-bg`
`#0b0f14` instead — **dark mode has six different grounds**, set in two different places:

| token | hex | set in |
| --- | --- | --- |
| `--rw-bg` | `#0b0f14` | `applyCssVars` (theme.ts) |
| `--rw-surface-1` | `#111827` | `applyCssVars` |
| **`--rw-surface-2`** | **`#1f2937`** | `applyCssVars` — this is the **Table header** |
| `colorBgContainer` | `#15211d` | `darkTokens` (tokens.ts) |
| `colorBgLayout` | `#0e1513` | `darkTokens` |
| `#152922` | — | what the old test used, which matches nothing |

`#1f2937` is the lightest, so it is the one that decides. `#5a88fd` measures **4.456:1** there —
under AA, on a table header, while passing a test written against `#15211d`. Re-solved against all
six at once: `#5e8bfd`, worst case 4.61:1.

**A colour measured against one surface is not measured.** The test now iterates every ground.

## The second root cause: two charts were never themed at all

`AIUsageCost` and `AuditCostChart` called `echarts.init(ref.current)` with no theme and no `color`.
ECharts then supplies its own defaults, silently:

- its palette — **five of nine** colours miss 3:1 on white (its yellow reads **1.56:1**);
- its body text `#333`, which measures **1.31:1** on our dark panel — effectively invisible;
- its axis grey `#6E7079`, **3.36:1** on dark, under the 4.5 a label needs;
- a blue-to-red heatmap ramp, a second palette on the same page.

Nothing errors. The chart just renders in another product's colours, and no palette change reaches
it — these two would have kept the ECharts default look right through this deploy.

Alongside that, `buildEChartsTheme` in `theme.ts` **was called by nothing but its own test**. It
made the codebase read as though ECharts was centrally themed while every real chart either set
colours by hand or took the defaults. *A theme builder no chart consumes is worse than none: it
answers the question wrongly.*

## Decisions

- **Two series lists, not one.** Four of the six hues fail the 3:1 a data mark needs on white —
  yellow reads **1.71:1**, cyan 2.34, orange 2.51, green 2.80. On the dark grounds all six clear it.
  So dark carries the supplied hex exactly and light carries same-hue, same-saturation twins with
  the lightness carried down. This is Amir's "deepen only in light mode", made specific.
- **Light values solved to ~3.15, not 3.0.** The first pass landed on 3.005–3.009. That passes a
  `>= 3` test and still fails a reader: rounding to the nearest hex, an anti-aliased edge and a 1px
  stroke each eat that margin.
- **Blue can do all three brand jobs; the emerald could not.** `#326BFC` is 4.52:1 as text on white
  and white on it is 4.52:1 too, so `primary` / `primaryInk` / `primarySolid` collapse to one value
  in light mode. The three constants stay separate anyway, so the next brand change is a
  measurement rather than a guess.
- **A tenant's own brand is used as given.** It leads the ECharts palette and sets `colorPrimary`
  untouched — we cannot guess how someone else wants their colour deepened.
- **Left alone:** the `tone="emerald"` prop on `KpiTile` maps to antd's *success* tokens, not the
  brand. It is semantic green and should stay green; only the prop name is now odd.
- **Theme object, not `registerTheme`.** `echarts-for-react` types `theme` as
  `string | Record<string, any>` and passes it straight to `echarts.init(el, theme, opts)`, so one
  plain object serves both it and the raw-`init` admin charts — no global registry, nothing to
  register at startup, nothing to keep in sync. It compares the prop with a deep equal, so building
  a fresh object each render does **not** re-init the chart.
- **The theme owns colour; the option owns direction.** A theme cannot know which way the page
  runs, so `inverse`, `yAxis.position`, legend side, tooltip `align` and the number formatters stay
  in the option. Everything else moved out, because two sources for one colour is how a chart ends
  up half-themed after a palette change.
- **`themeMode` is in the hook's dependency list on purpose.** An ECharts theme is bound at `init`
  and cannot be changed on a live instance, so following the light/dark toggle means dispose and
  rebuild. Without it the charts keep light-mode axis text on the dark panel.
- **One hue for the heatmap, not blue-to-red.** Red means "a different thing", not "more". Both
  ramps are monotonic in luminance with the top stop at 9.6:1 (light) / 11.6:1 (dark). The bottom
  stop is deliberately near the panel — on a heatmap "almost nothing" should look like almost
  nothing, and the visualMap bar carries the numbers.
- **recharts was NOT removed.** Amir asked to use only ECharts. Agreed as the goal — recharts has no
  RTL support, which is why `chart-rtl.ts` exists at all — but it is a migration, not a colour
  change, and ECharts draws to canvas by default so the recharts DOM assertions would vanish. It is
  getting its own numbered plan.

## Verification

- **469 front-end tests** (75 files, up from 438), lint (`--max-warnings 0`) and build all clean.
- **Every new test was proved to bite**, not just to pass — each was made to fail on the real bug
  first, then restored:
  - raw brand list into light mode → `#FE8113 on #ffffff: expected 2.51 to be >= 3`
  - `#5a88fd` back → `primaryInkFor(dark) is readable on #1f2937: expected 4.456 to be >= 4.5`
  - `theme` prop removed → `no theme prop — ECharts would use its own palette: expected undefined to be defined`
  - heatmap ramp shuffled → `light runs monotonically from faint to strong: expected 0.2687 to be less than 0.0598`
  - `echarts.init(el)` without the theme → 3 failures in `useEChart`
  - `themeMode` dropped from the hook's deps → `did not re-init on theme change: expected length 2 but got 1`
- **Read out of the rendered page** at 1394×982, both themes: `--rw-primary` `#326BFC`,
  `--rw-accent` `#06B5F8`, `--rw-primary-ink` `#326BFC` light / `#5e8bfd` dark. The series mark
  renders `#326bfc` — 4.52:1 on the white panel, 3.67:1 on `#15211d`, 4.25:1 on `#0b0f14`. Legend
  text `#e6efe9` at 14.12:1 in dark; axis ticks 5.36:1 light, 6.14:1 dark.
- **Deployed and checked against the LIVE bundle, not the local one.** Bundle moved
  `index-6Twt7tN5.js` → `index-B-yZSKoG.js` and `index-0irK965-.css` → `index-CnvYlgox.css`.
  Downloading what the origin actually serves and grepping it: all twelve new hex values present;
  `10b981`, `0f6e56`, `047857`, `0ea5e9`, `1d9e75`, `5dcaa5`, `ef9f27` all **0**; `buildEChartsTheme`
  **0**. Container healthy, origin 200, public URL 200 on the new hash. 15 `ceo-portal-*` and
  20 neighbour containers untouched.
- The build was run as its **own** step and its exit code read (0) before recreating — a failed
  build still lets `--force-recreate` start the previous image and report a green deploy.
- The public URL returned **404 for about a minute** right after the recreate. Expected: ArvanCloud
  serves a 404 briefly after an origin container restarts.
- **Impeccable detector** — one advisory, `codex-grid-background` on the pre-existing
  `.rw-ambient-grid` backdrop, not introduced here. Clean on all five ECharts files.

**Not verified — read this before trusting the charts:**

- Only **one** series colour was seen rendering. Colours 2–6 are covered by unit tests but were
  never watched on screen: no local chart has more than one series, and the pie/donut was not
  reached.
- **No ECharts chart was seen at all.** The two admin charts sit behind `ai:manage` / `users:manage`
  and the local mock user gets a 403; the ECharts report renderer needs a two-dimension report that
  does not exist in the local mock data. Everything ECharts here rests on unit tests plus the
  `theme` prop being passed — which is tested, but is not the same as looking at it.
- **No screenshot exists**: the Browser pane was not displayed, so the page never composited frames
  and recharts never drew its bar geometry (see the GOTCHAS note).
- Nothing is deployed — production still serves the emerald.

## Follow-ups

- **Deploy**, then on production: a multi-series chart and the donut for colours 2–6, and
  `/admin/ai/usage` + the audit page in **dark mode** for the two charts that could not be reached
  locally. That last one is the least-proven part of this change.
- **Remove recharts, render everything with ECharts** — agreed direction, planned and verified but
  **not started**. Ten steps in
  [`docs/design/2026-08-14-recharts-to-echarts.md`](../design/2026-08-14-recharts-to-echarts.md),
  4–6 days, shippable after each. Waiting on "start step 1".
- **Live defects that verification turned up, none of which needs the migration first:**
  - **Positional drill-down opens the wrong report.** `result.groups?.[i]` is indexed by row
    position, but `groupNodes` is built before the sort and slice (`engine.ts:576-589`) and never
    re-ordered. With one `desc` sort and no nulls, **all three** bars in a test drilled into the
    wrong group. Both renderers — `RechartsRenderer.tsx:121` and `EChartsRenderer.tsx:53` — and
    `ai/rules.ts` puts a sort on nearly every Ask-AI report. Zero test coverage.
  - **`EChartsRenderer.uniq()` deletes null categories**, so a bar silently disappears where the
    recharts path keeps it.
  - **Dark-mode PDF chart is unreadable.** `echarts-theme.ts:39` is `backgroundColor: "transparent"`,
    so the snapshot is a transparent PNG and light axis text prints onto the white page. *From the
    theme shipped in this very task.* Also: only dashboard widgets ever export a chart image at all —
    ReportViewer and Ask-AI PDFs never have. No test covers any of it.
  - **`advancedECharts`** is a user-visible admin toggle that nothing reads.
  - **The heatmap is unreachable from auto-viz** — rule 5 never sets `mapping.series`.
- The ambient-grid advisory, if it is ever worth acting on.
- `KpiTile`'s `tone="emerald"` could be renamed `success` — cosmetic, touches four call sites.
