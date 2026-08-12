# Navigation step 2: managing dashboards gets its own page

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** built and checked in a browser — **not deployed**, ships with step 3

Design: [`docs/design/2026-08-12-analytics-navigation.md`](../design/2026-08-12-analytics-navigation.md)

## Goal

Take the management half off `/dashboards` and give it `/manage-dashboards`: the hero and its
counts, the search, «داشبورد جدید», the «همه / داشبوردهای من / اخیر» filter, the cards, and each
card's open / edit / delete menu. Looking at a dashboard is a daily job; renaming or deleting one is
rare, and it was taking room from the widgets on the page people actually use.

`/dashboards` is untouched in this step — it still shows everything. Step 3 strips it, and the two
deploy together.

## A door that answered 403

Three pages each kept their own copy of "can this person manage dashboards", and **each copy
included `ReportDesigner`** — which the routes do not. `RequireRole` on `/dashboards/new` and
`/dashboards/:id/edit` allows `DashboardDesigner`, `TenantAdmin`, `SuperAdmin` only.

So a report designer was shown «داشبورد جدید» and «ویرایش**»**, and got a **403** for using them.

There is now one predicate in [`can-manage.ts`](../../analytics-web/src/features/dashboards/can-manage.ts),
matching what the routes actually permit, used by the builder, the viewer, the list, the new page,
and the sidebar. Confirmed in the browser: as `ReportDesigner`, no create button, no edit button, no
menu entry.

## What the new page does differently

- **A card opens the dashboard** — `/dashboards?d=<id>` — instead of selecting a preview that does
  not exist here. Step 3 is what reads that `?d=`.
- **Delete says whether it worked.** The old card menu called `del.mutate(id)` and reported
  nothing either way.
- **The route is gated** by the same roles as `/dashboards/new`, and the sidebar entry is hidden
  from everyone else, so nobody is shown a door that answers 403.

## Two touch faults carried over with the hero

Both were already wrong on `/dashboards`; moving the markup made them mine.

- **The search box was 14px.** Under 16px, iOS zooms the whole page the moment the field is tapped
  and does not zoom back out. Now `size="large"` — **16px**.
- **The ⋮ button was 24×24**, a bit over half the 44px floor, on the control whose menu holds
  «حذف». Now **44×44** under 768px; the icon is unchanged and desktop keeps its 24px look.

## The fix that did not work, and why

The obvious fix for the input was CSS: `.dash-hero__actions input { font-size: 16px }` in the same
media block as the 44px rule. **The 44px rule applied and the font-size rule did not** — antd's
input takes its size from a rule that out-specifies a two-class selector, so it kept winning.

Chasing it further wasted time and produced contradictory readings; runtime-injected styles and even
an inline `!important` failed to move it, which should be impossible. The answer was to stop
fighting the cascade and use the library's own API. `size="large"` **is** antd's 16px input, and it
matches the «داشبورد جدید» button beside it — search and button are now both 40px tall, which lines
up better than the 32-next-to-40 they had before.

**The lesson, which is now in GOTCHAS:** when antd already has a prop for the thing you are styling,
use the prop. A CSS override of an antd internal is a fight you may quietly lose, and a rule that
does nothing is worse than no rule, because the next person assumes it is handled.

## Checked in a browser

| | |
| --- | --- |
| as `PowerUser` | `/manage-dashboards` → **403**, and no menu entry |
| as `ReportDesigner` | no menu entry, **no create or edit button anywhere** |
| as `DashboardDesigner` | page loads, hero + counts + filter tabs + cards, menu entry selected |
| the page itself | no preview section, no grid canvas — none of it came across |
| card click | `/dashboards?d=dash-exec` |
| ⋮ menu | باز کردن · ویرایش · حذف, delete marked danger, divider above it |
| in the 80px rail | icon centred, 55×48, tooltip «مدیریت داشبوردها» |
| at 700px | one column, nothing wider than the screen, search 16px, ⋮ 44×44 |

`typecheck`, `lint`, `build` clean, detector `[]`. **339 tests pass**, including 7 new ones for the
role predicate — the report-designer case is written down as a test so it cannot come back.

## Left to do

- **Not deployed**, and it should not be alone: `/manage-dashboards` currently duplicates
  `/dashboards`. Step 3 removes the duplication, and the two ship together.
- `?d=` **is not read yet.** A card click sets it and `/dashboards` ignores it, which is step 3's
  job.
