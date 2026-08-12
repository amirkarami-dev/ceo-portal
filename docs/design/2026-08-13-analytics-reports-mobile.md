# Design: the reports pages on a phone

**Date:** 2026-08-13
**Status:** proposed — not started
**Area:** analytics-web — `/reports` and `/reports/:id`

## What the check found

Measured on production at a real 375 × 812, signed in.

Both pages get the **mechanics** right: neither scrolls sideways, and both tables scroll inside
their own box rather than dragging the page with them. What is wrong is that a layout built for
1400px is being *shown* at 375px without being *rearranged* for it.

### `/reports` — every column is a sliver

| column | width at 375px |
| --- | --- |
| **نام گزارش** — the thing you came for | **67px**, wraps, 91px-tall rows |
| مالک | 55px |
| مدل داده | 61px |
| **برچسب‌ها** — empty for every row today | **73px** |
| **دید** — one short word | **81px**, the widest of all |
| آخرین اجرا | 66px |

An empty column takes more room than the report name; a one-word tag takes the most of anything.
Reaching the ⋮ menu costs **164px of horizontal swiping**.

### `/reports/:id` — the metadata strip eats the screen

`Descriptions` is fixed at `column={3}`, so each fact gets **96px** and wraps down instead of across:

| | height |
| --- | --- |
| مالک | 66px |
| مدل داده | 88px |
| آخرین بروزرسانی | **198px** |

Roughly 200px of an 812px screen for three short facts. **This got worse yesterday**: adding the
time to «آخرین بروزرسانی» is what pushed that cell to 198px, so part of this is mine to undo.

### Touch and input, both pages

| | now | floor |
| --- | --- | --- |
| library search font | **14px** | 16px, or iOS zooms the page on tap and never zooms back |
| «گزارش جدید», both filter selects | 32px tall | 44 |
| viewer toolbar — به‌روزرسانی / ویرایش در Ask AI / خروجی | 32px tall | 44 |
| view switcher segments | 28px tall | 44 |
| row ⋮ actions | 32 × 32 | 44 |
| search clear ✕ | 12 × 12 | 44 |

## The direction

**A table is the wrong shape for six attributes on a 375px screen.** Below `md` the library shows a
card per report instead — the same move `/manage-dashboards` already makes, with the same
`grid-template-columns: minmax(0, 1fr)` collapse, so this is adopting a pattern rather than
inventing one.

```
┌──────────────────────────────┐
│ تعداد مهندسان هر رشته      ⋮ │   name gets the full width
│ کاربر سازمان · oz_info        │   owner and model, one quiet line
│ [خصوصی]  آخرین اجرا: —        │   the tags that exist, and the date
└──────────────────────────────┘
```

**Why cards and not "hide some columns".** Hiding columns keeps the horizontal scroll and still asks
someone to swipe for what is left. A card gives the name the whole width, which is the one thing
every row is really about, and drops the empty columns instead of reserving 73px for them.

**Nothing is lost.** Every field on the table appears on the card; the ones with no value simply do
not render, which is exactly why the card is shorter than the row it replaces.

**The desktop table does not change.** Same columns, same sorters, same actions above `md`.

For the viewer, `Descriptions` takes `column={1}` below `md`. antd accepts a responsive object, so
this is a prop, not a media query — the same lesson as `size="large"` on the search box: if antd has
the mechanism, use it.

## Steps

| Step | What |
| --- | --- |
| 1 | The touch and zoom fixes on both pages — the unambiguous ones |
| 2 | `/reports` becomes cards below `md` |
| 3 | The viewer's metadata strip goes to one column below `md` |
| 4 | Measure both pages again at 375, and the detector |

Step 1 first because it is the part with no design decision in it, and it can ship on its own if
the card work turns out to want another conversation.

## What could go wrong

- **antd `Table` owns its own responsive behaviour.** The card list will be *our* markup rendered
  instead of `DataTable`, not a `Table` bent into cards — the same call as the sidebar tiles, and for
  the same reason: three separate rules lost silently to antd's injected CSS this week.
- **Sorting and paging live in `DataTable`.** The card list needs its own paging, or none. With two
  reports today it needs none, but a hard cap would hide rows silently — the card list will page with
  the same `pageSize` the table uses.
- **`Grid.useBreakpoint` returns `{}` on the first render** in jsdom and briefly in the browser,
  which reads as "phone". `AppLayout` already lives with that; here it would flash a card list on
  desktop, so the check has to be `screens.md === false`, not `!screens.md`.
