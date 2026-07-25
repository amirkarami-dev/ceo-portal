// analytics-web/src/api/auditHttpApi.ts
// HTTP implementations of the Audit log calls that back the
// useAudit / useAuditEvents hooks when VITE_USE_MOCK_API === "false".
//
// Backend endpoints (all live under /api/Audit):
//   GET /api/Audit?type=&status=  → BackendAuditEvent[]

import { httpClient } from "./httpClient";
import type { AuditRow } from "./mockApi";

/** Shape the backend returns for each Audit event */
interface BackendAuditEvent {
  id: string;
  type: string;
  actorName: string;
  detail: string;
  occurredAtUtc: string;
  status?: string;
}

function backendToFrontend(b: BackendAuditEvent): AuditRow {
  return {
    id: b.id,
    tenantId: "",
    actorId: b.actorName,
    type: b.type,
    ts: b.occurredAtUtc,
    // cost/tokens not provided by this backend endpoint
  };
}

export const auditHttpApi = {
  /**
   * GET /api/Audit?type=&status= — returns the filtered audit event list.
   * Optional filters are passed as query params; absent params are omitted.
   */
  async list(opts: { type?: string; status?: string } = {}): Promise<AuditRow[]> {
    const params = new URLSearchParams();
    if (opts.type) params.set("type", opts.type);
    if (opts.status) params.set("status", opts.status);

    const qs = params.toString();
    const path = qs ? `/api/Audit?${qs}` : "/api/Audit";
    const items = await httpClient.get<BackendAuditEvent[]>(path);
    return items.map(backendToFrontend);
  },
};
