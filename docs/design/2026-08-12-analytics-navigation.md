# Design: a sidebar you can fold, and dashboards split from managing them

**Date:** 2026-08-12
**Status:** proposed — not started
**Area:** analytics-web (`analytic.myceo.ir`)

## What you asked for

1. **A standard collapsible menu.** Full view shows icon + words; the small view shows **only icons,
   with a tooltip** on hover.
2. **`/dashboards` shows only the dashboard.** The one section titled «نمای داشبورد انتخاب‌شده»,
   with a **tab per dashboard** — pick a tab, see that dashboard.
3. **Managing moves out** to its own page, **`/manage-dashboards`**.

## What you chose

| Question | Your answer |
| --- | --- |
| The hero — title, counts, search, «داشبورد جدید» | **Move all of it to manage.** `/dashboards` is tabs and the dashboard, nothing else. |
| Where «مدیریت داشبوردها» lives | **A sidebar item**, hidden from people who cannot manage. |
| The «همه / داشبوردهای من / اخیر» filter | **Moves to manage only.** `/dashboards` lists every dashboard you can see. |

## What is already there

| Piece | Today |
| --- | --- |
| `sidebarCollapsed` + `toggleSidebar` | **Already written, persisted, and unit-tested — and nothing calls it.** The `<Sider>` is already `collapsible` with `trigger={null}`. Dead wiring waiting for a button. |
| `Sidebar.tsx` | antd `Menu mode="inline"`, groups with `type: "group"` titles, RBAC filtering per item. |
| `DashboardList.tsx` | **One 300-line page doing four jobs**: hero, filter tabs, a grid of cards, and the selected-dashboard preview. |
| `/dashboards/:id` | `DashboardViewer` — a read-only single dashboard. Already exists. |
| `/dashboards/:id/edit` | `DashboardBuilder` — the real editor. Already exists, role-gated. |
| Mobile | Under `md` the sidebar is not a sider at all; it is a `Drawer`. |

The fourth job — the preview — is the only one you want left on `/dashboards`. Everything else in
that file moves.

## Step 1 — the collapse control

The state exists, so this is a button and the small-view details.

**The trigger.** A button in the `Topbar`, at the start of the bar next to the org picker, so it sits
in the same place whether the sidebar is open or shut. `MenuFoldOutlined` / `MenuUnfoldOutlined`,
mirrored for RTL. It carries `aria-label` and `aria-expanded`, and a tooltip naming what it does.

**The small view is 80px**, antd's `collapsedWidth`. Icons centred, words gone.

Three things break in a collapsed antd menu and each needs handling:

- **Tooltips.** antd's `Menu` reads the `Sider`'s collapsed state from context and shows a tooltip
  per item on its own — but only for items whose `label` is a plain string. Ours are, so this is
  free. It will be checked in the browser rather than assumed.
- **Group titles.** «محتوا», «داده», «خروجی» render as squashed text in an 80px rail. When collapsed
  the groups flatten to plain items and the titles are dropped, with a divider keeping the grouping
  visible.
- **The «گزارش‌ساز هوشمند» item** is styled as a featured pill. At 80px the pill has no room for
  words; it becomes an icon-only accent that keeps its colour.

**Not on mobile.** Under `md` the sidebar is a drawer, and a fold button there would be nonsense —
the trigger is hidden and the drawer keeps its own close button.

The choice is remembered — `sidebarCollapsed` is already persisted to `localStorage`.

## Step 2 — `/manage-dashboards`

A new route and a new page, `ManageDashboards.tsx`. It receives, almost unchanged, the four pieces
being lifted out of `DashboardList`:

- the hero — title, «١ داشبورد / ٢ ویجت» counts, search, «داشبورد جدید»
- the «همه / داشبوردهای من / اخیر» filter tabs
- the grid of dashboard cards
- each card's ⋮ menu: open, edit, delete

Two changes while moving:

- **A card's main click now opens the dashboard** (`/dashboards`, that tab selected) instead of
  selecting a preview that no longer exists on this page.
- **The route is role-gated** with the existing `RequireRole` for `DashboardDesigner`,
  `TenantAdmin`, `SuperAdmin` — the same roles that already gate `/dashboards/new`. The sidebar item
  is hidden for everyone else, so nobody is shown a door that gives them a 403.

## Step 3 — `/dashboards` becomes the viewer

`DashboardList.tsx` loses everything except the preview and gains the tab strip.

```
┌──────────────────────────────────────────────┐
│  فروش  │  عملکرد  │  داشبورد جدید  │  …      │   ← one tab per dashboard
├──────────────────────────────────────────────┤
│                                              │
│   the dashboard's widgets                    │
│                                              │
└──────────────────────────────────────────────┘
```

- **The tab strip is the picker.** antd `Tabs` already scrolls with arrows when the tabs outgrow the
  row, so a long list degrades on its own; no extra control is needed until it is.
- **The tab you were on is remembered** in the URL as `/dashboards?d=<id>`, so a dashboard can be
  linked, bookmarked, and survives a reload. Falls back to the first tab.
- **The «حالت ویرایش» toggle and «ذخیره» stay.** You use them, and dragging widgets is the whole
  point of the page. They stay gated to people who can manage.
- **No dashboards at all** → an empty state that offers «مدیریت داشبوردها» to people who can manage
  and explains the situation to those who cannot.

`/dashboards/:id` (`DashboardViewer`) keeps working and is left alone.

## Step 4 — the design and phone pass

With `impeccable`, over both pages and the collapsed rail:

- the rail at 80px: icons on one line, tooltips readable, nothing clipped
- keyboard: the fold button reachable, focus visible, tab order sane
- the tab strip on a phone — it must scroll, not wrap into a stack
- contrast on the tabs, the rail, and the selected states
- the mechanical detector over every changed file

## Decisions worth naming

**Why a separate route instead of a tab on the same page.** Viewing and managing are different jobs
with different frequencies: you look at a dashboard daily, you rename or delete one rarely. Putting
the rare job on the same screen as the common one is what pushed the widgets below the fold in the
first place — in your screenshot the actual charts start well past the halfway mark.

**Why the words disappear rather than shrink.** An 80px rail with 9px Persian text is worse than no
text. Icon plus tooltip is the pattern every tool in this class uses, and it is the one you asked
for.

**Why the layout editor stays on the view page.** It could have been pushed to
`/dashboards/:id/edit`, which already exists. It stays because you are visibly using the inline
toggle, and because the drag bug fixed this morning made it work properly for the first time —
taking it away in the same week would be a strange trade.

## What could go wrong

- **`DashboardList` is imported by name in the router and in tests.** Splitting it means touching
  `router.tsx`, `features/dashboards/index.ts`, and any test that renders it. Cheap, but it must all
  move together or the build breaks.
- **`dashboard-canvas--readonly`** is applied by hand on a wrapper div in `DashboardList` *and*, as
  of this morning, by `DashboardCanvas` itself. The duplicate goes away with step 3.
- **The tab strip and RTL.** antd `Tabs` in RTL scroll the other way; the arrows must be checked in a
  browser, not assumed. This app has already been bitten once this week by a library that ignored
  `dir="rtl"`.

## The steps

| Step | What | Ships |
| --- | --- | --- |
| 1 | The collapse control and the 80px rail | on its own |
| 2 | `/manage-dashboards` — the lifted-out management page | with 3 |
| 3 | `/dashboards` — tabs plus the dashboard | with 2 |
| 4 | Design and phone pass over all of it | on its own |

Steps 2 and 3 are one cut of the same file and deploy together; the route would otherwise be broken
in between.
