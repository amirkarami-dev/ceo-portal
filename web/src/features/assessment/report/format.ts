// Persian-digit number formatting for the report document. The report is a Persian
// regulatory artifact, so numbers use fa-IR digits regardless of the UI locale.

export function faNum(
  n: number | null | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  if (n == null || !Number.isFinite(n)) return "-"
  return new Intl.NumberFormat("fa-IR", opts).format(n)
}

/** R-like values: up to 3 decimals, trailing zeros dropped. */
export const faR = (n: number | null | undefined) =>
  faNum(n, { maximumFractionDigits: 3 })

/** Required-R headline values: 2 decimals. */
export const faR2 = (n: number | null | undefined) =>
  faNum(n, { maximumFractionDigits: 2 })

/** Whole numbers (thickness, density, counts). */
export const faInt = (n: number | null | undefined) =>
  faNum(n, { maximumFractionDigits: 0 })
