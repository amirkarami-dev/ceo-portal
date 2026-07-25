import type { FieldType } from "./common";

// R3: dataset + query-result contracts. The query engine (Task: query/engine.ts)
// is PURE and SYNCHRONOUS: runQuery(def, dataset, semantic): QueryResult.

/** One raw row of a bundled sample dataset. */
export type Row = Record<string, string | number | boolean | null>;

/** A bundled sample dataset = an array of rows. */
export type Dataset = Row[];

/** A row in the computed result (post-aggregation values are number|string|null). */
export type ResultRow = Record<string, string | number | null>;

/** A resolved output column with its display label + analytical flags. */
export interface ResolvedColumn {
  key: string;
  label: string;
  type: FieldType;
  /** true when the column is an aggregated measure (drives auto-viz). */
  isMetric: boolean;
}

/** A drill-down group node: bucket value + member rows (+ nested children). */
export interface GroupNode {
  key: string;
  value: string | number;
  rows: ResultRow[];
  children?: GroupNode[];
}

/** The full output of the in-browser query engine. */
export interface QueryResult {
  columns: ResolvedColumn[];
  rows: ResultRow[];
  groups?: GroupNode[];
  total: number;
}
