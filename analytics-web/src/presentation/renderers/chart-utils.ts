import type { ResultRow } from "../../contracts/dataset";

/**
 * Aggregate rows by a category key, summing each value key across rows that
 * share the same category value. Preserves first-seen order.
 * Null / non-numeric values are treated as 0 in the sum.
 */
export function aggregateByCategory(
  rows: ResultRow[],
  categoryKey: string,
  valueKeys: string[],
): ResultRow[] {
  const order: (string | number | null)[] = [];
  const map = new Map<string | number | null, ResultRow>();

  for (const row of rows) {
    const cat = row[categoryKey] ?? null;
    if (!map.has(cat)) {
      order.push(cat);
      // start with the category value; zero-initialise all value keys
      const acc: ResultRow = { [categoryKey]: cat };
      for (const vk of valueKeys) {
        acc[vk] = 0;
      }
      map.set(cat, acc);
    }
    const acc = map.get(cat)!;
    for (const vk of valueKeys) {
      const raw = row[vk];
      const num = typeof raw === "number" ? raw : 0;
      (acc[vk] as number) += num;
    }
  }

  return order.map((cat) => map.get(cat)!);
}
