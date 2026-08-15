# Every dashboard widget rendered 159×40, and the saved layout was correct the whole time

- **Date:** 2026-08-15
- **Area:** analytics
- **Branch / commits:** `feat/custom-reports`
- **Status:** fixed, not deployed

## Goal

*"fix the widget sizing bug first"* — the defect first noticed during the recharts→ECharts migration
(a widget laid out `w:6 h:4` rendering 133×40) and confirmed present on `main` before that work. It
became blocking when a custom report was pinned to a dashboard in step 7 of the custom-reports
design: the widget's contents could be measured in the DOM, but nobody could look at it.

## What changed

- `dashboard/DashboardCanvas.tsx` — one guard in `onLayoutChange`: never write back a layout while
  the incoming one is empty.
- `dashboard/DashboardCanvas.test.tsx` — new; holds the negative case.

## Root cause

`react-grid-layout` assigns `w:1, h:1` to any child it has **no layout entry for**, and reports that
through `onLayoutChange` like any other change.

`DashboardsPage` starts at `useState<GridLayoutItem[]>([])` and fills it from the dashboard once the
query resolves. In that gap the canvas renders its children with an empty layout, so RGL invents a
grid of 1×1 stubs and hands it straight back — and the handler saved the invention into the page's
state **before the real layout was ever applied**.

Instrumented rather than reasoned about, which is what finally settled it:

```
CANVAS layout prop []                        ← data still loading
RGL onLayoutChange 12 [{w:1,h:1},{w:1,h:1}]  ← RGL's invention
CANVAS layout prop [{w:1,h:1},{w:1,h:1}]     ← written back over the real design
```

**Why the symptom pointed elsewhere.** The layout in storage stayed perfectly correct — only the
in-memory copy was clobbered — so every investigation that started by checking the saved data
concluded the data was fine and the bug must be in rendering. Three wrong theories were worked
through before instrumenting: a stale `WidthProvider` measurement (disproved — dispatching `resize`
changed nothing), column clamping at a narrow breakpoint (disproved — the arithmetic predicted 666px,
not 159), and a missing `layouts` entry per breakpoint (disproved — RGL does fall back to `lg`).

The existing `colsRef` guard did not catch it: it exists for a *different* squeeze — a narrow screen
reporting its derived layout — and fires on `onBreakpointChange`. On first paint there has been no
breakpoint change, so `12 === 12` and the invention passed straight through.

## Decisions

- **Guard in `DashboardCanvas`, not in each page.** Three callers pass layouts (`DashboardsPage`,
  `DashboardBuilder`, `DashboardViewer`); the component that owns the existing write-back guard should
  own this one.
- **`layout.length === 0` as the condition**, not a loading flag. The canvas has no idea whether its
  caller is loading; it does know that a layout it never received is not one it should save.
- **The positive case is not tested here.** `WidthProvider` sizes from `offsetWidth` plus a
  ResizeObserver — jsdom reports 0 for the first and this suite stubs the second with a no-op, so the
  grid sits at its narrowest breakpoint and the `colsRef` guard swallows every change before the new
  one is reached. Stubbing `offsetWidth` was tried and was not enough. It is covered where it does
  run: *"Save button persists both widgets and layout to the mock DB"* in `DashboardBuilder.test.tsx`.

## Verification

**718 tests across 88 files**, lint, typecheck and build clean. Removing the guard fails the new test.

In a browser, on the seeded dashboard: widgets now render **658×190** and **658×490** for `h:4` and
`h:10` — exactly `4×40 + 3×10` and `10×40 + 9×10` at `rowHeight: 40`, `margin: 10`. Both widgets draw
their contents: the revenue bar chart, and the quota report's picker, note and table.

**Not verified:** dragging a widget and confirming the new position persists. The mock user on that
screen is a PowerUser, who gets no edit toggle, and drag-and-drop through the browser tool is not
something to claim without doing it.

## Follow-ups

- **The breakpoints are compared against the container, not the viewport.** `WidthProvider` measures
  the grid's own box, which is ~678px inside a 1038px window once the sidebar and padding are taken
  off — so a normal laptop sits at the `xs` breakpoint and gets the 4-column derived layout rather
  than the 12-column design. That is why both widgets render full width above. It is now *correct*
  behaviour for a narrow container rather than a broken one, but the breakpoint values look like they
  were chosen for viewport widths. Worth revisiting deliberately.
- Deploy along with the custom-reports branch.
