// analytics-web/src/api/dashboardsHttpApi.ts
// HTTP implementations of the Dashboard CRUD calls that back the
// useDashboards / useDashboard / useCreateDashboard / useSaveDashboard /
// useDeleteDashboard hooks when VITE_USE_MOCK_API === "false".
//
// Backend endpoints (all live under /api/Dashboards):
//   GET    /api/Dashboards                           → BackendDashboard[]
//   GET    /api/Dashboards/{id}                      → BackendDashboard
//   POST   /api/Dashboards  { name, widgets, layout } → { id: string }
//   DELETE /api/Dashboards/{id}                      → 204

import { httpClient } from "./httpClient";
import type { DashboardRecord, DashboardWidget, GridLayoutItem } from "./queries";

/** Shape the backend returns for each Dashboard item */
interface BackendDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layout: GridLayoutItem[];
  ownerName: string;
  updatedAt: string;
}

/** Shape the backend returns from POST /api/Dashboards */
interface BackendCreateResponse {
  id: string;
}

function backendToFrontend(b: BackendDashboard): DashboardRecord {
  return {
    id: b.id,
    tenantId: "",
    name: b.name,
    widgets: b.widgets ?? [],
    layout: b.layout ?? [],
    ownerName: b.ownerName ?? "",
    createdAt: b.updatedAt ?? new Date().toISOString(),
    updatedAt: b.updatedAt ?? new Date().toISOString(),
  };
}

export const dashboardsHttpApi = {
  /** GET /api/Dashboards — returns the full list. */
  async list(): Promise<DashboardRecord[]> {
    const items = await httpClient.get<BackendDashboard[]>("/api/Dashboards");
    return items.map(backendToFrontend);
  },

  /** GET /api/Dashboards/{id} — returns a single record, or null when 404. */
  async get(id: string): Promise<DashboardRecord | null> {
    try {
      const item = await httpClient.get<BackendDashboard>(`/api/Dashboards/${id}`);
      return backendToFrontend(item);
    } catch {
      return null;
    }
  },

  /**
   * POST /api/Dashboards — creates a new dashboard.
   * Returns a DashboardRecord with the server-assigned id.
   */
  async create(opts: { name: string }): Promise<DashboardRecord> {
    const resp = await httpClient.post<BackendCreateResponse>("/api/Dashboards", {
      name: opts.name,
      widgets: [],
      layout: [],
    });
    return {
      id: resp.id,
      tenantId: "",
      name: opts.name,
      widgets: [],
      layout: [],
      ownerName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * POST /api/Dashboards — saves (upserts) a dashboard with widgets/layout.
   * The backend treats this as an upsert keyed on the dashboard id when present.
   */
  async save(d: DashboardRecord): Promise<DashboardRecord> {
    const numericId = Number(d.id);
    const resp = await httpClient.post<BackendCreateResponse>("/api/Dashboards", {
      // With an id the backend updates in place; without it, it creates.
      id: Number.isInteger(numericId) && numericId > 0 ? numericId : undefined,
      name: d.name,
      widgets: d.widgets,
      layout: d.layout,
    });
    return {
      ...d,
      id: resp.id || d.id,
      updatedAt: new Date().toISOString(),
    };
  },

  /** DELETE /api/Dashboards/{id} */
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/api/Dashboards/${id}`);
  },
};
