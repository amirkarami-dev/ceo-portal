import { httpClient } from "../../../api/httpClient";
import type { QuotaParams, QuotaRow } from "./contract";

/**
 * The same mock/real gate `executeApi.ts` uses, for the same reason: one call site behaves correctly
 * in both modes, so nothing downstream has to know which one it is running in.
 */
const USE_REAL_API = (import.meta.env.VITE_USE_MOCK_API as string | undefined) === "false";

/**
 * The row the user supplied, for local work. Real numbers from a real run of the procedure, not
 * invented ones — so what the screen shows can be checked against the reference by hand.
 *
 * The same row is returned for every city and discipline. That is a deliberate limit of the mock and
 * not a bug to fix later: the shape is what local work needs, and pretending to model nine cities
 * would only invent data nobody verified.
 */
export const MOCK_QUOTA_ROW: QuotaRow = {
  usedInTarahi_4: 2357.45,
  usedInNezart_4: 0,
  cntEngin_4: 2,
  usedInTarahi_1: 9034.42,
  usedInNezart_1: 1111.56,
  cntEngin_1: 16,
  usedInTarahi_2: 6362.96,
  usedInNezart_2: 2617.29,
  cntEngin_2: 21,
  usedInTarahi_3: 2348.91,
  usedInNezart_3: 9405.64,
  cntEngin_3: 55,
};

/**
 * The endpoint the backend must implement. Pinned in
 * `docs/design/2026-08-15-custom-reports-engineer-quota.md`:
 *
 * ```
 * POST /api/Reports/custom/engineer-quota   { cityId, reshte } -> QuotaRow
 * ```
 *
 * **No capacities in the response.** They are a client constant by requirement, and returning them
 * would create a second source of truth for a number that must not vary.
 */
export const QUOTA_ENDPOINT = "/api/Reports/custom/engineer-quota";

export async function fetchQuota(params: QuotaParams): Promise<QuotaRow> {
  if (USE_REAL_API) {
    return httpClient.post<QuotaRow>(QUOTA_ENDPOINT, params);
  }
  return MOCK_QUOTA_ROW;
}
