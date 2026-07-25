// report-web/src/app/demo-clock.ts
//
// The bundled sample data (src/semantic/datasets/*.ts) is fixed in 2025.
// In production this prototype uses a mock AI service with in-memory data, so
// "today" is pinned to 2025-06-01 to keep dynamic-date filters deterministic.
// v2 (real backend + live data) will remove this shim and let the engine use
// the real clock (ENGINE_TODAY defaults to Date.now() already).
//
import { ENGINE_TODAY } from "@/query/engine";

/**
 * Pin the query engine's clock to 2025-06-01 so that dynamic-date tokens
 * (startOfYear, startOfMonth, today) resolve within the bundled 2025 sample
 * data rather than resolving to 2026 dates that exclude all rows.
 *
 * Call once at app startup, before the first query runs.
 */
export function initDemoClock(): void {
  ENGINE_TODAY.value = Date.UTC(2025, 5, 1); // 2025-06-01 UTC
}
