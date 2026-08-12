# Navigation step 4: the design and phone pass

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** on analytic.myceo.ir

Design: [`docs/design/2026-08-12-analytics-navigation.md`](../design/2026-08-12-analytics-navigation.md)

## Goal

A `polish` pass over what steps 1–3 built: the fold-out rail, `/dashboards`, and
`/manage-dashboards`. Refinement only — the petrol-and-emerald world, the antd components and the
copy all stay.

## The app has two brand greens, and the unreadable one wins

This is the finding worth keeping.

`theme/tokens.ts` sets `colorPrimary: "#0f6e56"` — **6.2:1 on white, perfectly readable**. But
`providers.tsx` passes `theme.ts`'s `tokens.primary` (**`#10b981`**) as the brand, and
`ThemeProvider` merges the brand-built token **over** the one in `tokens.ts`:

```ts
token: { ...tokenOverrides.token, ...antdBaseTheme.token }   // brand wins
```

So the readable green is never rendered, and everything the brand colour touches as *text* sits at
**2.54:1** — below AA, and genuinely hard to read at 14px.

A test caught this, not me: an assertion written against `buildTheme().colorPrimary` expected a
failing ratio and got 6.2. The assumption was wrong, not the code.

**Reconciling the two greens is a brand decision, so it was not made here.** Instead there is now one
token — `primaryInk` in `tokens.ts`, `--rw-primary-ink` in `global.css`, `#047857`, **5.48:1** — for
places the brand colour has to be *read* rather than seen. The brand is untouched: fills, the ink
bar and the selected-item marker are all still `#10b981`.

| | before | after |
| --- | --- | --- |
| active tab label | 2.54 | **5.48** |
| selected sidebar item | 2.54 | **4.99** |
| sidebar group title | 3.35 | **6.98** |
| hero count chips | ~2.4 | **5.48** |

A test now fails if `primaryInk` is ever "simplified" back to the brand colour.

## antd owns the tab colour, and CSS cannot have it

The tab label refused every CSS override — three classes, four classes, and setting
`--ant-tabs-item-selected-color` on the Tabs root all did **nothing**. It is a component token, so it
is set with `ConfigProvider` instead, which is the same lesson as `size="large"` on the search box in
step 2: **when antd has a mechanism, use the mechanism.**

It is scoped to these two pages on purpose. Every other tab strip in the app has the same 2.54:1
problem, and fixing them all is a decision about the product, not about this page.

The dead CSS rule was deleted rather than left in place — a rule that does nothing is worse than no
rule.

## Touch targets

Everything this work owns now clears 44px on a phone.

| control | before | after |
| --- | --- | --- |
| edit switch | 44×22 | **44×43** hit area, still drawn 44×22 |
| ذخیره / ویرایش | 32px tall | **44px** |
| «همه» / «اخیر» tabs | 25 / 24 wide | **44** |
| search clear (×) | 12×12 | **44×44** hit area |
| search button | 40 wide | **44** |

The switch and the clear button grow their hit area with a pseudo-element, so the drawn control is
unchanged — `::after` is free on both, because antd builds the switch knob from a child element.
Desktop was re-measured afterwards and is untouched: buttons 40×40, tabs 25/87/24, card menu 24×24.

## Two false alarms, both mine

- **A tab looked like a 90×22 target.** The scan measured `[role=tab]`, which is the inner span; the
  clickable box is `.ant-tabs-tab` at **90×46**. No fix was needed.
- **A hero chip measured 1:1.** The contrast helper took the first non-transparent background it
  found and did not blend translucent layers, so a green chip on a green tint compared against
  itself. Blending the whole stack down to opaque white gave the real 2.4:1.

## Left alone on purpose

- **The topbar buttons (32×32) and the widget export buttons (24×24)** are under the touch floor.
  Both are shared shell, on every page of the app, and restyling them is a decision about the whole
  product rather than this navigation work.
- **The ambient grid background** flagged by the detector is byte-identical in `HEAD` — the app's
  established backdrop, not something these steps introduced.
- **The antd Tooltip deprecation** logging on every page comes from `AppSwitcher.tsx`, which is
  **byte-identical across all eight SPAs** (verified: one hash, eight files). Fixing it here alone
  would break that. Spun off to be done in all eight together.

## Still not seen

**The keyboard focus ring.** The fold button is first in the tab order and is a native `<button>`,
but real key events never reached the page — the Browser pane is not displayed, so `Tab` does not
move focus, and `:focus-visible` deliberately ignores programmatic focus. This needs a human with a
keyboard. It is the one item from step 1 that is still open.

## How it was checked

Measured at 1400px and 700px on both pages and the rail: every text colour at or above 4.5:1, every
control this work owns at 44px or more, nothing scrolling sideways, desktop unchanged by the
mobile-only rules, detector `[]`.

`typecheck`, `lint`, `build` clean. **351 tests pass**, two of them new and about the colour.
