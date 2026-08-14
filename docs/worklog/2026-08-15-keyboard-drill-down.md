# Drill-down reachable from the keyboard

- **Date:** 2026-08-15
- **Area:** analytics
- **Branch / commits:** `main`
- **Status:** merged, deployment pending

## Goal

*"now add keyboard drill-down"* — the gap left open by
[the canvas accessibility fix](2026-08-15-chart-canvas-accessibility.md): bars drill on a **canvas**
click, and a canvas cannot be tabbed to or hit-tested by a key press, so the feature did not exist
without a mouse.

## What changed

- `presentation/renderers/EChartsRenderer.tsx` — the chart's data table now puts a control on each
  drillable category, with a roving tabindex; plus the drill guard fix below.
- `theme/global.css` — `.chart-a11y-panel:focus-within` unhides the table while focus is inside it.
- `i18n/locales/{fa,en}.json` — `chartA11y.drill` («جزئیات {{category}}» / "Drill into {{category}}").

## Decisions

- **The control lives in the data table, not on the canvas.** The table already lists exactly the
  drillable categories, in the chart's own order, built from the same values the click handler
  resolves against. Nothing new has to be kept in sync.
- **One tab stop, arrow keys inside.** A roving tabindex: only the active row's button is
  Tab-reachable, Up/Down and Home/End move between rows. Per-row tab stops would add eleven stops to
  one report and sixty-plus to a six-widget dashboard — a keyboard regression sold as an
  accessibility feature. `preventDefault` on those keys, or the page scrolls out from under the panel
  that just appeared.
- **The panel becomes visible while focused.** A focusable control inside a permanently hidden box is
  a known trap: a *sighted* keyboard user tabs to something they cannot see, activates it, and the
  page changes for no visible reason. Same bargain a skip link makes.
- **A button only where a drill will actually happen.** Two conditions, not one: the category must
  resolve to a group, **and** `def.drilldown` must exist. See below.
- **The mouse path is left alone.** It is not gated on `def.drilldown`, because a click on a bar that
  does nothing is silent — it never offered anything. A button announced as «جزئیات تهران» is a
  promise, and that is the difference.

## Root cause (of the two bugs found on the way)

**1. The buttons initially appeared on reports that cannot drill.** Both consumers (`ReportViewer`
and `useAskAi`) build the child through `buildDrilldownDefinition`, which throws without
`parentDef.drilldown` — and both catch it as a *silent skip*. No seed report has that config, so the
first browser check produced four buttons that did nothing. Found by clicking one and watching
nothing happen. Now gated on `def.drilldown`.

**2. The heatmap was binding a click handler it should never have had.** The guard read
`meta.rwKind && meta.rwKind !== "bar"`, and the heatmap branch sets **no `rwKind` at all**, so it fell
through the `&&`. A heatmap's `dataIndex` indexes the flat `[x, y, value]` list, not `rwCategories`,
so the lookup read an unrelated category — usually resolving to nothing, occasionally to the wrong
report. Now `meta.rwKind !== "bar"`.

## Verification

**676 tests across 84 files** (was 666), lint, typecheck, build clean. Ten new tests; reverting the
value lookup to positional fails the drill test, and making every row a tab stop fails the roving
test.

In a browser, with a `drilldown` config patched into the stored definition:

- four controls, labelled «جزئیات تهران» … , `tabIndex` `[0, -1, -1, -1]`;
- the panel measures 1×1 unfocused and 862×234 once focus is inside;
- ArrowDown walks تهران → اصفهان → خوزستان → فارس and **stops** rather than wrapping; Home and End
  jump to the ends; ArrowUp walks back;
- activating «اصفهان» drilled: breadcrumb «درآمد ماهانه به تفکیک استان / اصفهان» and a KPI of
  ۲٬۳۸۱٬۵۰۰٬۰۰۰ — the same number the table's اصفهان row showed.

**Not verified:** the Browser pane's `computer key` action delivers a keydown with an **empty
`key`**, so real key injection could not exercise the handler — arrow navigation was driven with
well-formed `KeyboardEvent`s dispatched in the page instead, and the unit tests do the same. Enter
and Space were not pressed for real either; they rely on native `<button>` activation, which is why
it is a `<button>` and not a `div` with a role. No test with an actual screen reader.

## Follow-ups

- No seed report has a `drilldown` config, so nothing drills in local mock data — mouse or keyboard.
  Worth adding one to the seed so the path is exercised by default.
- Deploy to `analytic.myceo.ir`.
