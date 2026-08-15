/**
 * What `[dbo].[F_ShowQuataInCity]` takes and returns, and the two lists that drive the pickers.
 *
 * Kept apart from the fetch and the components so the numbers and the wire shape can be read — and
 * tested — without pulling React or a query client in behind them.
 */

/** A type alias, not an interface: interfaces get no implicit index signature, so an interface here
 *  would not satisfy the registry's `Params` constraint. */
export type QuotaParams = {
  cityId: number;
  reshte: number;
};

/**
 * One wide row. The dimension is in the **column names**, which is precisely why this report cannot
 * be a `ReportDefinition`: there is nothing here for the engine to group by.
 *
 * camelCase because that is how `executeApi` already receives backend payloads; the proc's own
 * columns are `UsedInTarahi_4` and so on.
 */
export interface QuotaRow {
  usedInTarahi_4: number;
  usedInNezart_4: number;
  cntEngin_4: number;
  usedInTarahi_1: number;
  usedInNezart_1: number;
  cntEngin_1: number;
  usedInTarahi_2: number;
  usedInNezart_2: number;
  cntEngin_2: number;
  usedInTarahi_3: number;
  usedInNezart_3: number;
  cntEngin_3: number;
}

/**
 * The nine cities and seven disciplines, hardcoded as agreed — no extra endpoint, matching the
 * decision that the capacities are constants too.
 *
 * The gaps in the city ids (nothing between 2 and 18, no 24) are the database's. Carried verbatim
 * rather than tidied into a sequence, because the id is what the procedure is called with.
 */
export const CITIES: { value: number; label: string }[] = [
  { value: 1, label: "بانه" },
  { value: 2, label: "سنندج (مرکزی)" },
  { value: 18, label: "کامیاران" },
  { value: 19, label: "قروه" },
  { value: 20, label: "سقز" },
  { value: 21, label: "دهگلان" },
  { value: 22, label: "مریوان" },
  { value: 23, label: "دیواندره" },
  { value: 25, label: "بیجار" },
];

export const DISCIPLINES: { value: number; label: string }[] = [
  { value: 1, label: "معماری" },
  { value: 2, label: "شهرسازی" },
  { value: 3, label: "عمران" },
  { value: 4, label: "مکانیک" },
  { value: 5, label: "برق" },
  { value: 6, label: "نقشه‌برداری" },
  { value: 7, label: "ترافیک" },
];
