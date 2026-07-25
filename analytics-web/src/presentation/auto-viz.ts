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

    // RULE 5 (advanced intent / matrix / huge) evaluated before rule 2/3/4:
    // - 2 dims × 1 measure (matrix),
    // - >25 categories,
    // - advanced intent (heatmap, treemap, sankey, gauge, matrix tag).
    const isMatrix = dimCount >= 2 && measures.length >= 1;
    if (advancedIntent || isMatrix || categories > TABLE_MIN_CATEGORIES) {
      if (measure) {
        const x = (dateDims[0] ?? catDims[0] ?? groupBy[0])?.field;
        const y = (catDims[0] ?? dateDims[1] ?? catDims[1])?.field ?? x;
        return view("chart", "echarts", "EChart", def.name, { x, y, measure: measure.key });
      }
    }

    // RULE 2 — one date dimension + ≥1 measure → LineChart
    if (measure && dateDims.length >= 1 && catDims.length === 0) {
      return view("chart", "recharts", "LineChart", def.name, {
        x: dateDims[0].field, y: measure.key,
      });
    }

    // RULE 4 — single dimension + measure, share intent, ≤8 slices → PieChart
    if (measure && dimCount === 1 && shareIntent && categories <= PIE_MAX_SLICES) {
      return view("chart", "recharts", "PieChart", def.name, {
        category: groupBy[0].field, measure: measure.key,
      });
    }

    // RULE 3 — one categorical dimension + measure, ≤12 categories → BarChart
    if (measure && catDims.length === 1 && dateDims.length === 0 && categories <= BAR_MAX_CATEGORIES) {
      return view("chart", "recharts", "BarChart", def.name, {
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
