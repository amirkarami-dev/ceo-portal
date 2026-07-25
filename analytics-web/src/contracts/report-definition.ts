import type { FieldType, Aggregation, FieldFormat } from "./common";
import type { Presentation } from "./presentation";

// ============================================================
// Report Definition — single source of truth (rendering + export)
// schemaVersion lets us evolve the format without breaking
// stored definitions. v1 = "1.0".
// ============================================================

export interface ReportDefinition {
  /** Stable unique id (uuid). Persisted; referenced by dashboard widgets. */
  id: string;
  /** schema version of THIS document, e.g. "1.0". */
  schemaVersion: string;

  /** Human-facing metadata (localized, RTL-friendly). */
  name: string; // e.g. "پروژه‌های معوق بیش از ۳۰ روز"
  description?: string;
  tags?: string[];

  /** Semantic-layer dataset/entity key. NOT a raw table name. */
  dataset: string; // e.g. "projects", "sales", "invoices"

  /** Selected output columns (semantic field refs + display options). */
  columns: ColumnDef[];

  /** Row filters (AND-combined at top level; see FilterGroup for OR). */
  filters?: Filter[];
  /** Optional grouped/nested boolean logic. If present, takes precedence
   *  over the flat `filters[]` array. */
  filterGroup?: FilterGroup;

  /** Grouping (the GROUP BY dimensions). */
  groupBy?: GroupBy[];

  /** Aggregations / measures computed per group (or over the whole set
   *  when groupBy is empty). */
  metrics?: Metric[];

  /** Derived columns computed by the engine (row-level or post-aggregate). */
  calculatedFields?: CalculatedField[];

  /** Sort order applied AFTER grouping/aggregation. */
  sorting?: Sort[];

  /** Row cap applied AFTER sorting — drives "Top N". */
  limit?: number;
  offset?: number;

  /** Interactive drill-down configuration (click a row → child report). */
  drilldown?: Drilldown;

  /** How to render & export. Drives BOTH on-screen views and exporters. */
  presentation: Presentation;

  /** Tenant + audit context (later phase; optional in v1 mock). */
  meta?: ReportMeta;
}

// ---------- Columns ----------
export interface ColumnDef {
  field: string; // semantic field key, e.g. "province"
  label?: string; // display override (localized)
  /** semantic type — drives auto-viz + formatting + valid operators. */
  type?: FieldType;
  format?: FieldFormat; // number/date/currency formatting
  visible?: boolean; // default true; false = compute, hide
  width?: number; // px hint for Table renderer
}

// ---------- Filters ----------
export interface Filter {
  field: string; // semantic field key
  operator: FilterOperator;
  /** value type depends on operator (see table in §5.4). */
  value?: FilterValue;
  /** value2 used only for "between" / "notBetween". */
  value2?: FilterValue;
  /** if true, value is resolved at run time from a parameter/today(). */
  dynamic?: boolean;
}

export type FilterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | DynamicValue;

/** Run-time tokens the engine resolves (today, now, param). */
export interface DynamicValue {
  token: "today" | "now" | "startOfMonth" | "startOfYear" | "param";
  /** for relative dates: e.g. { token:"today", offsetDays:-30 } */
  offsetDays?: number;
  offsetMonths?: number;
  /** for token:"param" → name of a report parameter. */
  param?: string;
}

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "notBetween"
  | "in"
  | "notIn"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse";

/** Optional nested boolean logic (AND/OR trees). */
export interface FilterGroup {
  logic: "and" | "or";
  conditions: Array<Filter | FilterGroup>;
}

// ---------- Grouping ----------
export interface GroupBy {
  field: string; // a dimension/date field
  /** For date fields: bucket granularity. */
  dateBucket?: "day" | "week" | "month" | "quarter" | "year";
}

// ---------- Metrics / Aggregations ----------
export interface Metric {
  field: string; // measure field, or "*" for count
  aggregation: Aggregation;
  /** output column key; defaults to `${aggregation}_${field}`. */
  alias?: string;
  label?: string;
  format?: FieldFormat;
}

// ---------- Calculated fields ----------
export interface CalculatedField {
  alias: string; // new column key
  label?: string;
  /** safe expression over fields/metrics, e.g.
   *  "(revenue - cost) / revenue * 100". No raw SQL/JS eval. */
  expression: string;
  type?: FieldType;
  format?: FieldFormat;
  /** when the expression references aggregates, set scope:"aggregate". */
  scope?: "row" | "aggregate";
}

// ---------- Sorting ----------
export interface Sort {
  field: string; // a column / metric alias / calc alias
  direction: "asc" | "desc";
  /** explicit ordering priority (lower = primary); array order is the
   *  default if omitted. */
  priority?: number;
}

// ---------- Drill-down ----------
export interface Drilldown {
  enabled: boolean;
  /** the clicked group value is injected as a filter into the target. */
  targetReportId?: string; // open another saved report
  /** OR an inline definition (no separate saved report needed). */
  targetDefinition?: ReportDefinition;
  /** which field's clicked value becomes the drill filter.
   *  Optional so `{ enabled: false }` is a valid no-op drilldown literal. */
  paramField?: string; // e.g. "province"
  /** operator used when injecting the value (default "eq"). */
  operator?: FilterOperator;
}

// ---------- Meta (later phase) ----------
export interface ReportMeta {
  tenantId?: string;
  ownerId?: string;
  createdAt?: string; // ISO
  updatedAt?: string;
  /** for AI provenance + cost tracking (later). */
  generatedBy?: { provider?: string; model?: string; promptVersion?: string };
}
