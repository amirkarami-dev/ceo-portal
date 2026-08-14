import ReactECharts from "echarts-for-react";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
import { formatCategory, formatNumber, type Dir } from "../format";
import { useUiStore } from "../../store/ui-store";
import { echartsTheme } from "../../theme/echarts-theme";
import { useColumnLabel } from "../labels";

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

function uniq(values: (string | number | null)[]): (string | number)[] {
  const seen = new Set<string>();
  const out: (string | number)[] = [];
  for (const v of values) {
    if (v === null) continue;
    const k = String(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

export default function EChartsRenderer({ view, def, result, onDrill }: RendererProps) {
  // Series carry the engine's column alias; a legend showing "sum_amount" is the key, not a name.
  const columnLabel = useColumnLabel(def, result);
  const dir = currentDir();
  const themeMode = useUiStore((s) => s.themeMode);
  // Palette, type, axis and tooltip surfaces all come from the ECharts theme (theme/echarts-theme.ts)
  // rather than being set on each option. What stays in the options below is only what a theme cannot
  // know: reading direction and number formatting.
  const theme = echartsTheme(themeMode);
  const rows = result.rows as ResultRow[];
  // Map an ECharts click (by dataIndex on the category axis) back to its group node.
  const onEvents = onDrill
    ? { click: (p: { dataIndex?: number }) => {
        const node = typeof p?.dataIndex === "number" ? result.groups?.[p.dataIndex] : undefined;
        if (node) onDrill(node);
      } }
    : undefined;
  const x = view.mapping.x ?? "";
  const seriesField = view.mapping.series;
  const measure =
    view.mapping.measure ??
    (Array.isArray(view.mapping.y) ? view.mapping.y[0] : view.mapping.y) ??
    result.columns.find((c) => c.isMetric)?.key ??
    "";
  const valueFormatter = (v: number | string) =>
    formatNumber(typeof v === "number" ? v : Number(v), dir);

  const legend: Record<string, unknown> = dir === "rtl" ? { right: 8 } : { left: 8 };
  // The tooltip's surface and text colour come from the theme. `align` cannot: it follows the
  // reading direction, and a theme has no idea which way the page runs.
  const tooltip: Record<string, unknown> = {
    trigger: "item",
    textStyle: { align: dir === "rtl" ? "right" : "left" },
    valueFormatter,
  };

  const xCats = uniq(rows.map((r) => r[x]));
  // Raw values are kept for row matching; the axis shows localized labels
  // (date-like categories become Persian/Jalali in RTL).
  const xCatLabels = xCats.map((c) => formatCategory(c, dir));

  // 2 dimensions x 1 measure -> heatmap matrix (the ECharts trigger from 8.6).
  if (seriesField && view.component === "heatmap") {
    const yCats = uniq(rows.map((r) => r[seriesField]));
    const data: [number, number, number][] = [];
    rows.forEach((r) => {
      const xi = xCats.indexOf(r[x] as string | number);
      const yi = yCats.indexOf(r[seriesField] as string | number);
      const val = Number(r[measure] ?? 0);
      if (xi >= 0 && yi >= 0) data.push([xi, yi, val]);
    });
    const maxVal = Math.max(1, ...data.map((d) => d[2]));
    const option = {
      tooltip: { ...tooltip, position: "top" },
      legend,
      xAxis: { type: "category", data: xCatLabels, inverse: dir === "rtl" },
      yAxis: {
        type: "category",
        data: yCats.map((c) => formatCategory(c, dir)),
        // The columns already run right-to-left, so the row labels belong on the right too —
        // otherwise a reader starts at the labels, crosses the whole matrix, and comes back.
        // Only the horizontal order mirrors; rows keep their top-to-bottom order in both.
        position: dir === "rtl" ? "right" : "left",
      },
      // The colour ramp itself is in the theme's visualMap.inRange — it used to be ECharts'
      // default blue-to-red, a second palette on the same page.
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: "horizontal",
        left: dir === "rtl" ? "right" : "left",
        bottom: 0,
      },
      series: [
        {
          name: columnLabel(measure),
          type: "heatmap",
          data,
          label: { show: false },
        },
      ],
    };
    return <ReactECharts option={option} theme={theme} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
  }

  // Otherwise: grouped bar (one ECharts series per series-field value, or a
  // single series when no series-field). Handles big-category sets via dataZoom.
  let series: Record<string, unknown>[];
  if (seriesField) {
    const seriesVals = uniq(rows.map((r) => r[seriesField]));
    series = seriesVals.map((sv) => ({
      name: String(sv),
      type: "bar",
      data: xCats.map((xc) => {
        const match = rows.find(
          (r) => r[x] === xc && r[seriesField] === sv,
        );
        return match ? Number(match[measure] ?? 0) : 0;
      }),
    }));
  } else {
    series = [
      {
        name: columnLabel(measure),
        type: "bar",
        data: xCats.map((xc) => {
          const match = rows.find((r) => r[x] === xc);
          return match ? Number(match[measure] ?? 0) : 0;
        }),
      },
    ];
  }

  const option = {
    tooltip: { ...tooltip, trigger: "axis" },
    legend,
    // containLabel keeps billion-scale value labels inside the canvas instead
    // of clipping them at the fixed margins.
    grid: { left: 48, right: 48, bottom: 64, top: 32, containLabel: true },
    xAxis: {
      type: "category",
      data: xCatLabels,
      inverse: dir === "rtl",
      axisLabel: { interval: 0, rotate: xCats.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: "value",
      position: dir === "rtl" ? "right" : "left",
      axisLabel: { formatter: (v: number) => valueFormatter(v) },
    },
    dataZoom: xCats.length > 25 ? [{ type: "slider" }] : undefined,
    series,
  };
  return <ReactECharts option={option} theme={theme} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
}
