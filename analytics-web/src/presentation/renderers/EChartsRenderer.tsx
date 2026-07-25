import ReactECharts from "echarts-for-react";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
import { formatCategory, formatNumber, type Dir } from "../format";
import { useUiStore } from "../../store/ui-store";
import { chartColors } from "../../theme/tokens";

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

export default function EChartsRenderer({ view, result, onDrill }: RendererProps) {
  const dir = currentDir();
  const themeMode = useUiStore((s) => s.themeMode);
  const colors = chartColors(themeMode);
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
  const tooltip: Record<string, unknown> = {
    trigger: "item",
    // ECharts' default tooltip surface is white; give it the themed surface or the
    // light `text` colour becomes white-on-white in dark mode.
    backgroundColor: colors.tooltipBg,
    borderColor: colors.tooltipBorder,
    textStyle: { align: dir === "rtl" ? "right" : "left", color: colors.text },
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
    const axisStyle = { axisLine: { lineStyle: { color: colors.axis } }, axisLabel: { color: colors.axis } };
    const option = {
      backgroundColor: "transparent",
      tooltip: { ...tooltip, position: "top" },
      legend,
      xAxis: { type: "category", data: xCatLabels, inverse: dir === "rtl", ...axisStyle },
      yAxis: { type: "category", data: yCats.map((c) => formatCategory(c, dir)), ...axisStyle },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: "horizontal",
        left: dir === "rtl" ? "right" : "left",
        bottom: 0,
        textStyle: { color: colors.text },
      },
      series: [
        {
          name: measure,
          type: "heatmap",
          data,
          label: { show: false },
        },
      ],
    };
    return <ReactECharts option={option} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
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
        name: measure,
        type: "bar",
        data: xCats.map((xc) => {
          const match = rows.find((r) => r[x] === xc);
          return match ? Number(match[measure] ?? 0) : 0;
        }),
      },
    ];
  }

  const option = {
    backgroundColor: "transparent",
    color: colors.series,
    tooltip: { ...tooltip, trigger: "axis" },
    legend,
    // containLabel keeps billion-scale value labels inside the canvas instead
    // of clipping them at the fixed margins.
    grid: { left: 48, right: 48, bottom: 64, top: 32, containLabel: true, borderColor: colors.grid },
    xAxis: {
      type: "category",
      data: xCatLabels,
      inverse: dir === "rtl",
      axisLine: { lineStyle: { color: colors.axis } },
      axisLabel: { interval: 0, rotate: xCats.length > 8 ? 30 : 0, color: colors.axis },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: "value",
      position: dir === "rtl" ? "right" : "left",
      axisLine: { lineStyle: { color: colors.axis } },
      axisLabel: { formatter: (v: number) => valueFormatter(v), color: colors.axis },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    dataZoom: xCats.length > 25 ? [{ type: "slider" }] : undefined,
    series,
  };
  return <ReactECharts option={option} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
}
