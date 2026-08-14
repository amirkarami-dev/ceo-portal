// analytics-web/src/presentation/labels.ts
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import type { QueryResult } from "@/contracts";
import type { LabelLocale, ReportDefinition } from "@/contracts/report-definition";
import { getModelForDataset } from "@/semantic/registry";

/**
 * Just enough of i18next's `t` to look up `agg.*`. Typed narrowly on purpose so the resolver below
 * stays a plain function: exports (CSV, XLSX, PDF) are not components and cannot call a hook, but
 * they can pass `i18n.t`.
 *
 * `lng` is not optional decoration. A `t` taken from `useTranslation()` is bound to whatever language
 * the app is currently showing, so asking the resolver for "en-US" while the UI sat in Persian
 * produced «مجموع Revenue» — the aggregation word from the UI's language and the field label from the
 * requested one. Every call below passes `lng` so both halves come from the same language.
 */
export type LabelTranslator = (
  key: string,
  opts?: { defaultValue?: string; lng?: string },
) => string;

/** The app's two-letter language → the locale key `LocalizedLabel` is stored under. */
export function labelLocaleOf(language: string | undefined): LabelLocale {
  return language?.startsWith("en") ? "en-US" : "fa-IR";
}

/** The reverse: the i18next language code for a stored locale key. */
function languageOf(locale: LabelLocale): string {
  return locale === "en-US" ? "en" : "fa";
}

const trimmed = (v: string | undefined): string | undefined => {
  const s = v?.trim();
  return s ? s : undefined;
};

/**
 * A human label for a result column, in the language the app is set to.
 *
 * The engine names a metric column after its own alias, so a chart legend showed literally
 * `sum_amount`. The pieces of a real name are all present, just not joined up: the definition knows
 * the metric is a `sum` of `amount`, the semantic model knows `amount` is «درآمد» / "Revenue", and
 * i18n knows `sum` is «مجموع» / "Sum".
 *
 * Order of preference:
 *   1. what a PERSON typed for this column in THIS language (`def.labelOverrides`),
 *   2. «مجموع درآمد» / "Sum Revenue" composed from the aggregation and the field's own label,
 *   3. a label stored on the report, when there is nothing to compose from,
 *   4. the engine's column label, when it says more than the key does,
 *   5. the key — never a blank.
 *
 * Why 1 is separate from 3, and why it must be checked FIRST:
 *
 * A stored `metric.label` is one fixed string with no language attached, and the AI writes a Persian
 * one onto every report it generates — so honouring it showed «مجموع درآمد» to an English reader.
 * That is why composition beats it. A human override is a different thing: it is per language, so it
 * can win outright without reintroducing that bug. The other language keeps composing.
 *
 * It has to sit above the whole metric branch, not inside it. Composition returns as soon as it has
 * an aggregation word and a field label — including for `aggregation: "none"`, because `t("agg.none")`
 * resolves to "None" / «بدون» rather than empty. An override checked next to `metric.label` would
 * never fire for the common case.
 *
 * This is a plain function so the exporters can share it; `useColumnLabel` below is the hook form.
 */
export function resolveColumnLabel(
  def: ReportDefinition | undefined,
  result: QueryResult | undefined,
  key: string,
  locale: LabelLocale,
  t: LabelTranslator,
): string {
  if (!key) return key;

  // 1. What a person typed, in the language being read.
  const override = trimmed(def?.labelOverrides?.[key]?.[locale]);
  if (override) return override;

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
    // `lng` pinned to the requested locale, not the app's — otherwise the aggregation word and the
    // field label can come from different languages and compose «مجموع Revenue».
    const agg = t(`agg.${metric.aggregation}`, { defaultValue: "", lng: languageOf(locale) });
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
}

/**
 * The report's title in the language being read: what a person typed for this language, else the
 * definition's own `name`.
 *
 * `name` is the un-overridden original and stays that way — it is what the server keeps in the
 * `AnalyticsReport.Name` column and what the library list sorts and searches on.
 */
export function resolveReportTitle(
  def: Pick<ReportDefinition, "name" | "titleOverrides"> | undefined,
  locale: LabelLocale,
): string {
  if (!def) return "";
  return trimmed(def.titleOverrides?.[locale]) ?? def.name ?? "";
}

/** Hook form of {@link resolveColumnLabel}, bound to the current language. */
export function useColumnLabel(def: ReportDefinition | undefined, result: QueryResult | undefined) {
  const { t, i18n } = useTranslation();
  const locale = labelLocaleOf(i18n.language);

  return useCallback(
    (key: string): string => resolveColumnLabel(def, result, key, locale, t),
    [def, result, t, locale],
  );
}

/** Hook form of {@link resolveReportTitle}, bound to the current language. */
export function useReportTitle(
  def: Pick<ReportDefinition, "name" | "titleOverrides"> | undefined,
): string {
  const { i18n } = useTranslation();
  return resolveReportTitle(def, labelLocaleOf(i18n.language));
}
