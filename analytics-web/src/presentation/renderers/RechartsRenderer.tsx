import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
import { formatCategory, formatFitted, formatNumber, type Dir } from "../format";
import { aggregateByCategory } from "./chart-utils";
import { useUiStore } from "../../store/ui-store";
import { chartColors } from "../../theme/tokens";
import { useColumnLabel } from "../labels";
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

function yKeys(view: ReportView): string[] {
  const y = view.mapping.y;
  if (Array.isArray(y)) return y;
  if (typeof y === "string") return [y];
  if (view.mapping.measure) return [view.mapping.measure];
  return [];
}

/**
 * Width the value axis needs for its longest formatted tick. Recharts reserves
 * a fixed 60px by default — billion-scale labels overflow that strip and (in
 * RTL, where anchored text runs leftward) get painted over by the bars.
 */
function valueAxisWidth(
  data: ResultRow[],
  ys: string[],
  numFmt: (v: number) => string,
): number {
  let maxLen = 1;
  for (const r of data) {
    for (const k of ys) {
      const v = r[k];
      if (typeof v === "number") maxLen = Math.max(maxLen, numFmt(v).length);
    }
  }
  // +1: axis ticks round up past the max data value ("5.9B" → "6,000,000,000").
  return Math.min(120, (maxLen + 1) * 7 + 12);
}

/** Display copy of aggregated rows: date-like category values become Persian
 *  (Jalali) labels in RTL; axis, legend, and tooltip then all stay consistent. */
function withCategoryLabels(data: ResultRow[], key: string, dir: Dir): ResultRow[] {
  return data.map((r) => ({ ...r, [key]: formatCategory(r[key], dir) }));
}

export default function RechartsRenderer({ view, def, result, onDrill }: RendererProps) {
  const dir = currentDir();
  // Series are keyed by the engine's column alias ("sum_amount"). That key is fine as an id and
  // wrong as a caption, so every place a key would be SHOWN goes through this.
  const label = useColumnLabel(def, result);
  const themeMode = useUiStore((s) => s.themeMode);
  const colors = chartColors(themeMode);
  const palette = colors.series;
  const rawRows = result.rows as ResultRow[];
  const x = view.mapping.x ?? "";
  const ys = yKeys(view);
  const kind = view.component || view.type;
  const numFmt = (v: number) => formatNumber(v, dir);
  // Only the bottom, horizontal legend is recharts' to place now. The donut lays itself out as a
  // flex row, so its side follows the page direction with no prop involved — see the pie block.
  // `legendPlacement(dir).side` is still what EChartsRenderer needs.
  const { inline: legendAlign } = legendPlacement(dir);
  // Recharts' default tooltip surface is white — with our light text colour that made
  // dark-mode tooltips white-on-white. Theme the surface AND both text layers (the header
  // uses labelStyle, the value rows use itemStyle; contentStyle.color alone covers neither).
  const tooltipProps = {
    formatter: (v: number) => numFmt(v),
    contentStyle: {
      backgroundColor: colors.tooltipBg,
      border: `1px solid ${colors.tooltipBorder}`,
      borderRadius: 8,
      color: colors.text,
    },
    labelStyle: { color: colors.text },
    itemStyle: { color: colors.text },
  } as const;
  // Recharts paints legend TEXT in the series colour. Those colours are chosen to be told apart as
  // fills, which is a much lower bar than being readable as 12px text: measured on the dark panel
  // the blue series came out at 2.54:1 and the deep green at 2.67, against a floor of 4.5. The dot
  // already carries the colour, so the words are painted in the normal text colour instead.
  const legendProps = {
    align: legendAlign,
    formatter: (value: string) => <span style={{ color: colors.text }}>{value}</span>,
  } as const;

  // Map a clicked datum back to its engine group node (drill source); no-op without onDrill or groups.
  const handleClick = (index: number) => {
    const node = result.groups?.[index];
    if (onDrill && node) onDrill(node);
  };

  if (kind === "PieChart" || kind === "pie") {
    const category = view.mapping.category ?? x;
    const measure = view.mapping.measure ?? ys[0] ?? "";
    const data = withCategoryLabels(
      aggregateByCategory(rawRows, category, measure ? [measure] : []),
      category,
      dir,
    );

    // A ring rather than a filled circle: the hole carries the total, which is the number people
    // look for first and which a pie otherwise makes you add up yourself.
    const total = data.reduce(
      (sum, row) => sum + (typeof row[measure] === "number" ? (row[measure] as number) : 0),
      0,
    );
    const share = (v: unknown) =>
      total > 0 && typeof v === "number" ? (v * 100) / total : 0;
    const measureLabel = label(measure);

    const sweep = pieSweep(dir);

    // The ring and the legend are laid out here rather than by recharts.
    //
    // Recharts positions a side legend itself and then centres the pie in whatever is left, which
    // left ~300px of nothing between the two and no way to put the total in the hole: the Pie's
    // `cx` percentage is measured against the plot box, while a raw <text x="%"> is measured against
    // the whole SVG, so the same "68%" landed in two different places.
    //
    // As a flex row the ring is its own square box — the pie centres at 50% of it and the total sits
    // dead centre by construction — and RTL needs no thought at all: the row follows the page's
    // direction, so the ring lands at the reading edge and the key after it.
    return (
      <div
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
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                {...tooltipProps}
                formatter={(v: number) =>
                  `${numFmt(v)}  (${formatNumber(+share(v).toFixed(2), dir)}٪)`
                }
              />
              <Pie
                data={data}
                dataKey={measure}
                nameKey={category}
                cx="50%"
                cy="50%"
                // The hole. 62% of the outer radius keeps the ring thick enough to read at a glance
                // while leaving room for the total.
                innerRadius={68}
                outerRadius={110}
                paddingAngle={2}
                cornerRadius={6}
                // Largest slice at 12 o'clock, sweeping the way the language runs.
                startAngle={sweep.startAngle}
                endAngle={sweep.endAngle}
                isAnimationActive={false}
                // No labels on the ring: they collide as soon as a category is small, and twelve
                // project types include four under 0.1%. The share goes in the legend instead.
                label={false}
                labelLine={false}
              >
                {data.map((_row, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} stroke="none" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

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
            <span style={{ fontSize: 12, color: colors.axis }}>{measureLabel}</span>
          </div>
        </div>

        {/* The legend, as markup. The dot carries the colour and the words carry the normal text
            colour — recharts paints legend text in the series colour, which is chosen to work as a
            fill and measured 2.54:1 as 12px words. */}
        <ul
          data-testid="donut-legend"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, minWidth: 0 }}
        >
          {data.map((row, i) => (
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
              <span style={{ color: colors.text }}>
                {String(row[category] ?? "")} — {formatNumber(+share(row[measure]).toFixed(2), dir)}٪
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === "LineChart" || kind === "line") {
    const data = withCategoryLabels(aggregateByCategory(rawRows, x, ys), x, dir);
    const yw = valueAxisWidth(data, ys, numFmt);
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey={x} reversed={dir === "rtl"} tick={{ fill: colors.axis }} stroke={colors.axis} />
          <YAxis orientation={dir === "rtl" ? "right" : "left"} width={yw} tickFormatter={numFmt} tick={{ fill: colors.axis, style: { direction: "ltr" } }} stroke={colors.axis} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {ys.map((yk, i) => (
            <Line
              key={yk}
              type="monotone"
              dataKey={yk}
              name={label(yk)}
              stroke={palette[i % palette.length]}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "AreaChart" || kind === "area") {
    const data = withCategoryLabels(aggregateByCategory(rawRows, x, ys), x, dir);
    const yw = valueAxisWidth(data, ys, numFmt);
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey={x} reversed={dir === "rtl"} tick={{ fill: colors.axis }} stroke={colors.axis} />
          <YAxis orientation={dir === "rtl" ? "right" : "left"} width={yw} tickFormatter={numFmt} tick={{ fill: colors.axis, style: { direction: "ltr" } }} stroke={colors.axis} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {ys.map((yk, i) => (
            <Area
              key={yk}
              type="monotone"
              dataKey={yk}
              name={label(yk)}
              stroke={palette[i % palette.length]}
              fill={palette[i % palette.length]}
              fillOpacity={0.25}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // default: BarChart
  const data = withCategoryLabels(aggregateByCategory(rawRows, x, ys), x, dir);
  const yw = valueAxisWidth(data, ys, numFmt);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        onClick={(e: { activeTooltipIndex?: number }) => {
          if (typeof e?.activeTooltipIndex === "number") handleClick(e.activeTooltipIndex);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis dataKey={x} reversed={dir === "rtl"} tick={{ fill: colors.axis }} stroke={colors.axis} />
        <YAxis orientation={dir === "rtl" ? "right" : "left"} width={yw} tickFormatter={numFmt} tick={{ fill: colors.axis, style: { direction: "ltr" } }} stroke={colors.axis} />
        <Tooltip {...tooltipProps} />
        <Legend {...legendProps} />
        {ys.map((yk, si) => (
          <Bar key={yk} dataKey={yk} name={label(yk)} fill={palette[si % palette.length]}>
            {data.map((_row, ri) => (
              <Cell key={`${yk}-${ri}`} fill={palette[si % palette.length]} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
