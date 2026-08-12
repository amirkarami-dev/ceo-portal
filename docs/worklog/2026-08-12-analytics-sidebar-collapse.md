# Navigation step 1: a sidebar you can fold

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** on analytic.myceo.ir

Design: [`docs/design/2026-08-12-analytics-navigation.md`](../design/2026-08-12-analytics-navigation.md)

## Goal

Step 1 of three. A standard fold control: the full menu shows icon and words, the small one shows
**only icons, each with a tooltip**.

## The machine was already built — nobody wired the switch

`sidebarCollapsed` and `toggleSidebar` were already in the store, already persisted to
`localStorage`, and already had a passing unit test. `<Sider>` was already `collapsible` with
`trigger={null}`. **Nothing in the app ever called the toggle.** So most of this step was the button
and the three things that break in a collapsed antd menu.

## What changed

**The button** sits first in the topbar, in the same place whether the menu is open or shut. It
carries `aria-label`, `aria-expanded` and `aria-controls`, and a tooltip.

The chevron **mirrors with the writing direction**, because the sidebar changes sides:

| | sidebar sits | icon | label |
| --- | --- | --- | --- |
| Persian (rtl) | right | `menu-unfold` | «بستن منو» |
| English (ltr) | left | `menu-fold` | «Collapse menu» |

**Group titles are dropped in the rail.** «محتوا», «داده» and «خروجی» have nowhere to go at 80px, so
the groups flatten and a short rule marks each seam instead.

**The rail is 80px**, rows are 48px rather than the 42px they use beside a word — 42 is under the
44px touch floor once the row is a bare icon.

## Three things the browser caught that reading could not

**1. The label leaves the flow, it does not just fade.** antd sets the collapsed label to
`opacity: 0` but **keeps its 58px of layout**, which pushed every icon off centre by up to 34px — a
third of the rail. The fix is `display: none` on the label; the tooltip carries the words.

**2. That fix silently lost a specificity tie.** `.app-sidebar--rail .ant-menu-item
.ant-menu-title-content` is three classes and did **nothing**. antd injects its own menu CSS at
runtime, *after* this stylesheet, so an equal-specificity rule loses. Adding antd's own
`.ant-menu-inline-collapsed` to the selector makes four classes and it wins — no `!important`
needed. Measured: **34px off centre with three classes, 0px with four.**

**3. The divider was invisible.** It stands in for group titles that sit at 21:1, and the default
hairline is **1.19:1** against the panel. A first attempt at `text-tertiary` mixed to 55% only
reached 1.85:1, because that token is already `rgba(0,0,0,0.45)` and the mix compounds. At full
strength it blends to `#8c8c8c` — **3.35:1**, over the 3:1 floor for something that carries meaning.

An outline was also tried for the selected item in the rail and **dropped**: at 45% alpha it read
fainter than the 3px bar it replaced, and in a rail the icon is the only thing left to carry the
state. The rail now keeps the same inset bar the open menu uses.

## A measuring trap worth remembering

The sider reported **240px wide while its own inline style said 80px**, with no rule overriding it.
That is impossible in normal CSS — and it was: the Browser pane was not compositing frames, so the
0.2s width transition never advanced and `getComputedStyle` kept returning the start value. Pinning
transitions off during measurement gave the true 80px. **Two hours of "the collapse is broken" was
the measurement, not the code.**

## Checked in a browser

At 1400px, Persian, with transitions pinned off:

| | |
| --- | --- |
| rail width | **80px** |
| icons off centre | **0px**, all eight |
| smallest target | **55 × 48px** |
| anything escaping the rail | none |
| tooltip on hover | «گزارش‌ها» shown, not hidden |
| tooltips when open | **0** — they only appear in the rail |
| divider contrast | **3.35:1** |
| open ⇄ shut round trip | titles back, dividers gone, 8 labels visible, state persisted |
| fold button in tab order | **first**, native `<button>`, not disabled |
| under 768px | button gone, drawer instead, no sideways scroll |

`typecheck`, `lint`, `build` clean. **331 tests pass**, plus a new one that the rail swaps titles for
dividers without losing a destination.

## Left to do

- **Deployed** with steps 2–4 on 2026-08-12; the rail was exercised on production.
- **The focus ring was not seen.** The button is first in the tab order and is a native button, but
  real key events could not reach the page — the pane was not displayed, so `Tab` never moved focus.
  `:focus-visible` deliberately ignores programmatic focus, so this needs a real keyboard. Step 4.
- `App.test.tsx` flakes under parallel load — **not caused by this change**, it did the same thing
  this morning on the grid fix. Passes alone in 4s, times out at 10s in a full run. Spun off.
