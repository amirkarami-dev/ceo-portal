# Dashboard widgets jumped to the right corner when grabbed

**Date:** 2026-08-12
**Area:** analytics-web (`/dashboards`, `/dashboards/:id/edit`)
**Status:** **live** on analytic.myceo.ir — checked in a browser against production

## What was reported

On `analytic.myceo.ir/dashboards` and `/dashboards/6/edit` the widgets could not be dragged. Grabbing
a widget by its header, or grabbing the resize corner, threw it to the right edge of the page. The
guess in the report was "maybe this is RTL". That guess was right.

## Root cause

`react-grid-layout` 1.5.3 has **no idea RTL exists**. Searching the whole package for `rtl` or
`direction` finds nothing but a local variable about resize axes.

It places every widget like this — and this is the whole bug:

```js
// react-grid-layout/build/utils.js, setTransform()
return { transform: `translate(${left}px,${top}px)`, width, height, position: "absolute" };
```

There is **no `left`** in that object. The library assumes an absolutely positioned box starts at the
left edge of its container, so a transform alone is enough to place it.

That assumption only holds in a left-to-right page. `index.html` sets `<html lang="fa" dir="rtl">`,
which reaches the grid. In an RTL container a box with `left: auto` is placed against the **right**
edge, so `left` resolves to `container width − widget width`. The transform is then added on top of
that, pushing every widget further right.

Measured on a 1207px grid, three widgets four columns wide:

| widget | transform says | actually landed at |
| --- | --- | --- |
| a | 10 | 827 |
| b | 409 | 1226 |
| c | 808 | 1625 |

Every one is out by the same 816.6px. Two of the three sat completely outside the grid.

**Why grabbing made it worse.** A drag starts by the library reading where the widget really is and
handing that number straight back as the new transform:

```js
// react-grid-layout/build/GridItem.js, onDragStart()
newPosition.left = cLeft - pLeft + offsetParent.scrollLeft;
```

Normally that is a no-op — the number it reads equals the transform already applied. Here it read the
wrong position (827 instead of 10), re-applied it as a transform, and the right-edge offset was added
*again*. So one click moved the widget right by the full offset. Measured live, with the same page
and the same moment, that jump was **945px** at a 1400px viewport and **0px** after the fix.

## The fix

Two CSS rules in `analytics-web/src/features/dashboards/dashboards.css`:

```css
.dashboard-canvas .react-grid-layout { direction: ltr; }
[dir="rtl"] .dashboard-canvas .react-grid-item { direction: rtl; }
```

The grid itself goes LTR, which is the only thing the library's maths ever assumed, so `left`
resolves to `0`. The text direction goes back on each widget, so the widgets still read right to
left. Nothing else changes: no library patch, no fork, no coordinate mirroring.

**Column order stays left to right** — column 0 is the leftmost. Mirroring it would mean rewriting
every saved `x`, and a dashboard is a canvas rather than a line of text, so it was left alone.

## Two more faults found in the same component

Both were found while reading the component, not reported.

**A narrow screen silently rewrote the saved layout.** Only one layout is stored per dashboard
(`layouts={{ lg: layout }}`), so at any width under 1200px `react-grid-layout` generates one by
squeezing the 12-column design into 6 columns (`sm`) or 4 (`xs`) — and then reports that squeezed
copy through `onLayoutChange`, which the page stored as *the* layout. Opening a dashboard on a tablet
and pressing ذخیره replaced the real design with its squeezed copy, for everyone. Confirmed by
resizing to 820px and watching the saved `x` values change from `0, 4, 8` to `0, 2, 2`.

Fixed by tracking the column count and refusing to write back anything that is not the 12-column
design. `onBreakpointChange` is the right hook, not `onWidthChange`: the library calls it on the line
directly *above* the squeezing `onLayoutChange`, while `onWidthChange` runs after and is therefore
always one step late. The first attempt used `onWidthChange` and did not work.

**The read-only cursor never appeared.** `.dashboard-canvas--readonly` existed in the CSS but nothing
ever set it, so in view mode the widget header still showed a "grab" cursor for something that does
not move. The component now sets the class when `editing` is false.

## How it was checked

The real `DashboardCanvas` and the real `dashboards.css` were mounted on a throwaway page under
`dir="rtl"` and measured in the browser (the page has been deleted again).

- `left` resolves to `0px`; where each widget lands now equals its transform exactly.
- The library's own drag-start sum re-run by hand: **0px jump**, against **945px** with the fix
  switched off on the same page, then back to 0 when switched on again.
- 820px wide: saved layout untouched, widgets still stack.
- Phone width: one column, no sideways scrolling.
- `typecheck`, `lint`, `build` clean; **331 tests pass**. Two timed out on the first run while npm was
  still warming up and passed on their own and on a re-run — neither touches the grid.

## Deployed

Incremental: packaged the five files this commit touched, copied them up, rebuilt only the
`analytics-web` image and recreated only that container. `sms-service` next to it on the shared box
was left alone (`Up 3 weeks`, unchanged). The first check returned 404 because the container was
still starting — as OPERATIONS warns; healthy and `200` a few seconds later.

Then checked from a browser on the real site, not just with curl. Both rules are in the live CSSOM,
and building the DOM react-grid-layout produces and letting the **deployed** stylesheet place it
gives: grid `ltr`, item `rtl`, `left: 0px`, an item with transform 800 landing at 800, and a
**0px jump on grab**.

## Left to do

- **Nobody has clicked a widget on the live site.** The geometry is proven on production, but the
  drag itself is behind the login, so the last step is someone dragging a real widget.
- **No test guards this.** The bug is a CSS layout bug, and jsdom does not do layout, so a unit test
  could not have caught it and cannot catch it coming back. A real-browser check is the only guard.
- The resize grip stays at the bottom-**right** of a widget. In an RTL page bottom-left may read
  better, but the library grows a widget rightward from its top-left corner, so the grip matches what
  actually happens. Left as it is.
- **Unrelated, worth knowing:** `react-grid-layout@1.5.3` ships a 33KB compiled macOS binary named
  `ip_fetcher`, its C source (a curl sample that fetches `ifconfig.me`), and a 375KB
  `yarn-error.log`. These are in the tarball published to npm — checked against the registry — so it
  is the maintainer's mistake, not a break-in here. The package has **no install hook**, so nothing
  runs it, and it is a Mac binary on a Windows box. Junk, not a threat. `1.5.4` is the newest 1.x.
