# The pie, the views that did nothing, and «sum_amount»

**Date:** 2026-08-13
**Area:** `analytics-web` — the view switcher, the recharts/echarts/table renderers
**Status:** **live** on analytic.myceo.ir

## The goal

Amir built «تعداد و درصد پروژه‌ها به تفکیک نوع پروژه در سال ۱۴۰۵» on `/reports/3`, wanted it as a
circle, and found «دایره‌ای» disabled. Three separate problems came out of that one button, and a
fourth out of the chart it produced.

## 1. The pie was disabled — and three other views did nothing

`ViewSwitcher` disabled the pie whenever a result had **more than one metric**. That report has two
(a count and its own percentage), which is the most natural pie there is.

Looking at why turned up the bigger half. `chooseView` returns **only the view it picked plus a
Table**, and the saved-report viewer switched by *searching that list*, falling back to index 0 when
it found nothing:

```tsx
const idx = views.findIndex(...);
setActiveIdx(idx >= 0 ? idx : 0);   // ← nothing found = silently show the primary again
```

So on `/reports/:id` the **line and KPI buttons were enabled and did nothing** — they put you back on
the bar chart. Only the pie was visibly disabled, so only the pie got reported.

`/ask` never had this: `useAskAi` builds the view on demand. The viewer was written separately and
never learned how. Both now share `presentation/view-switching.ts`.

Built views are dropped on refresh, filter change or drill, because they name columns from the result
they were built against.

## 2. The pie became a ring

Tested against Amir's real numbers — 12 project types, 154,109 rows, four of them under 0.1%.

The old pie printed raw values **on the ring**. At twelve slices those numbers sat on top of each
other and the four smallest had nowhere to go. Now: the share sits beside the name in the legend, the
ring carries no labels, and the hole carries the **total** — the number a reader otherwise has to add
up from the slices.

Our percentages came out identical to the ones Amir's hand-written SQL produced (87.33, 5.19, 2.90,
1.57, 1.02) by a completely separate path, which is a good sign for both.

## 3. Legend text was unreadable — every chart, not just the pie

**Recharts paints legend TEXT in the series colour.** Those colours are picked so slices can be told
apart as *fills*, which is a far lower bar than being readable as 12px words. Measured on the dark
panel:

| series | as legend text |
| --- | --- |
| blue | **2.54:1** |
| deep green | **2.67:1** |
| floor for 12px text | 4.5 |

The dot already carries the colour, so the words now use the normal text colour — **14.12:1**. Bar and
line legends had the same bug and are fixed too.

**A colour that works as a fill does not automatically work as text.** Third time this week, after the
brand green and the 45% tertiary token.

## 4. «sum_amount» in the legend

The engine names a metric column after its own alias, and every renderer showed that key as a name.
All the pieces of a real name existed and were never joined up:

- the definition knows it is a `sum` of `amount`
- the semantic model knows `amount` is «درآمد» / "Revenue"
- i18n already had `agg.sum` = «مجموع» / "Sum"

`presentation/labels.ts` does the join, used by the recharts legends and tooltips, the ECharts series,
the donut's centre caption and the **table headers**, which had the same raw alias.

**Composition comes before a label stored on the report.** The first version preferred the stored one,
reasoning that an author who names a column means it. Switching to English exposed the flaw: the
dimension read "Province" while the metric still read «مجموع درآمد», because a stored label is one
fixed string with no language attached. That is exactly the complaint, so composing wins; the stored
label is the fallback for a metric over a field the bundled model does not describe.

Two smaller things: a count over `*` reads «تعداد» alone, because "Count of *" looks like a bug; and
`percentOfTotal` had no aggregation word at all — added as «درصد» / "Share".

## Verified

Measured in the browser on a real report, both languages:

| | FA | EN |
| --- | --- | --- |
| bar legend | مجموع درآمد | Sum Revenue |
| donut centre | مجموع درآمد | Sum Revenue |
| table header | استان / مجموع درآمد | Province / Sum Revenue |

Every switcher button was clicked and the rendered shape checked: pie 12 sectors and no bars, line one
line, bar, table, and the KPI card with its value. 396 front-end tests, lint and build clean.

Deployed: bundle `index-DdBq51yH.js` → `index-BlBSyTgo.js`, container healthy, HTTPS 200.

## Worth knowing

- **The label resolver reads the BUNDLED model**, which carries both languages. The backend store has
  Persian names only, so a dataset added backend-only would fall back to the engine's label and stay
  Persian in English. Both current datasets are mirrored, so it does not bite today.
- **A KPI renders as a Card, not `ant-statistic`.** A check looking for `.ant-statistic` finds
  nothing and reads as broken when it is fine.
- With 87% in one slice a donut is mostly one colour. That is the data, not the chart; the legend
  carries the small ones.
