// analytics-web/src/presentation/labels.ts
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import type { QueryResult } from "@/contracts";
import type { ReportDefinition } from "@/contracts/report-definition";
import { getModelForDataset } from "@/semantic/registry";

/**
 * A human label for a result column, in the language the app is set to.
 *
 * The engine names a metric column after its own alias, so a chart legend showed literally
 * `sum_amount`. The pieces of a real name are all present, just not joined up: the definition knows
 * the metric is a `sum` of `amount`, the semantic model knows `amount` is «درآمد» / "Revenue", and
 * i18n knows `sum` is «مجموع» / "Sum".
 *
 * Order of preference:
 *   1. «مجموع درآمد» / "Sum Revenue" composed from the aggregation and the field's own label,
 *   2. a label stored on the report, when there is nothing to compose from,
 *   3. the engine's column label, when it says more than the key does,
 *   4. the key — never a blank.
 *
 * Composition comes FIRST on purpose. A stored label is one fixed string with no language attached,
 * so an English reader was still shown «مجموع درآمد». Composing gets both languages right; the
 * stored label stays as the fallback for a metric over a field the bundled model does not describe.
 */
export function useColumnLabel(def: ReportDefinition | undefined, result: QueryResult | undefined) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fa-IR";

  return useCallback(
    (key: string): string => {
      if (!key) return key;

      // The field's own label, in the current language, from the semantic model.
      const fieldLabel = (fieldId: string): string | undefined => {
        if (!def?.dataset || fieldId === "*") return undefined;
        try {
          const model = getModelForDataset(def.dataset);
          for (const entity of model.entities) {
            const f = entity.fields.find((x) => x.id === fieldId);
            if (f) return f.label[locale] ?? f.label["fa-IR"] ?? f.label["en-US"];
          }
        } catch {
          // Unknown dataset (a drill-down child, say) — fall through to the plainer sources.
        }
        return undefined;
      };

      const metric = def?.metrics?.find(
        (m) => (m.alias ?? `${m.aggregation}_${m.field}`) === key,
      );

      if (metric) {
        const agg = t(`agg.${metric.aggregation}`, { defaultValue: "" });
        const field = fieldLabel(metric.field);
        // count over "*" is just «تعداد» — "Count of *" reads like a bug.
        if (agg && field) return `${agg} ${field}`;
        if (metric.label) return metric.label;
        if (agg) return agg;
        if (field) return field;
      }

      const dim = fieldLabel(key);
      if (dim) return dim;

      // The engine's own label. It equals the key for metrics, which is the case above; for a
      // dimension it is the field's name and worth using.
      const col = result?.columns.find((c) => c.key === key);
      if (col?.label && col.label !== key) return col.label;

      return key;
    },
    [def, result, t, locale],
  );
}
