# Opening a report from the library said it did not exist

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** — fixed and checked signed in on production

## What was reported

`/reports` listed both reports. Clicking one — `/reports/2` — answered **«گزارش یافت نشد»**.

## Root cause

There is no `GET /api/Reports/{id}` on the backend, so the client fetches the whole list and finds
the match itself:

```ts
const found = items.find((r) => r.id === id);   // 2 === "2"
```

The two sides were never the same type. `SavedReportDto` declares **`int Id`**, so the JSON carries
`2`; a route param is always the string `"2"`. `===` says no, the lookup returns `null`, and the
viewer renders its 404.

`BackendSavedReport` claimed `id: string` — a shape TypeScript cannot check against a network
response, so the lie held until something compared the two.

## Why it looked arbitrary

**Dashboard widgets kept working.** A widget stores the `reportId` it was handed when it was added —
a number, straight from the same list — so its lookup was number against number and matched. The
same report drew fine inside a widget and refused to open from the library.

Dashboards themselves were never affected at all: they call a real `GET /api/Dashboards/{id}` and
the server does the matching. That is why `/dashboards/6/edit` has always worked.

## The fix

The conversion happens once, where the number arrives, so every `SavedReport` leaves the module with
a string id — which is what route links, table keys and widget `reportId`s all assume.

The lookup compares **both sides as strings**, deliberately: dashboards saved before this fix hold a
numeric `reportId`, and those widgets have to keep resolving. Verified on production — both widgets
still render after the change.

## Fixed alongside, same root cause

`save()` read `resp.id` off a response that is a bare number. The endpoint is `Task<Ok<int>>`, so the
body is `7`, not `{ "id": 7 }` — the returned object carried **`id: undefined`**. Nothing reads it
today, because the modal only closes and the list refetches, but it is a trap for whoever first
navigates to a newly saved report.

## Checked

Five tests against the real adapter using the shape the backend actually sends. **Three of them fail
on the old code** — confirmed by reverting the fix, watching them go red, and restoring it. One
covers the numeric-id case that existing dashboards depend on.

On production, signed in:

| | |
| --- | --- |
| `/reports/2` | opens — «تعداد مهندسان هر رشته», data renders |
| `/reports/1` | opens — «تعداد اعضا به تفکیک رشته و حقیقی/حقوقی», table of **15 rows** |
| `/dashboards` | both widgets still resolve, neither in an error state |
| console | clean |

**359 tests pass.**

## One thing that looked like a second bug and was not

`/reports/1` first appeared to render nothing — no chart, no table, no error, not loading. The
`echarts-for-react` container was the right size and had built its inner div, but there was no
`canvas` in it.

Switching that report to the table view drew 15 rows with the right headers, so the data and the
execution were fine all along: **ECharts paints to canvas, and the browser pane used for checking
does not composite frames.** The same reason the sider's width transition and the sidebar chip's
travel could not be watched either. Nothing to fix.
