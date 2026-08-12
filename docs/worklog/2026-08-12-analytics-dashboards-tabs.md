# Navigation step 3: /dashboards is just the dashboard

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** built and checked in a browser — **not deployed**; ships with step 2

Design: [`docs/design/2026-08-12-analytics-navigation.md`](../design/2026-08-12-analytics-navigation.md)

## Goal

Strip `/dashboards` down to a tab per dashboard and the dashboard itself. You marked four things to
go — the hero, the search, «داشبورد جدید», the «همه / داشبوردهای من / اخیر» filter and the cards —
and asked for **«حالت ویرایش» to start off**.

## What the page is now

```
داشبورد مدیریتی │ فروش │ …            حالت ویرایش ○  ذخیره  ویرایش
──────────────────────────────────────────────────────────────────
۱ ویجت گزارش
[ widgets ]
```

The toolbar rides **inside the tab bar** rather than on a row of its own, which is what gets the
widgets high on the page. They now begin **118px** below the top of the content area; before, four
stacked blocks — hero, filter tabs, card grid, then a heading — sat above them.

**Edit mode starts off, and turns itself off again** when you switch dashboard. The page is for
looking; a stray drag should not move anything until you say so. «ذخیره» stays disabled until the
switch is on.

**The tab is in the URL** as `/dashboards?d=<id>`, so a dashboard can be linked, bookmarked and
survives a reload. An id that no longer exists falls back to the first tab rather than showing
nothing.

`DashboardList.tsx` is gone. It was a list, a filter, a card grid and a viewer in one 300-line file;
what is left is `DashboardsPage.tsx`, and the name now says what it is.

## The heading you cannot see

The tab already prints the dashboard name in large type. Repeating it as a visible `<h2>` directly
underneath was pure duplication and pushed the widgets down — so the visible one is gone, and the
name is an `sr-only` `<h1>` instead. The document keeps a heading for a screen reader, the eye is not
told the same thing twice, and the tab panel is still named by its tab.

The «نمای داشبورد انتخاب‌شده» eyebrow above it is also gone. It earned its place when cards sat above
the section and you needed telling which one was showing; with a tab strip it only repeats what the
selected tab already says.

## Checked with 14 dashboards, which is where a tab strip usually breaks

The design doc flagged RTL tab overflow as the risk. With 14:

- antd clips the strip (`overflow: hidden`) and adds a **«…» menu listing the 9 that do not fit** —
  all 14 stay reachable, and **the page never scrolls sideways**.
- The «…» menu opens on **hover**, not click. A click test reported it broken; that was the test,
  not the code.

## Two touch faults, found only by measuring

At 700px the toolbar and the tabs were fighting for one row:

| | before | after |
| --- | --- | --- |
| room for the tab strip | 313px of 700 | **612px** |
| «ذخیره» / «ویرایش» height | 32px | **44px** |
| the edit switch | **28×16** | 44×22 |

The switch was `size="small"` — a 28×16 target on the same row as «ذخیره». Dropping `small` gives
antd's normal switch. Under 768px the toolbar now takes its own line instead of squeezing the tabs.

## Left to do

- **Not deployed.** Steps 2 and 3 are one change and go together.
- **The switch is 44×22.** The width clears the touch floor, the height does not, and 22px is what
  antd's `Switch` draws. Worth deciding in step 4 whether a labelled toggle button is better here —
  a button can be 44×44 and would say what it does.
- **The detector flags one advisory**, a two-axis grid-line background in `global.css:29`. It is
  **byte-identical in `HEAD`** — the app's established ambient backdrop, not something this change
  introduced — so it was left alone.
- The dashboard card's accessible name on `/manage-dashboards` reads as the name plus every meta tag
  («داشبورد مدیریتی ۱ ویجت آرش مدیری ۱۴۰۵/۰۴/۰۱»). Inherited, verbose, not fixed here.

## How it was checked

`typecheck`, `lint`, `build` clean. **349 tests pass**, 19 of them new: ten for this page — including
one that fails if the hero, the search, the create button or the cards ever come back — and the old
list tests re-pointed at `/manage-dashboards`.

In a browser at 1400px and 700px: the four removed blocks are absent, one tab per dashboard, the
toolbar in the tab bar on desktop and on its own row on a phone, edit off by default and off again
after switching tabs, `?d=` written on tab change, and nothing scrolling sideways at either width.
