import { CITIES, DISCIPLINES, type QuotaParams, type QuotaRow } from "./contract";

/**
 * The report body. **Step 1 placeholder.**
 *
 * It exists so the whole path — dispatch → registry → params → fetch → render — can be walked in a
 * browser before any quota arithmetic is written. The table and the four donuts replace what is in
 * this file at step 6; the id, the seeded definition and the URL do not change, so nothing downstream
 * has to be revisited when they do.
 *
 * Its own file rather than an inline component in `index.tsx`, so that module stays pure
 * registration — and so step 6 rewrites one file instead of surgically editing two.
 */
export function EngineerQuotaReport({ data, params }: { data: QuotaRow; params: QuotaParams }) {
  const city = CITIES.find((c) => c.value === params.cityId)?.label ?? params.cityId;
  const reshte = DISCIPLINES.find((d) => d.value === params.reshte)?.label ?? params.reshte;

  return (
    <div data-testid="engineer-quota" style={{ padding: 16 }}>
      <p data-testid="engineer-quota-params">
        {city} — {reshte}
      </p>
      <pre style={{ fontSize: 12, overflowX: "auto" }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
