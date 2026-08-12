# Tab labels follow the theme, in every strip in the app

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** — checked signed in, both themes

Closes the loose end named at the end of
[the sidebar redesign](2026-08-12-analytics-sidebar-redesign.md).

## The defect, both halves of it

The Tabs colour was a **JS constant** handed to a `ConfigProvider` on two pages, so it could not
follow light and dark. In dark those labels kept the light-mode green and fell to about **2.8:1**.

Every *other* tab strip in the app had the opposite problem, and had had it all along: the brand
green, **2.54:1** as a label on a light panel.

So the app managed to be wrong in dark where it had been fixed, and wrong in light everywhere it had
not.

## One token instead of three sources

It is a component token in `theme.ts` now, beside the `Table`, `Card`, `Layout` and `Menu` tokens
already there, and it takes the mode. That fixes both directions at once and reaches strips this
work never touched.

Gone with it: the two per-page `ConfigProvider` wrappers and the ink-bar CSS rule. One colour should
not have three sources, and the CSS rule could only ever have been a second opinion.

| strip | light before | light after | dark after |
| --- | --- | --- | --- |
| `/manage-dashboards` filter tabs | 5.48 | 5.48 | **6.53** (was ~2.8) |
| `/dashboards` dashboard tabs | 5.48 | 5.48 | **6.53** |
| **admin AI tabs** — never selected by any CSS of mine | **2.54** | **5.48** | **6.53** |

The admin row is the point of doing it at the theme rather than per page.

## A reading I could not reproduce

Immediately after the deploy, one dark → light toggle measured the active label at **2.54** while
the ink bar beside it already read 5.48 — as if half the change had landed. It does not reproduce:
a full reload in light gives 5.48, and sampling the same toggle at 200, 600, 1200 and 2500ms gives
`#047857` every time, in both directions.

Recorded rather than quietly dropped, because "I saw it once and cannot make it happen again" is
worth knowing if it ever shows up properly. Best guess is a measurement taken while antd was
regenerating its style tags on the first toggle after a fresh bundle.

## Checked on production

Signed in, `/manage-dashboards`, light: filter tab **5.48**, ink bar **5.48**, hero chip **5.48**,
sidebar tile icon **5.18**, service name **16.56** — everything clears AA. Dark: tabs **6.53**.
Console clean. **361 tests pass**, three new: that `primaryInkFor` clears AA against the surface it
is actually drawn on in each mode, and that the two modes are not handed the same green. Detector
`[]`.

## Left to do

- **The focus ring and the sliding chip have still never been seen.** Both mechanisms are proven in
  code and in measurements; the browser pane does not composite frames, so neither can be watched
  here. A person with a keyboard settles it in ten seconds.
