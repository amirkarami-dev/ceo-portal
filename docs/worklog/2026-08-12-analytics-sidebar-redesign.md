# Sidebar redesign: a head, three tiles, and a tab order that was backwards

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** on analytic.myceo.ir — merged from `redesign/analytics-sidebar` and checked on production

Design: [`docs/design/2026-08-12-analytics-sidebar-redesign.md`](../design/2026-08-12-analytics-sidebar-redesign.md)

## Goal

The top of the menu did not feel professional, and the three main destinations were being
shown as a flat list. Everything below them was fine and stays untouched.

## Why the top felt unfinished

**Nothing was there.** `<Sider>` rendered the menu directly, so the panel began with a clickable row
hard against the top edge — no mark, no name, nothing saying which of the eight services you were
standing in after using the launcher. The menu was also `height: 100%`, which leaves no room for
anything above it.

The head uses the **same name and mark the launcher already uses** for this service, so clicking
«تحلیل داده» there and arriving here shows the same two things. Not a card, despite the brief asking
for one: the sider is already a surface and a box inside it is a card within a card. It earns its
place with a tint that fades out, its own spacing, and the rule the menu starts under.

## The three destinations

They were three more rows in the same list as «تنظیمات» and «پروفایل» — a daily job and a
rarely-touched one at identical weight. «گزارش‌ساز هوشمند» already fought that with a green pill,
which was a patch over exactly this. The pill is gone, along with the `featured` flag and the CSS
that existed only to draw it.

The pair sits on the top row because they are **one subject at two altitudes**; «گزارش‌ساز هوشمند»
takes its own row because it is a different act — it makes something. The grid says that, so no
label has to. With the manage tile hidden by role, the remaining one fills the row instead of sitting
beside a gap.

They are `Link`s, so middle-click and open-in-new-tab work; antd's `Menu` cannot do that, which is
why the rest of the list still cannot. A chip marks the active one and framer moves it between tiles
with `layoutId` — one object travelling, not three repaints — collapsing to an instant swap under
`prefers-reduced-motion`.

## The finding that mattered most

The tiles are the primary navigation of the app. On a keyboard they landed at **tab positions 14, 15
and 16** — *after* every export button on the page.

The cause was in the shell, not the sidebar. In Persian the sider was rendered **after** the main
column and pushed back to the right with `flex-direction: row-reverse` — two mechanisms cancelling
into the right picture, and the picture was right, so nobody noticed. `direction: rtl` already puts
the first child of a flex row on the right; the reversal was never needed.

One code path now, sider first in both languages:

| | before | after |
| --- | --- | --- |
| tiles in tab order | 14, 15, 16 | **0, 1, 2** |
| navigation before content | no | **yes** |
| sider side, rtl / ltr | right / left | right / left — unchanged |

Two tests guard it, because a change that looks identical on screen is exactly the kind that gets
undone.

## Dark mode, which the plan predicted would break

`--rw-primary-ink` is a deep green chosen to be legible on white. On the dark panel it falls to
**2.8:1** and the icons nearly vanish.

It flips now — deep on light, the brand itself on dark, where it reads at **6.06:1** — and a second
token, `--rw-primary-solid`, keeps the fills that carry white text dark in *both* themes, because
white on the brand green is 2.54:1 whatever sits behind it.

**That also repairs the sidebar's selected item and the hero chips in dark**, which have been
shipping wrong since this morning's polish pass: contrast was checked in light only.

## Measured

| | light | dark |
| --- | --- | --- |
| service name | 16.56 | 12.23 |
| tagline | 6.98 | 7.67 |
| head glyph on its mark | 5.48 | 5.48 |
| active tile label on chip | 5.48 | 5.48 |
| inactive tile label | 15.79 | 11.44 |
| inactive tile icon | 5.18 | **6.06** (was 2.8) |

Also: RTL puts «داشبوردها» rightmost and LTR puts the mark before the text; the 80px rail gives
three 63×48 tiles with icons dead centre and tooltips, and the head keeps its mark alone; the drawer
shows one header rather than two and every tile clears 44px; the admin zone keeps the head and drops
the tiles; nothing scrolls sideways at 1400 or 700. Detector `[]`, **358 tests pass**, 8 of them new.

## Two things not done, and one not seen

- **The panel does not stay put on a short screen.** At 520px tall the sider grows with the page and
  the head scrolls away with it. That is how it behaved before this work too — the menu was
  `height: 100%` inside a sider that already grew — so it is not a regression, but a sticky sider
  with an internally scrolling menu would be better. It is a change to the shell's scroll model,
  which is more than a polish pass should quietly take on.
- **The antd `Tabs` colour on the dashboards pages does not flip.** It is a JS constant
  (`primaryInk`) passed to `ConfigProvider`, not a CSS variable, so in dark mode those tab labels
  keep the light-mode green. That is on `main`, shipped this morning, and wants fixing there rather
  than on this branch.
- **Neither the focus ring nor the chip's travel was ever seen.** The ring is defined and the tiles
  are first in the tab order; framer applies `matrix(1, 0, 0, 1, -111.6, 0)` — exactly one tile's
  distance — before snapping to `none`, because this browser pane does not composite frames, so the
  spring finishes in a single tick. Both mechanisms are proven; the smoothness needs a real screen.
