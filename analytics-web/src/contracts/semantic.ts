import type { FieldType, Aggregation, FieldFormat } from "./common";

// FieldType, Aggregation, FieldFormat come from common.ts (R1) — NOT redefined here.

/**
 * Analytical role of a field — drives the auto-visualization rules
 * and what the Query Engine is allowed to do with it.
 *  - dimension: groupable / filterable category (province, status, customer)
 *  - measure:   numeric value that can be aggregated (revenue, area, count)
 *  - date:      time axis; special-cased for time-series detection + date grain
 */
export type FieldRole = "dimension" | "measure" | "date";

/** A single curated column exposed to the AI and the Query Engine. */
export interface Field {
  /** stable machine id used in ReportDefinition; never shown to users. */
  id: string;
  /** the actual key in the dataset row (v1) / column mapping (later). */
  column: string;
  type: FieldType;
  /**
   * Discriminant used by the query engine for grouping/time-bucketing
   * ("dimension" → GROUP BY, "date" → time-series grain, "measure" → aggregation).
   * Independent of `type` (the data primitive — string/number/date/boolean):
   * e.g. a `type:"number"` field can have `role:"dimension"` if it is a category code,
   * while a `type:"string"` status field is also a "dimension".
   */
  role: FieldRole;
  /** business labels — the mapper matches prompt terms against these. */
  label: { "fa-IR": string; "en-US": string };
  /** extra synonyms/keywords the mock AI matches (fa + en), e.g. ["درآمد","فروش","sales"]. */
  synonyms?: string[];
  format?: FieldFormat;
  /** valid default aggregation for a measure; "none" for dimensions/dates. */
  defaultAggregation?: Aggregation;
  /** aggregations the engine permits on this field (guards against sum-of-year). */
  allowedAggregations?: Aggregation[];
  /** hide from pickers but still resolvable (e.g. raw id behind a count). */
  hidden?: boolean;
}

/** Pre-declared, curated join between two entities. */
export interface Relationship {
  /** id local to the entity, referenced from ReportDefinition for drill-down. */
  id: string;
  /** target entity id within the same SemanticModel. */
  targetEntity: string;
  /** field id on THIS entity used as the foreign key. */
  localField: string;
  /** field id on the TARGET entity (its primary key). */
  targetField: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-one";
  label: { "fa-IR": string; "en-US": string };
}

/** A business entity = one logical "table" the AI can query. */
export interface Entity {
  id: string; // "project" | "sales" | "finance"
  name: { "fa-IR": string; "en-US": string };
  description?: { "fa-IR": string; "en-US": string };
  /** v1: name of the bundled sample dataset; later: physical table/view. */
  source: string;
  fields: Field[];
  relationships?: Relationship[];
  /** field id used as the natural time axis for this entity, if any. */
  defaultDateField?: string;
}

/** The full semantic model for one tenant/data-source. */
export interface SemanticModel {
  id: string;
  /** tenant scope — "global" for the v1 bundled demo tenant. */
  tenantId: string;
  name: { "fa-IR": string; "en-US": string };
  /** locale used for default label resolution. */
  defaultLocale: "fa-IR" | "en-US";
  version: number;
  entities: Entity[];
}
