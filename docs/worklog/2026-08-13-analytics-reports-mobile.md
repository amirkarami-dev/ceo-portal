# The reports pages on a phone

**Date:** 2026-08-13
**Area:** `analytics-web` — `/reports` and `/reports/:id`
**Status:** **live** on analytic.myceo.ir (deployed 2026-08-13)

## The goal

The user asked to check the reports pages on a phone, then to fix everything the check found.
Design doc first: [`docs/design/2026-08-13-analytics-reports-mobile.md`](../design/2026-08-13-analytics-reports-mobile.md).

Four steps, one at a time:

1. touch targets and the zoom trap
2. `/reports` becomes cards below `md`
3. the viewer's metadata strip goes to one column
4. measure both pages again, and run the detector

## What was wrong

The pages were **shown** at 375px but never **rearranged** for it.

On `/reports`, six table columns split the screen into slivers. The report name — the one thing
every row is about — got **67px** and wrapped into 91px-tall rows, while an empty tags column took
**73px** and a one-word «دید» took **81px**. Reaching the ⋮ meant **164px of sideways swiping**.

On `/reports/:id`, `Descriptions` was pinned at `column={3}`, so each fact got 96px and wrapped
downwards instead of across. «آخرین بروزرسانی» alone was **198px tall** — about a quarter of the
screen for one date. That one was mine: adding the time to the date the day before is what pushed
it there.

Everything you tap was built for a mouse: the search box at 14px (which makes iOS zoom the page in
on tap and never zoom back), buttons and selects at 32px, the view switcher at 28px, the row ⋮ at
32×32, the clear ✕ at 12×12. A finger needs 44.

## What changed

**Touch and zoom** — `analytics-web/src/theme/global.css`. One block under `max-width: 768px` lifts
buttons, selects and inputs to 44px, gives the segmented control a 44px item, and grows the clear
✕'s *hit area* to 44 while the glyph stays 12. Scoped to `main`, so menus, tooltips and modals — which
render in a portal at the end of `<body>` — keep antd's own sizing.

The search box did **not** take a CSS `font-size: 16px`, even with `!important`. antd injects its
component CSS at runtime, after the app stylesheets, so an equal-specificity rule loses silently.
`size="large"` — antd's own API — worked first try.

**A card per report below `md`** — `ReportLibrary.tsx` + `reports.css`. Our own markup rendered
instead of `DataTable`, not a `Table` bent into cards. The name gets the full width; fields with no
value simply do not render, which is why the card is shorter than the row it replaces. The shape
follows `.dash-card` on `/manage-dashboards` on purpose — same radius, hairline and accent — so the
two lists read as the same kind of thing. The desktop table is untouched.

**One column of metadata below `md`** — `ReportViewer.tsx`: `column={{ xs: 1, sm: 2, md: 3 }}`. A
prop, not a media query fighting antd's layout. Same lesson as `size="large"`.

**Readable labels** — `theme.ts`. Found while measuring, see below.

## Two things the measuring pass found

**The `Descriptions` label was too faint to meet the floor.** antd labels a row with the *tertiary*
text colour, which is 45% alpha in both themes: **3.35:1** on the white panel, **4.39:1** on the dark
one. A 14px label needs 4.5. «مالک» and «مدل داده» are the words that say what the value beside them
means, so they have to be readable. Set through antd's own component token to the secondary colour —
the same grey family one step darker — giving **6.98:1** and **7.67:1**.

This is the third time this week that `rgba(…,0.45)` has been the culprit; it is the same token that
made the sidebar divider vanish at 1.19:1. **45% alpha is too little for text.**

`theme.test.ts` now blends the label colour onto the panel and asserts ≥ 4.5 in both themes. It was
checked by putting antd's 45% back: it failed at **3.3517**, matching the browser's measured 3.35 —
so the test's maths agrees with the real page.

**A card edge that measured 1.11:1 but is not a problem.** In dark the card background is the same
colour as the page, and the hairline is 1.11:1 against it. The number says invisible. The screenshot
says otherwise: the 3px brand accent runs the full height of every card at **4.96:1**, with a 12px
gap between cards. The accent is what separates them; the hairline is quiet on purpose and matches
`.dash-card`. **Left alone** — this was nearly a change made on a number without looking at the page.

## Measured after, at 375 × 812

| | `/reports` | `/reports/:id` |
|---|---|---|
| sideways scroll | none | none |
| elements past the right edge | 0 | 0 |
| targets under 44px | none | none |
| metadata block height | — | **85px** (was ~200 for the date alone) |
| report name contrast | 16.56 light / 12.23 dark | — |
| label contrast | — | 6.98 light / 7.67 dark |

Both themes, both directions. In LTR a hit-test confirms the ⋮ takes its own 44×44 and every other
point on the card opens the report — the logical properties (`padding-inline-end`, `inset-inline-end`)
place it correctly without a `[dir="rtl"]` copy of the rule.

Full suite: 370 tests pass. Build clean. The anti-pattern detector flags one thing in `global.css` —
the ambient grid backdrop — which is pre-existing, app-wide, and outside this task.

## Decisions worth keeping

- **Cards, not hidden columns.** Hiding columns keeps the sideways scroll and still asks someone to
  swipe for what is left.
- **The card list pages at 12, like the table.** A hard cap would drop rows silently.
- **The page number is clamped, not reset.** Filtering down to one match while on page 3 produced a
  blank page — no cards, no empty state. Deleting the last report on the final page does the same
  thing, so the guard belongs on the page number, not on a filter-changed effect that would only
  cover one of the two causes.
- **`screens.md === false`, not `!screens.md`.** `Grid.useBreakpoint()` answers `{}` on the first
  render and `!undefined` is true, which would flash the card list on a desktop load.
- **`PageContainer`'s 24px gutter left alone.** 19% of a 375px screen goes to gutters, but that
  component is used by every page in every app — out of scope here.

## Deploy

Incremental: only `analytics-web` changed, and nothing shared (no `AppSwitcher`), so one image was
rebuilt and one container recreated. `vng-analytics` and the other ~45 containers on the shared box
were not touched.

Verified after: container healthy, HTTPS 200, and the served bundle went from `index-CWWCHqGo.js` /
`index-DvPdZTV-.css` to `index-rgP6uZCW.js` / `index-0irK965-.css` — checked over the real domain,
not just inside the container. The CSS hash matches the local build byte for byte. The bundle
contains the card rules, the 44px touch block and the new label colour.

## What is left

- **The live signed-in pages have not been looked at.** The deploy is confirmed at the bundle level
  only; `/reports` and `/reports/:id` behind the login were measured on the dev server, not on
  production after this deploy.
- The phone check has only ever run in the browser pane. Nobody has held this on a real phone, so
  the iOS zoom behaviour in particular is reasoned from the 16px rule, not seen.
