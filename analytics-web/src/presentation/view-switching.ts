// analytics-web/src/presentation/view-switching.ts
import type { QueryResult, ReportView, ViewType } from "@/contracts";

/** What the view switcher can be asked for. */
export type SwitchTarget = ViewType | "bar" | "line" | "pie";

const CHART_SUBTYPES: Record<
  "bar" | "line" | "pie",
  Pick<ReportView, "type" | "library" | "component">
> = {
  // ECharts since steps 6, 7 and 8. The component strings never changed — they are the identity key
  // the switcher matches on, now through `COMPONENT_TARGET` below rather than substring sniffing.
  bar: { type: "chart", library: "echarts", component: "BarChart" },
  line: { type: "chart", library: "echarts", component: "LineChart" },
  pie: { type: "chart", library: "echarts", component: "PieChart" },
};

/**
 * Component string → the switcher button that stands for it. Lowercase keys; both the long form the
 * auto-viz rules emit and the short form hand-written views use.
 *
 * Explicit, because this was three separate ladders of `component.toLowerCase().includes("bar")` —
 * in `findViewForTarget`, `ViewSwitcher` and `WidgetFrame` — with three **different** fallbacks:
 * line, and bar, and bar. A component none of them recognised therefore appeared as a different
 * pressed button depending on which one you were looking at, and `auto-viz`'s matrix rule emitted
 * exactly such a component for as long as it existed.
 */
const COMPONENT_TARGET: Record<string, SwitchTarget> = {
  barchart: "bar",
  bar: "bar",
  linechart: "line",
  line: "line",
  piechart: "pie",
  pie: "pie",
};

/**
 * Which switcher button a view corresponds to, or **undefined when none does**.
 *
 * Undefined is an answer, not a gap. A heatmap has no button, and the honest result is a switcher
 * with nothing highlighted — the fallbacks this replaces guessed instead, and highlighted «خطی» on a
 * chart that was not a line.
 */
export function targetOfView(view: ReportView | undefined): SwitchTarget | undefined {
  if (!view) return undefined;
  // Type first: it is the reliable half. `table` and `kpi` are types, not component strings.
  if (view.type === "table" || view.type === "kpi") return view.type;
  return COMPONENT_TARGET[(view.component ?? "").toLowerCase()];
}

/**
 * A Segmented `value` that deliberately matches no option, so nothing looks pressed.
 *
 * Needed because antd's Segmented treats `undefined` as "the first option" — passing undefined for a
 * view with no button lit «جدول» rather than leaving the strip blank.
 */
export const NO_TARGET = "__no-target__";

/** Index of a view already showing this target, or -1. */
export function findViewForTarget(views: ReportView[], target: SwitchTarget): number {
  return views.findIndex((v) => targetOfView(v) === target);
}

/**
 * Build the view the switcher was asked for.
 *
 * `chooseView` only ever returns the one it picked plus a Table, so four of the five buttons have
 * nothing to select. Without this, pressing «خطی» on a saved report quietly put you back on the bar
 * chart — the control looked alive and did nothing.
 *
 * The axes are derived from the CURRENT result, not copied from the active view: a Table's mapping
 * carries only `columns`, so copying it would hand the chart undefined axes and render an empty box.
 * Values from the active view are used only where they are actually set.
 */
export function buildViewForTarget(
  target: SwitchTarget,
  result: QueryResult | undefined,
  base?: ReportView,
): ReportView {
  if (target === "table" || target === "kpi") {
    return {
      type: target,
      library: "antd",
      component: target === "table" ? "Table" : "KpiCard",
      mapping: {},
    };
  }

  const cols = result?.columns ?? [];
  const dim = cols.find((c) => !c.isMetric)?.key;
  // The first measure. A pie draws one number per slice and a bar one bar per category, so with
  // two metrics (a count AND its percentage, say) both charts show the first — which is what the
  // bar chart has always done.
  const meas = cols.find((c) => c.isMetric)?.key;

  const chartKey = target as "bar" | "line" | "pie";
  const subtype = CHART_SUBTYPES[chartKey] ?? CHART_SUBTYPES.bar;

  const mapping: ReportView["mapping"] =
    chartKey === "pie"
      ? { category: base?.mapping?.category ?? dim, measure: base?.mapping?.measure ?? meas }
      : { x: base?.mapping?.x ?? dim, y: base?.mapping?.y ?? meas };

  return { ...subtype, mapping };
}

/**
 * Can this result be drawn as the given target at all?
 *
 * Only asks whether the shape exists — not whether it is the prettiest choice. A pie of twelve
 * slices is busy, but if someone asks for it they get it; the automatic pick is a separate rule
 * (`AUTO_VIZ_THRESHOLDS`).
 */
export function canRenderTarget(target: SwitchTarget, result: QueryResult): boolean {
  if (target === "table") return true;

  const measures = result.columns.filter((c) => c.isMetric).length;
  const dims = result.columns.filter((c) => !c.isMetric).length;

  if (target === "kpi") return measures > 0;
  // A pie is one slice per category, so it needs something to slice by and something to size with.
  if (target === "pie") return measures > 0 && dims > 0;
  // Bar and line need an axis pair.
  return measures > 0 && dims > 0;
}
