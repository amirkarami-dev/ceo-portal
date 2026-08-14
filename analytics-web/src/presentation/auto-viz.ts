// report-web/src/presentation/auto-viz.ts
import type { ReportDefinition } from "../contracts/report-definition";
import type { ReportView, ViewMapping } from "../contracts/presentation";
import type { QueryResult, ResolvedColumn } from "../query/engine";
import type { SemanticModel, Field } from "../contracts/semantic";

/** EXACT §8.6 thresholds — single source of truth for view selection. */
export const AUTO_VIZ_THRESHOLDS = {
  BAR_MAX_CATEGORIES: 12, // ≤ ~12 categories → bar
  PIE_MAX_SLICES: 8,      // ≤ ~8 slices → pie
  TABLE_MIN_CATEGORIES: 25, // > ~25 categories → echarts/advanced
} as const;

const ADVANCED_INTENT = ["heatmap", "treemap", "sankey", "gauge", "matrix"];

function fieldRole(semantic: SemanticModel, fieldId: string): Field["role"] | undefined {
  for (const e of semantic.entities) {
    const f = e.fields.find((x) => x.id === fieldId);
    if (f) return f.role;
  }
  return undefined;
}

const view = (
  type: ReportView["type"],
  library: ReportView["library"],
  component: string,
  title: string | undefined,
  mapping: ViewMapping,
): ReportView => ({ type, library, component, title, mapping });

function tableView(def: ReportDefinition, result: QueryResult): ReportView {
  return view("table", "antd", "Table", def.name, {
    columns: result.columns.map((c) => c.key),
  });
}

export function chooseView(
  def: ReportDefinition,
  result: QueryResult,
  semantic: SemanticModel,
): ReportView[] {
  const { BAR_MAX_CATEGORIES, PIE_MAX_SLICES, TABLE_MIN_CATEGORIES } = AUTO_VIZ_THRESHOLDS;

  const groupBy = def.groupBy ?? [];
  const measures: ResolvedColumn[] = result.columns.filter((c) => c.isMetric);
  const measure = measures[0];

  // classify the GROUP BY dimensions
  const dateDims = groupBy.filter((g) => !!g.dateBucket || fieldRole(semantic, g.field) === "date");
  const catDims = groupBy.filter((g) => !g.dateBucket && fieldRole(semantic, g.field) !== "date");
  const dimCount = groupBy.length;
  const categories = result.total; // distinct group rows

  const tags = def.tags ?? [];
  const shareIntent =
    tags.includes("share") ||
    // Guard: backend-generated ReportDefinitions have no `presentation` field
    // (only the mock AI sets one), so this must be optional-chained.
    (def.presentation?.views?.some((v) => v.component === "PieChart") ?? false);
  const advancedIntent = tags.some((t) => ADVANCED_INTENT.includes(t));

  const primary: ReportView = (() => {
    // RULE 1 — single measure, no dimension (or 1 row and NOT a matrix) → KPI.
    // Checked first for the dimCount===0 case; the total<=1 shortcut is guarded against
    // the matrix case (dimCount >= 2) so that 2 dims × 1 measure goes to ECharts (rule 5a).
    if (measure && (dimCount === 0 || (categories <= 1 && dimCount < 2))) {
      return view("kpi", "antd", "Card", def.name, { value: measure.key });
    }

    /**
     * RULE 5 — the advanced cases, evaluated before 2/3/4.
     *
     * This used to be one branch emitting `component: "EChart"` with `mapping: { x, y, measure }`
     * where **`y` was a second DIMENSION**. Two things followed, and both were live:
     *
     * - `seriesKeysOf` prefers `mapping.y` over `mapping.measure`, so the chart plotted the dimension
     *   column and the measure was dropped. `Number("Tehran")` is NaN, which ECharts draws as zero:
     *   every matrix report rendered **all-zero bars** with a legend naming a province. Measured, not
     *   inferred — `series: [{ type: "bar", name: "Province", data: [0, 0] }]` off a live instance.
     * - `"EChart"` matched none of the switcher's targets, so no button ever looked pressed and every
     *   press built a duplicate view instead of selecting the existing one.
     *
     * The heatmap it was reaching for was also **unreachable**: the renderer's heatmap branch needs
     * `mapping.series` and `component === "heatmap"`, and this set neither.
     *
     * Split into the two questions it was conflating.
     */

    // RULE 5a — 2 dimensions × a measure. This is the matrix, and now it really is a heatmap.
    const isMatrix = dimCount >= 2 && measures.length >= 1;
    if (measure && isMatrix) {
      const x = (dateDims[0] ?? catDims[0] ?? groupBy[0])?.field;
      // The OTHER dimension, by identity rather than by position — picking `catDims[0]` returned the
      // same field as `x` whenever both dimensions were categorical.
      const series = groupBy.map((g) => g.field).find((f) => f !== x);
      if (x && series) {
        return view("chart", "echarts", "heatmap", def.name, { x, series, measure: measure.key });
      }
    }

    /**
     * RULE 5b/5c — more categories than a bar can label, or an advanced tag (heatmap, treemap,
     * sankey, gauge, matrix) on a report with only one dimension.
     *
     * Still a chart, because that was the intent, but one that plots the **measure**. A tag cannot
     * conjure a second dimension, so there is no matrix to draw here; and above 25 categories the
     * renderer already adds a dataZoom slider, which is the real answer to label crowding.
     */
    if (measure && (advancedIntent || categories > TABLE_MIN_CATEGORIES)) {
      const x = (dateDims[0] ?? catDims[0] ?? groupBy[0])?.field;
      if (x) {
        return view("chart", "echarts", dateDims[0] ? "LineChart" : "BarChart", def.name, {
          x,
          y: measure.key,
        });
      }
    }

    // RULE 2 — one date dimension + ≥1 measure → LineChart
    //
    // ECharts since step 7. The component string stays "LineChart" for the same reason "BarChart"
    // did: four places sniff it as a case-insensitive substring and nothing type-checks a rename.
    if (measure && dateDims.length >= 1 && catDims.length === 0) {
      return view("chart", "echarts", "LineChart", def.name, {
        x: dateDims[0].field, y: measure.key,
      });
    }

    // RULE 4 — single dimension + measure, share intent, ≤8 slices → PieChart
    //
    // ECharts since step 8, the last view to move. Only the RING is the library: the total in the
    // hole and the key beside it are markup the renderer owns, unchanged from recharts.
    if (measure && dimCount === 1 && shareIntent && categories <= PIE_MAX_SLICES) {
      return view("chart", "echarts", "PieChart", def.name, {
        category: groupBy[0].field, measure: measure.key,
      });
    }

    // RULE 3 — one categorical dimension + measure, ≤12 categories → BarChart
    //
    // ECharts, not recharts, since step 6 of docs/design/2026-08-14-recharts-to-echarts.md. The
    // component string stays "BarChart": it is the identity key for `findViewForTarget`,
    // `ViewSwitcher`, `WidgetFrame` and AskAiBuilder's motion key, all of which sniff it as a
    // case-insensitive substring. Renaming it to "bar" breaks the view switcher with nothing to
    // type-check the break.
    if (measure && catDims.length === 1 && dateDims.length === 0 && categories <= BAR_MAX_CATEGORIES) {
      return view("chart", "echarts", "BarChart", def.name, {
        x: catDims[0].field, y: measure.key,
      });
    }

    // RULE 6 — fallback: Table
    return tableView(def, result);
  })();

  // Always offer a Table as a secondary view (unless the primary already is one).
  if (primary.type === "table") return [primary];
  return [primary, tableView(def, result)];
}
