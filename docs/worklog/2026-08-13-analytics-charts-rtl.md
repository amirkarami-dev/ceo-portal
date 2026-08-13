# The charts in RTL — and what «left» actually means

**Date:** 2026-08-13
**Area:** `analytics-web/src/presentation` — the recharts and ECharts renderers
**Status:** **live** on analytic.myceo.ir

## The goal

Amir: «this charts not good for rtl», with a reference image of an ApexCharts-style donut, and
"comply with all RTL-related matters".
Design doc: [`docs/design/2026-08-13-analytics-charts-rtl.md`](../design/2026-08-13-analytics-charts-rtl.md).

## Which libraries draw the charts

Worth stating, because it explains the whole shape of the problem:

| Library | Draws | RTL support |
| --- | --- | --- |
| **recharts** | bar, line, area, the pie/donut | **none** — every RTL behaviour is ours by hand |
| **echarts** | heatmap, grouped bar for 2-dimension results | partial; anchors and axis `inverse` are ours to set |
| antd `Table` | the table view | inherits `dir`, works |

The reference is ApexCharts, which has a real `rtl` flag. Recharts has nothing of the kind, so our
RTL was uneven — a pile of separate hand-made decisions, one of which was simply inverted.

## The one real bug, and it was in both directions

```ts
const legendAlign = dir === "rtl" ? "right" : "left";
```

Recharts overloads `align`. On a **bottom, horizontal** legend it means *which end the items start
from* — the reading edge, so the right in RTL. On a **side, vertical** legend it means *which side
the legend sits on*, and the chart takes the other. The two questions have opposite answers.

Both were handed the one constant, so the donut inherited the horizontal legend's answer: legend on
the right in RTL **and** on the left in LTR. Measured on the live page — container 56→1098, ring
343→563, legend 845→1093 — the chart sat on the left of an RTL page with ~280px of nothing between
them.

**«left»/«right» in a chart library is two different questions**, and only the shape of the legend
tells you which one you are answering.

## Then the fix stopped being about props

Step 2 was meant to nudge the ring with an explicit `cx` and cap the width. Both failed the same way:
**recharts measures the two things against different boxes.** A `Pie`'s `cx="68%"` is 68% of the
*plot area* — what is left after the legend — while a raw `<text x="68%">` is 68% of the *whole SVG*.
The same number put the ring in one place and the total 42px away from it, and the gap only came down
from 337 to 225.

So the donut now lays itself out: a flex row holding a fixed 240px square for the ring, and a plain
`<ul>` for the legend. That removes cleverness rather than adding it, and settles four things at once:

- the ring centres at 50% of **its own box**, so the total is centred by construction — measured
  off-centre **0px**, every direction and theme,
- the gap is a flex `gap` — **42px**, not whatever space was left over,
- **RTL needs no prop at all**: a flex row follows the page's direction, so the ring lands at the
  reading edge and the key after it,
- the legend is our markup, so recharts cannot paint legend text in the series colour again.

Also in that step: the ring starts at **12 o'clock** instead of 3 and sweeps the way the language
runs, and the centre total shortens only when it must — «۹٬۵۶۷» stays exact, «۱۵٬۰۴۵٬۵۰۰٬۰۰۰» is
fourteen characters and becomes «۱۵ میلیارد».

## I was wrong about ECharts

The design doc said `EChartsRenderer` repeated the inverted move. It does not. That claim came from a
grep seeing `dir === "rtl" ? "right" : "left"` and assuming the worst. Its legend is a **horizontal**
strip, as is the heatmap's `visualMap`, and for a horizontal thing anchoring to the reading edge is
correct. The axes were already right too: `xAxis.inverse` and `yAxis.position` both follow direction,
and the tooltip aligns.

**I made the same category error diagnosing it that the original code made writing the donut** — which
is the lesson of this whole record, arriving twice.

One real gap did exist: the heatmap's category `yAxis` had no `position`, so with the columns already
running right-to-left the row labels stayed on the left — a reader started at the labels, crossed the
matrix and came back. Rows keep their top-to-bottom order; only the horizontal axis mirrors.

## What was already right — and is now pinned by tests

So a later change does not "fix" these back: the bar/line Y axis on the right in RTL, the reversed X
axis, tooltip `direction: rtl`, legend swatches on the reading side, Persian digits, Jalali dates, and
every ECharts anchor above.

## Verified

Four combinations — both directions × both themes — at 1280×860:

| | ring side | gap | total off-centre | legend contrast | caption |
| --- | --- | --- | --- | --- | --- |
| rtl / dark | right | 42 | 0 | 14.12 | 6.14 |
| rtl / light | right | 42 | 0 | 17.07 | 5.36 |
| ltr / dark | left | 42 | 0 | 14.12 | 6.14 |
| ltr / light | left | 42 | 0 | 17.07 | 5.36 |

No sideways scroll in any of them. At 375 the row wraps, the ring stays centred, nothing overflows and
no legend row wraps. 411 front-end tests, lint and build clean.

## Two measurement traps hit on the way

- **A browser tab with a 0×0 viewport answers every geometry question with rubbish.** A fresh preview
  tab reported the ring on the left in RTL, a gap of **−110**, and sideways scroll — all four
  combinations identical, which was the tell. `window.innerWidth` was 0. Resizing it to 1280×860 gave
  the real numbers. **Check the viewport before believing a layout measurement.**
- **ICU joins a number to its unit with U+00A0**, not a space. Two identical-looking strings that cost
  a failing test to tell apart.

## Worth knowing

- A donut is meant for **six categories at most** and grades **C** for colour-blind readers; twelve
  project types is a deliberate exception because it was asked for. The table view is the fallback,
  and that matters more than usual here.
- `legendPlacement().side` now exists only for ECharts. Recharts stopped needing it the moment the
  donut laid itself out — the flex row made the question disappear rather than answering it.
