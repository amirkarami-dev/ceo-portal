import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
import { formatCategory, formatFitted, formatNumber, formatPercent, type Dir } from "../format";
import { useMemo } from "react";
import { useUiStore } from "../../store/ui-store";
import { chartColors } from "../../theme/tokens";
import { useEChart } from "../../components/charts/useEChart";
import { useColumnLabel } from "../labels";
import { aggregateByCategory } from "./chart-utils";
import { seriesKeysOf } from "../series-keys";
import { resolveDrillTarget } from "./drill";
import { legendPlacement, pieSweep } from "../chart-rtl";

export type RendererProps = {
  view: ReportView;
  def: ReportDefinition;
  result: QueryResult;
  /** Optional drill callback (Task 13 canonical prop): fired with the clicked
   *  group node so the consumer can re-run `drillInto`. */
  onDrill?: (node: GroupNode) => void;
};

function currentDir(): Dir {
  if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
    return "rtl";
  }
  return "ltr";
}

/**
 * Distinct values, first-seen order, **keeping the missing bucket**.
 *
 * This used to `continue` on null, which deleted a whole category from the chart. The engine
 * deliberately buckets missing values together and pins it (`engine.edge.test.ts`), and the recharts
 * path keeps that bucket via `row[key] ?? null` — so a report grouped on a column with a gap lost a
 * bar here and nowhere else, with no error and no failing test, and every category after it shifted.
 * `formatCategory(null)` renders it as a blank tick, which is exactly what recharts shows.
 *
 * A separate flag rather than a sentinel string, so no real category can collide with it.
 */
/** Same category bucket? Compared as strings, with null and undefined as one bucket -- see drill.ts. */
function sameValue(a: unknown, b: unknown): boolean {
  const am = a === null || a === undefined;
  const bm = b === null || b === undefined;
  if (am || bm) return am && bm;
  return String(a) === String(b);
}

function uniq(values: (string | number | null)[]): (string | number | null)[] {
  const seen = new Set<string>();
  let seenMissing = false;
  const out: (string | number | null)[] = [];
  for (const v of values) {
    if (v === null || v === undefined) {
      if (!seenMissing) {
        seenMissing = true;
        out.push(null);
      }
      continue;
    }
    const k = String(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/**
 * Which cartesian shape a view asks for.
 *
 * The aliases were carried over from the deleted recharts renderer verbatim, including the silent bar
 * default: a stored view whose component string nothing recognises draws a bar rather than nothing,
 * which is the behaviour saved definitions already rely on.
 *
 * **Area is kept**, and that was a decision rather than an oversight. Nothing in the app emits it —
 * `SwitchTarget` is `ViewType | "bar" | "line" | "pie"`, `CHART_SUBTYPES` has only those three, and
 * since the recharts renderer was deleted there is **no other `AreaChart` reference in `src` at all**
 * outside a test. So it is reachable only from a hand-written or AI-authored view. Whether any
 * *stored* definition names it cannot be answered from the code, only from the database. Six lines of
 * insurance against an unknown beats a silent shape change for a report someone saved — the same
 * reasoning that keeps the legacy `library: "recharts"` alias alive in the dispatcher.
 */
type ChartKind = "bar" | "line" | "area" | "pie";

function chartKind(view: ReportView): ChartKind {
  const kind = view.component || view.type;
  if (kind === "LineChart" || kind === "line") return "line";
  if (kind === "AreaChart" || kind === "area") return "area";
  if (kind === "PieChart" || kind === "pie") return "pie";
  return "bar";
}

/** Minimal HTML escaping — the tooltip formatter returns markup, and category values are data. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type TooltipParam = {
  marker?: string;
  seriesName?: string;
  name?: string;
  axisValueLabel?: string;
  value?: unknown;
  data?: unknown;
};

/**
 * The tooltip has to be hand-built, because ECharts' own markup is physically laid out.
 *
 * Measured: it emits `float:right` on the value and `margin-left:2px` on the name
 * (`echarts/lib/component/tooltip/tooltipMarkup.js`). In an RTL block `float:right` puts the value at
 * the *reading* edge, so the tooltip reads **value then name** — the reverse of recharts' «name : value».
 * Geometry from the spike: the name occupied x 907-967 and the value x 1001-1037. Neither property is
 * reachable through `tooltip.textStyle`, so `align` cannot fix it and the old
 * `textStyle.align === "right"` assertion was guarding nothing.
 *
 * Logical properties only here, so one formatter serves both directions.
 */
function makeTooltipFormatter(valueFormatter: (v: number | string) => string) {
  return (raw: TooltipParam | TooltipParam[]): string => {
    const list = Array.isArray(raw) ? raw : [raw];
    if (list.length === 0) return "";

    const header = list[0].axisValueLabel ?? list[0].name ?? "";
    const rows = list
      .map((p) => {
        // A heatmap datum is [xIndex, yIndex, value]; everything else carries a plain value.
        const v = Array.isArray(p.value) ? p.value[2] : p.value;
        if (v === null || v === undefined) return "";
        const name = p.seriesName ?? p.name ?? "";
        return (
          '<div style="display:flex;align-items:center;gap:6px">' +
          (p.marker ?? "") +
          `<span>${esc(name)}</span>` +
          `<span style="margin-inline-start:auto;font-weight:700">${esc(
            valueFormatter(v as number | string),
          )}</span>` +
          "</div>"
        );
      })
      .join("");

    return header
      ? `<div style="margin-block-end:4px;font-weight:600">${esc(header)}</div>${rows}`
      : rows;
  };
}

export default function EChartsRenderer({ view, def, result, onDrill }: RendererProps) {
  // Series carry the engine's column alias; a legend showing "sum_amount" is the key, not a name.
  const columnLabel = useColumnLabel(def, result);
  const dir = currentDir();
  const rows = result.rows as ResultRow[];
  // The donut draws its own key and total, so it needs the same palette and text colours the theme
  // gives the ring.
  const themeMode = useUiStore((s2) => s2.themeMode);
  const colors = chartColors(themeMode);
  const palette = colors.series;

  /**
   * One option, built in a memo, for both chart kinds.
   *
   * The two shapes used to be two early returns, each rendering its own `<ReactECharts>`. A hook
   * cannot be called conditionally, so the branch moved inside here and there is a single
   * `useEChart` below. That is also why the memo matters: without it a new option object every render
   * would send `setOption` on every render — not a rebuild, but pointless work on every keystroke in a
   * filter box.
   */
  const kind = chartKind(view);
  const pieCategory = view.mapping.category ?? view.mapping.x ?? "";
  const pieMeasure =
    view.mapping.measure ??
    (Array.isArray(view.mapping.y) ? view.mapping.y[0] : view.mapping.y) ??
    result.columns.find((c) => c.isMetric)?.key ??
    "";

  /** Aggregated slices, shared by the ring and the key beside it so they cannot disagree. */
  const donutRows = useMemo(
    () => (kind === "pie" ? aggregateByCategory(rows, pieCategory, pieMeasure ? [pieMeasure] : []) : []),
    [kind, rows, pieCategory, pieMeasure],
  );

  const option = useMemo(() => {
    const x = view.mapping.x ?? "";
    const seriesField = view.mapping.series;
    // Every y key the view asks for, not just the first. `mapping.y` is `string | string[]`, and this
    // used to collapse to one measure, so a two-measure view silently drew half its data. Shared with
    // the deleted recharts renderer, so the two could not disagree about what a view plots.
    const ys = seriesKeysOf(view, result);
    const measure = ys[0] ?? "";
    const valueFormatter = (v: number | string) =>
      formatNumber(typeof v === "number" ? v : Number(v), dir);

    /**
     * The legend sits UNDER the chart and starts from the reading edge. `legendPlacement(dir).inline`
     * is the shared answer to that question — the inline/side pair exists because one `align` value
     * once served both and put the donut's legend on the wrong side in *both* directions.
     *
     * `bottom: 0` because ECharts defaults a legend to top-centre while recharts put it underneath;
     * without it the legend lands on top of the plot. `grid.bottom` below reserves the room.
     */
    const legendSide = legendPlacement(dir).inline;
    const legend: Record<string, unknown> = {
      bottom: 0,
      [legendSide]: 8,
    };

    // Surface and text colour come from the theme. The formatter cannot: ECharts' own markup is
    // physically laid out and reverses in RTL. See makeTooltipFormatter.
    const tooltip: Record<string, unknown> = {
      trigger: "item",
      // Widget bodies scroll (`overflow: auto`), and an unconfined tooltip is positioned against the
      // viewport — so near an edge it spilled outside the widget and was clipped.
      confine: true,
      formatter: makeTooltipFormatter(valueFormatter),
    };

    /**
     * The donut.
     *
     * Only the RING is ECharts. The flex row, the total in the hole and the key beside it are markup
     * this component owns, ported unchanged from the recharts implementation — they exist because of
     * measured defects, not preference: a library-drawn side legend left ~300px of dead space, and
     * `cx="50%"` on the pie resolved against the plot box while a raw SVG `<text x="50%">` resolved
     * against the whole canvas, so the same percentage landed in two different places and the total
     * could not be centred in the hole. As a flex row the ring is its own square box, the total sits
     * dead centre by construction, and RTL needs no thought at all — the row follows the page.
     */
    if (kind === "pie") {
      const sweep = pieSweep(dir);
      return {
        // No ECharts legend: the <ul> beside the ring is the legend, and it is there because
        // recharts painted legend text in the series colour, which measured 2.54:1 as 12px words.
        legend: { show: false },
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (p: TooltipParam & { percent?: number }) => {
            const v = typeof p.value === "number" ? p.value : Number(p.value ?? 0);
            // The two-space separator is recharts' and is kept. The percent SIGN is not: recharts
            // appended «٪» in English too, which `formatPercent` now decides by direction. A
            // deliberate copy change, called out in the step-8 memo rather than left to drift.
            const pct = formatPercent(Number((p.percent ?? 0).toFixed(2)), dir);
            return `${esc(p.name ?? "")}<br/>${esc(valueFormatter(v))}  (${esc(pct)})`;
          },
        },
        series: [
          {
            type: "pie",
            // The hole. 68 of 110 keeps the ring thick enough to read at a glance while leaving room
            // for the total.
            radius: [68, 110],
            center: ["50%", "50%"],
            padAngle: 2,
            itemStyle: { borderRadius: 6, borderWidth: 0 },
            // Largest slice at 12 o'clock, sweeping the way the language runs. `clockwise`, not an
            // end angle — see pieSweep.
            startAngle: sweep.startAngle,
            clockwise: sweep.clockwise,
            // No labels on the ring: they collide as soon as a category is small, and twelve project
            // types include four under 0.1%. The share goes in the key instead.
            label: { show: false },
            labelLine: { show: false },
            animation: false,
            // Three ECharts defaults that would otherwise change how the ring behaves:
            // sectors grow on hover...
            emphasis: { scale: false },
            // ...and an all-zero result draws a grey placeholder ring, which reads as data.
            showEmptyCircle: false,
            data: donutRows.map((r) => ({
              name: formatCategory(r[pieCategory] as string | number | null, dir),
              value: Number(r[pieMeasure] ?? 0),
            })),
          },
        ],
        rwCategories: donutRows.map((r) => r[pieCategory] as string | number | null),
        rwKind: kind,
      };
    }

    // 2 dimensions x 1 measure -> heatmap matrix. Kept on `uniq` rather than aggregation, because a
    // matrix needs the raw (x, y) pairs and not one bucket per x.
    if (seriesField && view.component === "heatmap") {
      const xCats = uniq(rows.map((r) => r[x]));
      const yCats = uniq(rows.map((r) => r[seriesField]));
      const data: [number, number, number][] = [];
      rows.forEach((r) => {
        const xi = xCats.findIndex((c) => sameValue(c, r[x]));
        const yi = yCats.findIndex((c) => sameValue(c, r[seriesField]));
        const val = Number(r[measure] ?? 0);
        if (xi >= 0 && yi >= 0) data.push([xi, yi, val]);
      });
      const maxVal = Math.max(1, ...data.map((d) => d[2]));
      return {
        tooltip: { ...tooltip, position: "top" },
        legend,
        xAxis: {
          type: "category",
          data: xCats.map((c) => formatCategory(c, dir)),
          inverse: dir === "rtl",
        },
        yAxis: {
          type: "category",
          data: yCats.map((c) => formatCategory(c, dir)),
          // The columns already run right-to-left, so the row labels belong on the right too --
          // otherwise a reader starts at the labels, crosses the whole matrix, and comes back.
          // Only the horizontal order mirrors; rows keep their top-to-bottom order in both.
          position: dir === "rtl" ? "right" : "left",
        },
        // The colour ramp itself is in the theme's visualMap.inRange -- it used to be ECharts'
        // default blue-to-red, a second palette on the same page.
        visualMap: {
          min: 0,
          max: maxVal,
          calculable: true,
          orient: "horizontal",
          left: dir === "rtl" ? "right" : "left",
          bottom: 0,
          // Its min/max labels fall back to `toFixed`, i.e. ASCII digits and no grouping on a Persian
          // page — the one number on the chart that was not going through our formatter.
          formatter: (v: number) => valueFormatter(v),
        },
        series: [{ name: columnLabel(measure), type: "heatmap", data, label: { show: false } }],
        rwCategories: xCats,
      };
    }

    /**
     * Cartesian kinds. Two different meanings of "more than one series" have to coexist:
     *   - several measures -> one series per y key
     *   - one measure split by `mapping.series` -> one series per distinct value of that field
     *
     * Both go through `aggregateByCategory`, which sums rows sharing a category in first-seen order.
     * The old `rows.find(r => r[x] === xc)` took the FIRST matching row and discarded the rest, so
     * four rows over two months drew two bars each holding one row's value -- quietly wrong numbers,
     * which is worse than a crash. It also keeps the missing bucket, via `row[key] ?? null`.
     */
    /**
     * What each series looks like for this kind.
     *
     * `smoothMonotone: "x"` matters: plain `smooth: true` is a different spline that overshoots
     * between points, so a sparse series dips below zero where recharts' monotone curve did not.
     * `showSymbol: false` matches recharts' `dot={false}`.
     */
    const shape: Record<string, unknown> =
      kind === "bar"
        ? { type: "bar" }
        : {
            type: "line",
            smooth: true,
            smoothMonotone: "x",
            showSymbol: false,
            // Overlaid rather than stacked, which is what recharts drew.
            ...(kind === "area" ? { areaStyle: { opacity: 0.25 } } : {}),
          };

    let series: Record<string, unknown>[];
    let cats: (string | number | null)[];

    if (seriesField) {
      const seriesVals = uniq(rows.map((r) => r[seriesField]));
      // One aggregate per series value, so duplicates inside a series are summed too.
      const perSeries = seriesVals.map((sv) => ({
        sv,
        agg: aggregateByCategory(
          rows.filter((r) => sameValue(r[seriesField], sv)),
          x,
          [measure],
        ),
      }));
      // The category axis is the union across series, in first-seen order.
      cats = uniq(perSeries.flatMap((ps) => ps.agg.map((r) => r[x] as string | number | null)));
      series = perSeries.map((ps) => ({
        // Was `String(sv)`, so a chart split by month showed a Jalali date on the axis and an ISO one
        // in the legend at the same time.
        name: formatCategory(ps.sv, dir),
        ...shape,
        data: cats.map((c) => {
          const hit = ps.agg.find((r) => sameValue(r[x], c));
          return hit ? Number(hit[measure] ?? 0) : 0;
        }),
      }));
    } else {
      const agg = aggregateByCategory(rows, x, ys);
      cats = agg.map((r) => r[x] as string | number | null);
      series = ys.map((yk) => ({
        name: columnLabel(yk),
        ...shape,
        data: agg.map((r) => Number(r[yk] ?? 0)),
      }));
    }

    return {
      tooltip: {
        ...tooltip,
        trigger: "axis",
        // A band highlight suits bars; a crosshair line suits a curve. recharts drew the same
        // distinction with its own cursor.
        axisPointer: { type: kind === "bar" ? "shadow" : "line" },
      },
      legend: {
        ...legend,
        /**
         * Off for a single series, which is the common shape auto-viz produces.
         *
         * ECharts defaults `selectedMode` to true, so one click on the only legend entry empties the
         * chart — and because we `setOption` with `notMerge`, the next re-render silently puts it back.
         * A toggle that blanks the whole chart and then undoes itself reads as a glitch, not a control.
         * With several series it is genuinely useful, so it stays.
         */
        selectedMode: series.length > 1,
      },
      // containLabel keeps billion-scale value labels inside the canvas instead of clipping them at
      // the fixed margins. `bottom` also has to clear the legend, which now sits underneath.
      grid: { left: 48, right: 48, bottom: 64, top: 32, containLabel: true },
      xAxis: {
        type: "category",
        data: cats.map((c) => formatCategory(c, dir)),
        inverse: dir === "rtl",
        // recharts' CartesianGrid drew dashed lines on BOTH axes. ECharts hides the category one by
        // default, so it has to be asked for; the dash pattern itself lives in the theme.
        splitLine: { show: true },
        axisLabel: {
          /**
           * NOT `interval: 0`.
           *
           * Forcing every label drew them on top of each other. Measured at 360px with six real
           * province names: the plot gives 44px per category while the labels are 72.0, 93.6, 98.3,
           * 93.6, 65.6 and 38.5px wide — five of six overflow, the widest by more than double.
           * recharts thinned with `preserveEnd`; ECharts' default `"auto"` does the same job, hiding
           * what will not fit rather than overlapping it.
           */
          rotate: cats.length > 8 ? 30 : 0,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: "value",
        position: dir === "rtl" ? "right" : "left",
        axisLabel: { formatter: (v: number) => valueFormatter(v) },
      },
      dataZoom: cats.length > 25 ? [{ type: "slider" }] : undefined,
      series,
      // Carried so a click can be turned back into the value the reader actually clicked, and so the
      // event wiring below knows which kind it is dealing with. Not ECharts options; ECharts ignores
      // what it does not recognise.
      rwCategories: cats,
      rwKind: kind,
    };
  }, [view, result, rows, dir, columnLabel, kind, donutRows, pieCategory, pieMeasure]);

  /**
   * Turn a click into the group behind the category that was clicked.
   *
   * Was `result.groups?.[p.dataIndex]` -- positional, and wrong on any sorted report, because the
   * engine builds `groups` while collecting rows and then sorts and slices the rows without ever
   * re-ordering `groups`. See `drill.ts` for the measurement.
   */
  const events = useMemo(() => {
    if (!onDrill) return undefined;
    const meta = option as { rwCategories?: (string | number | null)[]; rwKind?: ChartKind };
    // Only bars drill, which is what recharts did — its onClick lived on `<BarChart>` alone. Giving a
    // line chart a drill it never had is a product change, not a migration detail.
    if (meta.rwKind && meta.rwKind !== "bar") return undefined;
    const cats = meta.rwCategories;
    return {
      click: (p: { dataIndex?: number }) => {
        if (typeof p?.dataIndex !== "number") return;
        const node = resolveDrillTarget(result.groups, cats?.[p.dataIndex]);
        if (node) onDrill(node);
      },
    };
  }, [onDrill, option, result.groups]);

  const ref = useEChart(option, events as never);

  if (kind === "pie") {
    const total = donutRows.reduce(
      (sum, row) => sum + (typeof row[pieMeasure] === "number" ? (row[pieMeasure] as number) : 0),
      0,
    );
    const share = (v: unknown) => (total > 0 && typeof v === "number" ? (v * 100) / total : 0);

    /**
     * Ported from the recharts donut unchanged, on purpose. Every part of this layout exists because
     * of something measured, and swapping the library does not change any of those reasons:
     *
     * - the flex row, because a library-drawn side legend left ~300px of dead space;
     * - the overlay for the total, because a percentage `cx` and a percentage SVG `<text x>` resolve
     *   against different boxes, so the number could not be centred in the hole;
     * - the hand-written key, because the library painted legend text in the series colour, which is
     *   picked to work as a fill and measured 2.54:1 as 12px words.
     *
     * Keeping it identical is also what lets the existing donut-total and donut-legend assertions
     * carry over as they are.
     */
    return (
      // Distinct keys on the two branches, so React unmounts rather than repurposes. Without them it
      // keeps the same <div> and just rewrites its props — inheriting the inline styles ECharts wrote
      // onto it (position, user-select) into what is now a plain flex row.
      <div
        key="donut"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          flexWrap: "wrap",
          padding: "8px 0",
        }}
      >
        <div style={{ position: "relative", width: 240, height: 240, flex: "0 0 auto" }}>
          <div ref={ref} data-testid="echarts-canvas" style={{ width: "100%", height: "100%" }} />

          {/* The total, in the hole. An overlay rather than an SVG <text>, so it is centred on the
              ring by the same box that draws the ring. */}
          <div
            data-testid="donut-total"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
              {/* The hole is 136px across and the number is whatever the data says. Ten characters
                  fit; «۱۵٬۰۴۵٬۵۰۰٬۰۰۰» is fourteen and becomes «۱۵ میلیارد». */}
              {formatFitted(total, dir)}
            </span>
            <span style={{ fontSize: 12, color: colors.axis }}>{columnLabel(pieMeasure)}</span>
          </div>
        </div>

        <ul
          data-testid="donut-legend"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, minWidth: 0 }}
        >
          {donutRows.map((row, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: palette[i % palette.length],
                  flex: "0 0 auto",
                }}
              />
              {/*
                Two <bdi>s, because this one line mixes scripts and the reader is not always Persian.
                In an English page the row is `تهران — 36.97%`: the name is a right-to-left run, the
                share is a left-to-right one, and the neutral dash between them belongs to neither.
                The bidi algorithm resolves that by reordering — the share jumped to the front of the
                line and the percent sign came off the number. `bdi` isolates each part, so the two
                stay in the order the markup puts them in whichever direction the page runs.
              */}
              <span style={{ color: colors.text }}>
                <bdi>{formatCategory(row[pieCategory] as string | number | null, dir)}</bdi> —{" "}
                <bdi>{formatPercent(Number(share(row[pieMeasure]).toFixed(2)), dir)}</bdi>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /**
   * 320, matching recharts' `<ResponsiveContainer height={320}>`. It was 360, which would have made
   * every chart in every dashboard widget 40px taller the moment views started routing here — a
   * layout change disguised as a library change.
   *
   * `valueAxisWidth` from RechartsRenderer is deliberately NOT ported: `grid.containLabel` already
   * measures the value labels and reserves room for them. That is the cleanest net deletion in this
   * migration.
   */
  return (
    <div key="cartesian" ref={ref} data-testid="echarts-canvas" style={{ height: 320, width: "100%" }} />
  );
}
