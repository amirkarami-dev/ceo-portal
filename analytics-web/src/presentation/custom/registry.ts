import type { ComponentType } from "react";
import type { LocalizedLabel, ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult } from "../../contracts/dataset";

/**
 * Custom reports — the escape hatch for reports the dimensional engine cannot describe.
 *
 * `SqlQueryEngine` builds `SELECT … FROM [table] … GROUP BY …` from a `ReportDefinition`. That covers
 * a lot, and it covers nothing whose data is a **stored procedure**, whose result is one wide row
 * with its dimension in the column names, or whose parameters are procedure arguments rather than
 * column filters. The engineer-quota report is all three at once, so no definition anyone could write
 * — and no definition Ask AI could generate, since it emits for the same engine — would reach it.
 *
 * See `docs/design/2026-08-15-custom-reports-engineer-quota.md`.
 *
 * ## Why these ride the ordinary report shell
 *
 * A custom report is dispatched through `ReportView.tsx` like any other, on a new `library: "custom"`.
 * That is not a trick: `ViewLibrary` already carried a `"grid"` member implemented nowhere, so the
 * dispatcher was built to be extended. Reusing the shell means the page, the toolbar, breadcrumbs,
 * roles, i18n, the library listing and dashboards keep working, instead of each learning that there
 * are now two kinds of report.
 *
 * The price is that the saved definition's `dataset`, `groupBy` and `metrics` carry nothing. That is
 * a real wart, paid once, and it buys everything above.
 */

/** One parameter a custom report is driven by — rendered as a select by the shared picker bar. */
export interface ParamSpec {
  key: string;
  label: LocalizedLabel;
  options: { value: number | string; label: string }[];
}

/**
 * A custom report.
 *
 * `fetch` lives here rather than inside `Component` on purpose: the component only renders data it is
 * handed, so it can be tested with a literal and can never reach for a network on its own.
 *
 * @typeParam P - the report's parameters, e.g. `{ cityId: number; reshte: number }`. A type alias
 *   rather than an interface, so it satisfies `Params` below — interfaces get no implicit index
 *   signature.
 * @typeParam D - whatever `fetch` resolves to and `Component` draws.
 */
export interface CustomReport<P extends Params, D> {
  /** Matches `view.component` on the saved definition. */
  id: string;
  title: LocalizedLabel;
  params: ParamSpec[];
  defaults: P;
  fetch: (params: P) => Promise<D>;
  Component: ComponentType<{ data: D; params: P }>;
}

export type Params = Record<string, unknown>;

/**
 * An entry with its parameter and data types erased.
 *
 * The registry is heterogeneous by nature — every report has its own `P` and `D` — so what it stores
 * cannot be typed precisely. Erasing here, at one named type, is better than spraying `any` through
 * the lookups: `CustomRenderer` treats both sides opaquely and never inspects them.
 */
export type ErasedCustomReport = CustomReport<Params, unknown>;

const REGISTRY: Record<string, ErasedCustomReport> = {};

/**
 * Register at module load. Called by the report modules themselves, not by consumers.
 *
 * The single cast in this file lives here, at the boundary: each entry's `P` and `D` are fully
 * checked where the entry is written, and only the storage is erased. React props are contravariant,
 * so a concrete `ComponentType<{data: QuotaRow}>` is genuinely not assignable to the erased shape —
 * the cast states that, rather than hiding it behind a looser interface.
 */
export function registerCustomReport<P extends Params, D>(entry: CustomReport<P, D>): void {
  REGISTRY[entry.id] = entry as unknown as ErasedCustomReport;
}

/** The entry a view names, or undefined when nothing is registered under that id. */
export function getCustomReport(id: string | undefined): ErasedCustomReport | undefined {
  return id ? REGISTRY[id] : undefined;
}

/** Every registered id. For tests and for the report library. */
export function customReportIds(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Does this definition render through the custom-report path?
 *
 * Shared rather than written out at each call site. `ReportViewer` and `WidgetFrame` both have to ask
 * — and both have to ask in several places each — so the answer lives in one function. The first
 * view decides: a custom report has exactly one, by construction.
 */
export function isCustomDefinition(def: ReportDefinition | undefined): boolean {
  return def?.presentation?.views?.[0]?.library === "custom";
}

/**
 * What a custom report has instead of a query result.
 *
 * Frozen and shared: it is held in state in one caller and compared by identity in effects, so a
 * fresh object per render would retrigger everything keyed on it.
 */
export const EMPTY_RESULT: QueryResult = Object.freeze({
  columns: [],
  rows: [],
  total: 0,
}) as QueryResult;
