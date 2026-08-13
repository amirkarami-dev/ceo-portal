# Design: the charts in RTL

**Date:** 2026-08-13
**Status:** steps 1–2 done (legend side; sweep, gap, centre total); steps 3–4 open
**Area:** `analytics-web/src/presentation/renderers`

## Which libraries draw the charts

| Library | Used for | RTL support |
| --- | --- | --- |
| **recharts** | bar, line, area, and the pie/donut | **none** — every RTL behaviour is hand-written by us |
| **echarts** (`echarts-for-react`) | heatmap, and grouped bar for 2-dimension results | partial; `legend.left`, axis `inverse` are ours to set |
| antd `Table` | the table view | inherits `dir` from `ConfigProvider`, works |

The reference image is an ApexCharts-style donut. ApexCharts has a real `rtl` flag; recharts has nothing
of the kind, which is why our RTL is uneven — each behaviour is a separate hand-made decision, and one
of them is simply inverted.

## What the audit found

Measured on the live page, `dir="rtl"`, on the «۱۴۰۵» report.

### 1. The donut's legend is on the wrong side — in BOTH directions

| | container | donut | legend |
| --- | --- | --- | --- |
| measured | 56 → 1098 | **343 → 563** | **845 → 1093** |

Chart on the left, legend on the right: that is the **LTR** arrangement, on an RTL page. The reference
has it the other way round — donut on the right, legend on the left — which is what mirroring means.

**The cause is one shared constant meaning two different things.**

```ts
const legendAlign = dir === "rtl" ? "right" : "left";
```

For the **bottom horizontal** legend on bar/line/area, `align` means *which end the items start from*,
and `"right"` in RTL is correct. For the donut's **vertical, side-mounted** legend, the same prop means
*which side the legend sits on* — so the value has to be the opposite. Passing the shared constant put
the donut's legend on the right in RTL **and** on the left in LTR: wrong both ways, and it has been
wrong since the legend was added.

### 2. The first slice starts at 3 o'clock

`firstSectorPathStart` is `M 500.8,170` against `cx=397, r=110` — exactly 3 o'clock, and recharts sweeps
counter-clockwise from there by default. The convention (and the reference) is the largest slice at **12
o'clock**. Direction of sweep is also a reading-direction matter: clockwise in LTR, counter-clockwise in
RTL.

### 3. A dead gap between donut and legend

The donut spans 343→563 and the legend 845→1093, leaving ~280px of nothing in the middle of a 1042px
box while the ring itself is only 220px across. Recharts centres the pie in the space *left over*, so a
side legend pushes it off-centre rather than sharing the width.

### 3b. The centre total can outgrow the hole

Seen after step 1 on a currency report: «۱۵٬۰۴۵٬۵۰۰٬۰۰۰» is wider than the 136px hole and spills over
the ring. The hole is a fixed size while the number is not, so a big figure has to shorten (۱۵.۰ میلیارد)
or the text has to scale to fit. Folded into step 2, since both are about the ring's geometry.

### 4. ECharts has the same inverted idea

`EChartsRenderer` sets `legend.left = dir === "rtl" ? "right" : "left"`, which is the same
mirror-the-wrong-thing move. It only shows on 2-dimension results, so nobody has hit it yet.

## What is already right — and stays untouched

Worth writing down so a later change does not "fix" them back:

- **Bar/line Y axis** sits on the right in RTL (`orientation`), and the X axis is `reversed`, so the
  first category reads from the right. Measured: first tick «عادی», last «خانه باغ», axis on the right.
- **The tooltip** resolves `direction: rtl` and `text-align: start` from the page, and reads
  «عادی تعداد : ۶٬۵۵۰» correctly.
- **Legend swatches** sit to the right of their label in RTL, because the list inherits `dir`.
- **Numbers** are Persian digits throughout, via `formatNumber(v, dir)`.
- **Dates** are Jalali via `formatCategory`.

## The direction

**Split the one constant into two**, because they are two different questions:

```ts
// Bottom, horizontal (bar/line/area): which end do items start from?
const legendAlign = dir === "rtl" ? "right" : "left";
// Side, vertical (donut): which side does the legend sit on? The chart takes the other side.
const sideLegendAlign = dir === "rtl" ? "left" : "right";
```

Then the donut reads: chart on the **right**, legend on the **left** in Persian, and mirrored in English.

**Start the ring at 12 o'clock**, sweeping away from the reading edge — clockwise in LTR,
counter-clockwise in RTL — so the largest slice opens where the eye lands.

**Give the ring the space the gap is wasting** by letting the legend and the chart each own a half.

## Steps

| Step | What |
| --- | --- |
| 1 | Split the legend constant; donut legend to the correct side, both directions — **done** |
| 2 | Ring starts at 12 o'clock and sweeps with the reading direction; close the gap; stop the centre total overflowing the hole — **done**, and it took a different shape than planned: see below |
| 3 | The same fix in `EChartsRenderer`, so it is not left as the one that still mirrors wrongly |
| 4 | Measure both directions and both themes, tests, deploy, worklog |

Step 1 is the one you are looking at and can ship alone.

## How step 2 actually went

The plan was to nudge the ring with an explicit `cx` and cap the width. Both were tried and both
failed, for the same reason: **recharts measures the two things against different boxes.** A `Pie`'s
`cx="68%"` is 68% of the *plot area* — what is left after the legend — while a raw `<text x="68%">`
is 68% of the *whole SVG*. The same number put the ring in one place and the total 42px away from it,
and the gap only shrank from 337 to 225.

So the donut now lays itself out: a flex row holding a fixed 240px square for the ring and a plain
`<ul>` for the legend. That fixes four things at once and removes rather than adds cleverness:

- the ring centres at 50% of its own box, so the total is centred **by construction** (measured
  off-centre: 0px, in both directions),
- the gap is a flex `gap`, not whatever is left over — **42px**, down from 337,
- **RTL needs no prop at all**: a flex row follows the page's direction, so the ring lands at the
  reading edge and the key after it. `legendPlacement().side` is now needed only by ECharts,
- the legend is our markup, so the colour-on-text problem cannot come back through recharts.

## What could go wrong

- **`align` is overloaded in recharts.** The same prop name means "which end" for a horizontal legend
  and "which side" for a vertical one. A test has to assert the donut's legend is on the opposite side
  from the ring, in each direction — asserting the prop value would just re-encode the confusion.
- **Twelve slices is past what a donut is for.** The chart guidance says six maximum, then a 100%
  stacked bar. This is a deliberate exception because it was asked for; the table view remains the
  accessible fallback, which matters because a pie grades **C** for colour-blind readers.
- **Recharts positions the pie from what is left after the legend.** Giving each a half may need an
  explicit `cx`, and `cx` is a mirror-sensitive value in its own right.
