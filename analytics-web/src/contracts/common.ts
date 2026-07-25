// R1: shared scalars defined ONCE here; imported by report-definition.ts & semantic.ts.

/**
 * Primitive value type of a field (reconciled per R1: the §5 FieldType union's
 * analytical roles `dimension`/`measure` are expressed via FieldRole in semantic.ts,
 * NOT here — this is the storage/primitive type only).
 */
export type FieldType = "string" | "number" | "date" | "boolean";

/** Aggregation functions the Query Engine implements (R1). */
export type Aggregation =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "countDistinct"
  | "none";

/** How a value is rendered in tables/cards/charts (locale + RTL aware). */
export interface FieldFormat {
  kind?: "number" | "currency" | "percent" | "date" | "datetime" | "text";
  /** Intl-style locale; defaults to fa-IR. */
  locale?: string;
  /** ISO currency for kind="currency", e.g. "IRR". */
  currency?: string;
  /** decimal places for number/currency/percent. */
  decimals?: number;
  /** date pattern token, e.g. "jYYYY/jMM" for Jalali (later). */
  pattern?: string;
  prefix?: string;
  suffix?: string;
  /** thousands separator (Persian digits handled by the i18n formatter). */
  grouping?: boolean;
}
