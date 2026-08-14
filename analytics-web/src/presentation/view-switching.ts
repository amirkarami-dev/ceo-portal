// analytics-web/src/presentation/view-switching.ts
import type { QueryResult, ReportView, ViewType } from "@/contracts";

/** What the view switcher can be asked for. */
export type SwitchTarget = ViewType | "bar" | "line" | "pie";

const CHART_SUBTYPES: Record<
  "bar" | "line" | "pie",
  Pick<ReportView, "type" | "library" | "component">
> = {
  // ECharts since step 6. Line and pie follow in steps 7 and 8; the component strings never change.
  bar: { type: "chart", library: "echarts", component: "BarChart" },
  line: { type: "chart", library: "recharts", component: "LineChart" },
  pie: { type: "chart", library: "recharts", component: "PieChart" },
};

/** Index of a view already showing this target, or -1. */
export function findViewForTarget(views: ReportView[], target: SwitchTarget): number {
  return views.findIndex((v) =>
    target === "table" || target === "kpi"
      ? v.type === target
      : v.component.toLowerCase().includes(target),
  );
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
