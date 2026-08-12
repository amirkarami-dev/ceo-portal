# Two follow-ups cleared, and the widget-count line removed

**Date:** 2026-08-12
**Area:** analytics-web + the shared `AppSwitcher` in all eight SPAs
**Status:** analytics-web **live**; the other seven carry the fix **committed but not deployed**

Follows [the navigation work](2026-08-12-analytics-navigation-polish.md), which spun both of these
off rather than doing them inline.

## The antd deprecation that logged on every page of every app

```
Warning: [antd: Tooltip] `overlayInnerStyle` is deprecated. Please use `styles={{ body: {} }}`.
```

It came from `AppSwitcher.tsx` — the launcher in the top bar. It is a **`Popover`**, not a Tooltip;
Popover is built on Tooltip, which is why the message names the wrong component and why grepping for
`Tooltip` finds nothing.

**The file is byte-identical across all eight SPAs, and that is the point of it**, so it was changed
in all eight in one commit rather than one at a time:

| | hash |
| --- | --- |
| before | `3f3b44a2…` × 8 |
| after | `e7a73c5e…` × 8 |

`AbstractTooltipProps` in antd 5.29 carries `styles?: Partial<Record<'root' \| 'body', CSSProperties>>`,
and every app resolves antd to **5.29.3**, so the replacement is available everywhere. Three of the
other apps were typechecked to be sure. In the browser the popover still opens with `padding: 8px`
and all eight app links, and **the console is now completely clean**.

## The flaky test was not about timing

`App.test.tsx` timed out at 10s inside a full run and passed alone in 4s, which reads like a race.
It was not — it was **cost**. The test asserts one thing, that `App` is exported, but getting there
imports:

- `./router`, which builds the **entire route table at module scope** — every page, the admin shell,
  the chart renderers;
- `./providers`, which loads antd, i18n, the theme and the query client.

Four seconds of work to check one export, and under a full parallel run that stretched past the
limit. Both imports are stubbed now.

| | |
| --- | --- |
| before | **4026 ms** |
| after | **22 ms** |

Nothing is lost — `router.test.tsx` is what actually exercises the routes. **Four consecutive full
runs are clean.**

The lesson is the interesting part: *a test that flakes under load is not always a race.* This one
was simply too expensive for what it asserted, and the fix was to stop paying for what it never
checked.

## «۲ ویجت گزارش» removed

Asked for directly, to give the widgets more room. The count is still on the card in
`/manage-dashboards`, so nothing is lost from the product. Removing it also left
`toPersianDigits`, the `num` helper and the `i18n` handle unused, and those went with it.

Widgets now start **94px** below the top of the content area, down from 118px — and from four
stacked blocks before this week.

## Left to do

- **The other seven SPAs have the AppSwitcher fix committed but not deployed.** It is a console
  warning, not a user-facing fault, so it can ride along with each app's next deploy — but
  *committed is not deployed*, and this project has been caught by that before.
- **The keyboard focus ring** on the sidebar fold button is still the one thing never seen; it needs
  a human with a keyboard.
