# Two follow-ups cleared, and the widget-count line removed

**Date:** 2026-08-12
**Area:** analytics-web + the shared `AppSwitcher` in all eight SPAs
**Status:** **live** — all eight SPAs deployed and answering 200

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

## «۲ ویجت گزارش» removed, and the sweep it triggered

Asked for directly, to give the widgets more room. The count is still on the card in
`/manage-dashboards`, so nothing is lost from the product. Widgets now start **94px** below the top
of the content area, down from 118px — and from four stacked blocks before this week.

Removing it left the last of the old preview section styling and translating nothing, so this was
the moment to sweep up after all four navigation steps:

- **CSS:** `.dash-preview`, `__head`, `__eyebrow`, `__title`, `__meta` and their two mobile
  overrides — 760 bytes. Only `.dash-preview__edit-label` survives, because «حالت ویرایش» still
  uses it.
- **Labels:** `dash.previewLabel` and `dash.previewWidgets`, from both locales.
- **Imports:** `toPersianDigits`, the `num` helper and the `i18n` handle.

Dead CSS is worse than no CSS — the next person reads it and assumes the section still exists.

## A verification that looked like a failure

The first post-deploy check grepped the built bundle and reported **both** fixes missing. Both were
false alarms:

- `overlayInnerStyle` is still in the JS because **antd's own code** contains it — including the
  text of the deprecation warning.
- `previewWidgets` was still in the bundle because the **locale JSON** still carried the key, even
  though nothing read it. (That is now gone too.)

Grepping a bundle for a string proves the string is present, not that *your* code uses it. The
browser settled it: nothing rendered, console clean.

## All eight deployed

The other seven were shipped straight after, rather than left as committed-but-not-deployed.

Built one at a time on the server, then recreated one at a time. **`room-web` failed the first
build** — `docker.arvancloud.ir` would not resolve ("server misbehaving"), a registry mirror
hiccup, not a code fault: the app built first time on retry, and the six around it built cleanly
either side of it.

Afterwards: all eight `AppSwitcher.tsx` copies on the server carry **one hash**, all fifteen
`ceo-portal-*` containers are healthy, all eight SPAs answer `200`, and `sms-service` on the shared
box is still `Up 3 weeks`.

| app | |
| --- | --- |
| admin · election · landing-panel · mun-sanandaj · room · vms · walfare | 200, healthy |
| analytics | 200, healthy (deployed earlier) |

## One claim not made

The deprecation was **observed in the dev console**. Whether it also reached production consoles was
never checked before the fix, and cannot be now — antd's warning machinery *is* present in the
production bundle, so it is plausible, but it was not verified. What is verified: the warning is
gone where it was seen, and the popover still opens with `padding: 8px` and all eight links.

## Left to do

- **The keyboard focus ring** on the sidebar fold button is still the one thing never seen; it needs
  a human with a keyboard.
