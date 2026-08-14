# A dashboard widget can be a bar, a line, a pie or a table

**Date:** 2026-08-13
**Area:** `analytics-web` — `WidgetFrame`, `dashboard/widget.ts`
**Status:** **live** on analytic.myceo.ir

## The goal

Amir, on `/dashboards/6/edit`: the widget's «نمایش تصویری» toggle only offers میله‌ای. It should offer
میله‌ای / خطی / دایره‌ای, and the choice should survive a save.

## What it was

The toggle was a two-way chart-or-table switch, and `"chart"` was resolved by a local helper that
always built a **BarChart**. So a report could show a pie on its own page while its widget could not —
the same data, two different ceilings.

## What it is now

`WidgetViewMode` is `"bar" | "line" | "pie" | "table"`, and the view is built with
`presentation/view-switching.ts` — **the same helper the report page uses**, so a bar in a widget and a
bar on a report are one thing rather than two lookalikes that drift.

A picture the data cannot make is shown **disabled** rather than dropped, so the row keeps its shape
from widget to widget; that check is `canRenderTarget`, again shared with the report page.

## Two things that made this smaller than it looked

**The API needed nothing.** `SaveDashboard` takes the widgets as a `JsonArray` and stores
`WidgetsJson` verbatim, so a new `viewMode` string persists with no contract change and no migration.

**Which is also the catch.** Nothing migrates old rows either, so dashboards saved before this still
hold `viewMode: "chart"`. That value is still read, as bar, and a test holds it:

> *still understands «chart», the value already saved in old dashboards*

## Verified

The whole round trip in the browser, not just the click:

| step | result |
| --- | --- |
| the toggle | میله‌ای / خطی / دایره‌ای / جدول, none disabled |
| pick دایره‌ای | 4 bars → 8 pie segments |
| Save | stored `viewMode: "pie"`, success toast |
| reload the edit page | دایره‌ای selected, pie drawn |
| the read-only dashboard | pie drawn, no toggle at all |

422 front-end tests, lint and build clean. Deployed `index-Bn6I_wrR.js` → `index-CZSS6_SI.js`,
container healthy, HTTPS 200.

## Worth knowing

- **`/dashboards/:id/edit` needs the `DashboardDesigner` role**, and the mock user is a bare
  `PowerUser`, so the page 403s locally until `report.mockUser` in localStorage is given the role.
  Nothing is wrong when that happens.
- **A pre-existing flake surfaced while checking this and is NOT from this work.**
  `RequirePermission > renders children when user has the permission` in `AuthProvider.test.tsx`
  passes alone in ~3.2s but takes ~19s under full-suite load against a 10s `testTimeout`, and fails.
  Confirmed unrelated by running the suite with the new test file excluded — it still fails. Raised
  as its own task rather than papered over by raising the timeout, which would hide it and keep the
  suite slow.
