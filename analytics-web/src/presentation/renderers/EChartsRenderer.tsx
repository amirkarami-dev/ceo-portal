import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
import { formatCategory, formatNumber, type Dir } from "../format";
import { useMemo } from "react";
import { useEChart } from "../../components/charts/useEChart";
import { useColumnLabel } from "../labels";
import { aggregateByCategory } from "./chart-utils";
import { seriesKeysOf } from "../series-keys";
import { resolveDrillTarget } from "./drill";
import { legendPlacement } from "../chart-rtl";

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

  /**
   * One option, built in a memo, for both chart kinds.
   *
   * The two shapes used to be two early returns, each rendering its own `<ReactECharts>`. A hook
   * cannot be called conditionally, so the branch moved inside here and there is a single
   * `useEChart` below. That is also why the memo matters: without it a new option object every render
   * would send `setOption` on every render — not a rebuild, but pointless work on every keystroke in a
   * filter box.
   */
  const option = useMemo(() => {
    const x = view.mapping.x ?? "";
    const seriesField = view.mapping.series;
    // Every y key the view asks for, not just the first. `mapping.y` is `string | string[]`, and this
    // used to collapse to one measure, so a two-measure view silently drew half its data. Shared with
    // RechartsRenderer so the two cannot disagree about what a view plots.
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
        type: "bar",
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
        type: "bar",
        data: agg.map((r) => Number(r[yk] ?? 0)),
      }));
    }

    return {
      tooltip: { ...tooltip, trigger: "axis" },
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
      // Carried so a click can be turned back into the value the reader actually clicked. Not an
      // ECharts option; ECharts ignores what it does not recognise.
      rwCategories: cats,
    };
  }, [view, result, rows, dir, columnLabel]);

  /**
   * Turn a click into the group behind the category that was clicked.
   *
   * Was `result.groups?.[p.dataIndex]` -- positional, and wrong on any sorted report, because the
   * engine builds `groups` while collecting rows and then sorts and slices the rows without ever
   * re-ordering `groups`. See `drill.ts` for the measurement.
   */
  const events = useMemo(() => {
    if (!onDrill) return undefined;
    const cats = (option as { rwCategories?: (string | number | null)[] }).rwCategories;
    return {
      click: (p: { dataIndex?: number }) => {
        if (typeof p?.dataIndex !== "number") return;
        const node = resolveDrillTarget(result.groups, cats?.[p.dataIndex]);
        if (node) onDrill(node);
      },
    };
  }, [onDrill, option, result.groups]);

  const ref = useEChart(option, events as never);

  return <div ref={ref} data-testid="echarts-canvas" style={{ height: 360, width: "100%" }} />;
}
