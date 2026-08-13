# Typing in a filter gave «خطا در بارگذاری گزارش»

**Date:** 2026-08-13
**Area:** `analytics-web/src/features/viewer` — `FilterBar`, `ReportViewer`
**Status:** **live** on analytic.myceo.ir

## What happened

Amir asked two things about the filter row on `/reports/3`: did the AI create it, and why does typing
in it end in «خطا در بارگذاری گزارش».

**Yes, the AI created it.** `FilterBar` renders one control per entry in the report's
`definition.filters`, and the `between` on «تاریخ درج در ظرفیت» is exactly what the worked example in
`BuildSystemPrompt` teaches the model to write:

```json
{ "field": "RegDate", "operator": "between", "value": ["1405/01/01", "1405/12/30"] }
```

**And that is why it broke.** `FilterBar` rendered one control per filter and **ignored the
operator**. A `between` carries two bounds, so one box replaced both with a single string and left
half a range.

## The error was right; the bug was older

That half range always produced a wrong query. It used to fail **silently** — `BETWEEN @p0 AND NULL`
matches no row and raises nothing, so the report just came back empty. Earlier the same day the
engine started refusing a half range outright, on the reasoning that *an empty report that looks like
real data is worse than an error*. The silence became an error message, and the error is what got the
bug reported.

**A change that turns a silent wrong answer into a loud one will look like it caused the problem.**
It did not. It made a filter that had never worked visible for the first time.

## The three fixes

- **A range gets two boxes**, prefilled with the bounds it already has; editing one keeps the other.
  A real `date` field gets two pickers — but a Jalali date is **text** in the warehouse, so it stays a
  pair of boxes, which is correct: a Gregorian picker cannot express 1405.
- **Emptying a filter means "do not filter"**, not "match nothing". Sent as written it became
  `col = NULL`, or half a range, so clearing a box returned an empty report instead of every row.
- **The bar renders every filter the report defines**, not only the ones currently narrowing the
  query. This one was a sting in the tail of the fix above: the bar was built from the pruned
  definition, so clearing a filter deleted its own control and left no way to type again.

## Verified

In the browser, against a real `between` filter:

| | boxes | values | result |
| --- | --- | --- | --- |
| on load | 2 | `A` / `Z` | prefilled, no error |
| typed one bound | 2 | `B` / `Z` | other bound kept, **no error** |
| cleared both | 2 | empty | full report returns, boxes stay |
| typed again | 2 | `A` / — | works |

415 front-end tests, lint and build clean. Deployed: `index-CxNa7aRj.js` → `index-DRa2hYQy.js`,
container healthy, HTTPS 200.

## Worth knowing

- **A local fixture can be wrong in a way that looks like a bug.** The first temporary filter I added
  to reproduce this pointed at `orderDate` on a report whose dataset is `projects`. The page showed
  the very error I was chasing — before typing anything. The fixture was invalid, not the code. Check
  that a reproduction reproduces the *right* failure.
- **A browser tab can change origin without you noticing.** A `localStorage` clear meant for the dev
  server ran against production. Only app-managed keys matched (locale, theme, tenant cache); the
  OIDC token did not, so nobody was signed out. Name the origin in the command, or assert it before
  writing anything.
