import type { QuotaRow } from "./contract";

/**
 * The quota arithmetic. Pure — no React, no formatting, no ECharts — so it can be read and tested as
 * what it is: four subtractions and a clamp.
 */

/**
 * Total capacity per engineer base, in square metres.
 *
 * **Fixed by the business rule, not by the data.** Not from the stored procedure, not from the API,
 * not editable, and identical for every city and discipline. Returning these from SQL would create a
 * second source of truth for a number that must not vary.
 */
export const BASE_CAPACITY = Object.freeze({
  4: 20_000, // پایه ارشد
  1: 160_000, // پایه یک
  2: 72_000, // پایه دو
  3: 48_000, // پایه سه
} as const);

export type BaseId = keyof typeof BASE_CAPACITY;

/**
 * The four bases, **in display order**: ارشد، یک، دو، سه.
 *
 * An ordered array rather than a map keyed by base number, because that order is neither numeric nor
 * the order the procedure returns its columns in — it is the reference UI's, and a map would lose it
 * to whatever key order the runtime felt like.
 *
 * The field names are spelled out per base rather than built as `` `usedInTarahi_${base}` ``. A
 * template string would be shorter and would type-check against nothing: a typo, or a base whose
 * columns are ever named differently, becomes `undefined` at runtime and draws as zero. Listed, they
 * are checked against `QuotaRow` by the compiler.
 */
export const BASE_CONFIG: readonly {
  base: BaseId;
  title: string;
  designField: keyof QuotaRow;
  supervisionField: keyof QuotaRow;
  engineerCountField: keyof QuotaRow;
}[] = [
  {
    base: 4,
    title: "پایه ارشد",
    designField: "usedInTarahi_4",
    supervisionField: "usedInNezart_4",
    engineerCountField: "cntEngin_4",
  },
  {
    base: 1,
    title: "پایه یک",
    designField: "usedInTarahi_1",
    supervisionField: "usedInNezart_1",
    engineerCountField: "cntEngin_1",
  },
  {
    base: 2,
    title: "پایه دو",
    designField: "usedInTarahi_2",
    supervisionField: "usedInNezart_2",
    engineerCountField: "cntEngin_2",
  },
  {
    base: 3,
    title: "پایه سه",
    designField: "usedInTarahi_3",
    supervisionField: "usedInNezart_3",
    engineerCountField: "cntEngin_3",
  },
];

/** One base, ready to draw: a table row and a donut both read from this. */
export interface QuotaModel {
  base: BaseId;
  title: string;
  totalCapacity: number;
  designUsed: number;
  supervisionUsed: number;
  usedCapacity: number;
  remainingCapacity: number;
  engineerCount: number;
}

/** A missing or non-numeric field counts as nothing consumed, not as NaN painted across the ring. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * The four models, generated from `BASE_CONFIG` rather than written out four times.
 *
 * Design and supervision are **combined** — they are one consumption figure, not two slices. The
 * remainder is clamped at zero: the procedure can report more consumed than the fixed capacity
 * allows, and a negative slice draws as a nonsense ring rather than as the overrun it represents.
 *
 * Nothing is rounded. The inputs are two-decimal square metres and the sums are exact for the data
 * seen so far, but where binary floating point does leave a tail the display absorbs it —
 * `Intl.NumberFormat` shows at most three fraction digits, so `149854.01999999998` prints as
 * «۱۴۹٬۸۵۴.۰۲». Rounding here would make the model claim a precision the arithmetic does not have.
 */
export function buildQuotaModels(row: QuotaRow): QuotaModel[] {
  return BASE_CONFIG.map((cfg) => {
    const designUsed = num(row[cfg.designField]);
    const supervisionUsed = num(row[cfg.supervisionField]);
    const usedCapacity = designUsed + supervisionUsed;
    const totalCapacity = BASE_CAPACITY[cfg.base];

    return {
      base: cfg.base,
      title: cfg.title,
      totalCapacity,
      designUsed,
      supervisionUsed,
      usedCapacity,
      remainingCapacity: Math.max(totalCapacity - usedCapacity, 0),
      engineerCount: num(row[cfg.engineerCountField]),
    };
  });
}
