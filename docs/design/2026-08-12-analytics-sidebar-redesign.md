# Design: the sidebar gets a head, and the three main destinations stop being list rows

**Date:** 2026-08-12
**Status:** proposed — not started
**Branch:** `redesign/analytics-sidebar`
**Area:** analytics-web (`analytic.myceo.ir`)

## What you asked for

1. The top of the menu does not feel professional. Perhaps a card showing what this service is —
   or my own call on how to treat that area.
2. «داشبوردها», «مدیریت داشبوردها» and «گزارش‌ساز هوشمند» should not be shown as a flat tree.
3. The rest of the menu is fine and stays as it is.

## About the skill you invoked

`/gpt-taste` is a **landing-page** playbook: AIDA page structure, a hero H1 held to two lines, bento
grids, GSAP scroll-pinning, picsum photography, marquees, a footer CTA. A sidebar in a Persian admin
app has none of those surfaces, so most of it does not apply and pretending otherwise would produce
a worse panel.

**Kept:** refuse the first, laziest layout; real hover and press physics; no cheap meta-labels; exact
button and text contrast; drawn icons, never glyphs; one authored motion moment rather than effects
scattered everywhere.

**Dropped, and why:** the hero and bento rules describe pages, not panels. GSAP is not a dependency
here and **framer-motion already is**, used in three files — adding a second animation library for a
sidebar would be indefensible. And the font list (Satoshi, Cabinet Grotesk, Outfit, Geist, "never
Inter") is Latin-only: this interface is Persian and set in **Vazirmatn**. Swapping it would break
the language. The type stays.

## What is actually wrong today

**Nothing sits above the menu.** `<Sider>` renders the menu directly, so the panel begins with a
clickable row hard against the top edge. That is the whole reason it reads as unfinished — there is
no mark, no name, nothing that says which of the eight services you are standing in. When people
jump between services through the launcher, the sidebar never confirms where they landed.

**And the three primaries are three more rows.** «گزارش‌ساز هوشمند» already fights this with a
green pill, which is a patch over the same problem: the list gives a daily destination and a
rarely-touched one identical weight.

## A naming collision to settle first

| where | text |
| --- | --- |
| `common.appName` | «گزارش‌ساز هوشمند» |
| `nav.ask` (a menu item) | «گزارش‌ساز هوشمند» |
| `index.html` title | «سامانه گزارش‌گیری و تحلیل هوشمند» |

**The app name and a menu item are the same words.** A header built from `appName` would print the
name of a button sitting a few rows below it. The head will use the fuller service name and a short
descriptor; `nav.ask` keeps its own label.

## The direction

Two blocks above the existing list, then the list untouched.

```
┌────────────────────────────────┐
│  ▣   تحلیل داده                │   the head — mark, service, one line of what it is
│      گزارش‌گیری و تحلیل هوشمند  │
├────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐   │   the three primaries as tiles, not rows
│  │ داشبوردها │  │  مدیریت   │   │
│  └──────────┘  └──────────┘   │
│  ┌────────────────────────┐   │
│  │   گزارش‌ساز هوشمند  ✦   │   │   full width — it is the one that makes something
│  └────────────────────────┘   │
├────────────────────────────────┤
│  محتوا                          │   everything below is exactly as it is today
│  گزارش‌ها                        │
│  …                              │
└────────────────────────────────┘
```

**Why tiles rather than a fancier pattern.** A horizontal accordion or an expanding stack would look
impressive in a screenshot and cost you time on every one of the fifty clicks a day these three
take. This is a tool, not a landing page: the trio get *weight* — bigger targets, their own surface,
their own rhythm — without adding a step to reach them.

**Why two-up then one-wide.** It is not decoration: it encodes what the items are. The first two are
a pair, the same subject at two altitudes (look at dashboards / manage them). «گزارش‌ساز هوشمند» is
a different act — it makes something new — so it gets its own full-width row and keeps the accent it
already has. The grid says that without a label saying it.

**Motion, once.** A single brand chip slides between the active tile using framer-motion's shared
layout, so moving between the three is one continuous object rather than three separate repaints.
That is the one authored moment; everything else is hover and press.

## The collapsed rail

The rail is 80px and was built four commits ago. It must not regress:

- the head becomes the mark alone, centred, with the service name in its tooltip;
- the three tiles become three icon buttons at the same 55×48 the other items use, keeping the
  cluster's tint so the grouping survives without words;
- the divider that stands in for group titles stays.

## Steps

| Step | What | Ships |
| --- | --- | --- |
| 1 | The head — mark, service name, descriptor, both widths | on its own |
| 2 | The three primaries as tiles, with the sliding indicator | with 3 |
| 3 | The rail: head and tiles at 80px | with 2 |
| 4 | Contrast, targets, keyboard, dark mode, phone; then the detector | on its own |

Steps 2 and 3 are one component and go together.

## What could go wrong

- **Dark mode.** The tint that separates the cluster from the list has to work on `#15211d` as well
  as white, and the app has a real dark theme. It gets checked in both, not just the one on screen.
- **`Menu` is antd's, and antd fights CSS.** Twice this week a rule lost silently to an injected
  antd style. The tiles will be **our own markup above the `Menu`**, not antd menu items bent into a
  grid — so there is nothing to out-specify.
- **The rail.** Every change here has to be re-measured at 80px; the icons were 34px off centre once
  already.
- **RTL.** The grid is `grid-template-columns`, which follows `direction`, so the pair orders itself
  correctly — but it gets checked rather than assumed, like the tab strip did.
