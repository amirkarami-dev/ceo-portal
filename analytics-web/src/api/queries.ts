import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mockApi, type AIProviderRow, type UserRow, type AuditRow } from "./mockApi";
import { reportsHttpApi } from "./reportsHttpApi";
import { dashboardsHttpApi } from "./dashboardsHttpApi";
import { aiProvidersHttpApi } from "./aiProvidersHttpApi";
import { auditHttpApi } from "./auditHttpApi";
import { semanticModelsHttpApi } from "./semanticModelsHttpApi";
import type { ReportDefinition } from "../contracts/report-definition";
import type { Tenant, TenantUsage, TenantStatus } from "../contracts/tenant";
import type { TenantAIConfig } from "../contracts/ai";
import type { SemanticModel } from "../contracts/semantic";
import type { DashboardWidget, GridLayoutItem } from "../dashboard/widget";
import { useTenantStore } from "../store/tenant-store";
import { semanticModels } from "../semantic/registry";
import type { SystemSettings } from "../admin/system/types";

// When VITE_USE_MOCK_API is explicitly "false" the report hooks use the real
// HTTP backend; all other values (including the default "true" and undefined)
// keep the localStorage mock path so offline dev and tests are unaffected.
const USE_REAL_API = (import.meta.env.VITE_USE_MOCK_API as string | undefined) === "false";

// ----- Canonical persisted shapes (the single definitions; other tasks import from here) -----

/** A saved report = a ReportDefinition envelope with library metadata. */
export type SavedReport = {
  id: string;
  definition: ReportDefinition;
  updatedAt: string;
  lastRunAt?: string;
  ownerName: string;
  visibility: "private" | "tenant";
};

/** A dashboard = embedded widgets + grid layout (no separate WidgetDef). */
export type DashboardRecord = {
  id: string;
  tenantId: string;
  name: string;
  widgets: DashboardWidget[];
  layout: GridLayoutItem[];
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};

// Re-export the widget/layout types so consumers can import them from @/api/queries too.
export type { DashboardWidget, GridLayoutItem };
// Re-export admin row types for convenience.
export type { AIProviderRow, UserRow, AuditRow };

// ----- Query key factory (tenant-scoped) -----
export const rk = {
  reports: (t: string | null) => ["reports", t] as const,
  report: (id: string) => ["report", id] as const,
  dashboards: (t: string | null) => ["dashboards", t] as const,
  dashboard: (id: string) => ["dashboard", id] as const,
  providers: (t: string | null) => ["providers", t] as const,
  users: (t: string | null) => ["users", t] as const,
  tenants: () => ["tenants"] as const,
  audit: (t: string | null) => ["audit", t] as const,
  tenantAIConfig: (t: string | null) => ["tenantAIConfig", t] as const,
  aiUsageSeries: (t: string | null) => ["aiUsageSeries", t] as const,
};

const useTid = () => useTenantStore((s) => s.currentTenantId);

// ----- Report hooks -----

export const useReports = () => {
  const t = useTid();
  return useQuery({
    queryKey: rk.reports(t),
    queryFn: USE_REAL_API
      ? () => reportsHttpApi.list()
      : () => mockApi.reports.list(t ?? undefined),
  });
};

export const useReport = (id: string) =>
  useQuery<SavedReport | null>({
    queryKey: rk.report(id),
    queryFn: USE_REAL_API
      ? () => reportsHttpApi.get(id)
      : () => mockApi.reports.get(id),
    enabled: !!id,
  });

export const useSaveReport = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<
    SavedReport,
    Error,
    { definition: ReportDefinition; name?: string; visibility?: "private" | "tenant" }
  >({
    mutationFn: USE_REAL_API
      ? ({ definition, name, visibility }) =>
          reportsHttpApi.save({ definition, name, visibility })
      : ({ definition, name, visibility }) =>
          mockApi.reports.save({
            id: definition.id ?? "",
            tenantId: t ?? "",
            definition: name ? { ...definition, name } : definition,
            ownerName: "",
            visibility: visibility ?? "private",
            updatedAt: "",
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.reports(t) }),
  });
};

export const useDeleteReport = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation({
    mutationFn: (id: string) => mockApi.reports.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.reports(t) }),
  });
};

// ----- Dashboard hooks -----
// Gated: HTTP backend when VITE_USE_MOCK_API="false", mock otherwise.

export const useDashboards = () => {
  const t = useTid();
  return useQuery({
    queryKey: rk.dashboards(t),
    queryFn: USE_REAL_API
      ? () => dashboardsHttpApi.list()
      : () => mockApi.dashboards.list(t ?? undefined),
  });
};

export const useDashboard = (id: string) =>
  useQuery<DashboardRecord | null>({
    queryKey: rk.dashboard(id),
    queryFn: USE_REAL_API
      ? () => dashboardsHttpApi.get(id)
      : () => mockApi.dashboards.get(id),
    enabled: !!id,
  });

export const useCreateDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<DashboardRecord, Error, { name: string }>({
    mutationFn: USE_REAL_API
      ? ({ name }) => dashboardsHttpApi.create({ name })
      : ({ name }) =>
          mockApi.dashboards.save({
            id: "",
            tenantId: t ?? "",
            name,
            ownerName: "",
            widgets: [],
            layout: [],
            createdAt: "",
            updatedAt: "",
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};

export const useSaveDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<DashboardRecord, Error, DashboardRecord>({
    mutationFn: USE_REAL_API
      ? (d: DashboardRecord) => dashboardsHttpApi.save(d)
      : (d: DashboardRecord) => mockApi.dashboards.save(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};

export const useDeleteDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation({
    mutationFn: USE_REAL_API
      ? (id: string) => dashboardsHttpApi.remove(id)
      : (id: string) => mockApi.dashboards.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};

// ----- Admin/meta hooks -----
// Providers and Audit are gated: HTTP when VITE_USE_MOCK_API="false", mock otherwise.
// Users has no analytics backend endpoint — stays on mock (TODO: wire when endpoint exists).

export const useProviders = () => {
  const t = useTid();
  return useQuery<AIProviderRow[]>({
    queryKey: rk.providers(t),
    queryFn: USE_REAL_API
      ? () => aiProvidersHttpApi.list()
      : () => mockApi.providers.list(t ?? undefined),
  });
};

export const useUsers = () => {
  const t = useTid();
  return useQuery<UserRow[]>({
    queryKey: rk.users(t),
    queryFn: () => mockApi.users.list(t ?? undefined),
  });
};

export const useUpsertUser = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<UserRow, Error, UserRow>({
    mutationFn: (u: UserRow) => mockApi.users.save(u),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.users(t) }),
  });
};

export const useSetUserActive = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<UserRow, Error, { id: string; active: boolean }>({
    mutationFn: async ({ id, active }) => {
      const all = await mockApi.users.list(t ?? undefined);
      const existing = all.find((u) => u.id === id);
      if (!existing) throw new Error("User not found");
      return mockApi.users.save({
        ...existing,
        status: active ? "active" : "suspended",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.users(t) }),
  });
};

export const useTenants = () =>
  useQuery<Tenant[]>({
    queryKey: rk.tenants(),
    queryFn: () => mockApi.tenants.list(),
  });

// ─── Tenant CRUD hooks (Task 22) ─────────────────────────────────────────────

/** Active tenant — scoped to currentTenantId (falls back to first seed tenant). */
export const useTenant = () => {
  const t = useTid();
  return useQuery<Tenant | null>({
    queryKey: ["tenant", t],
    queryFn: async () => {
      const list = await mockApi.tenants.list();
      return list.find((tn) => tn.id === t) ?? list[0] ?? null;
    },
  });
};

export const useUpdateTenant = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<Tenant, Error, Tenant>({
    mutationFn: (tn: Tenant) => mockApi.tenants.save(tn),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rk.tenants() });
      void qc.invalidateQueries({ queryKey: ["tenant", t] });
    },
  });
};

/** Per-tenant usage data (mock — static for now). */
const MOCK_TENANT_USAGE: TenantUsage = {
  tenantId: "tenant-acme",
  period: "2026-06",
  users: 12,
  reports: 90,
  dashboards: 8,
  dataSources: 3,
  aiTokens: 4_200_000,
  aiCost: 168,
  exports: 120,
  storageMb: 512,
};

export const useTenantUsage = () =>
  useQuery<TenantUsage>({
    queryKey: ["tenantUsage"],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 80));
      return MOCK_TENANT_USAGE;
    },
    initialData: MOCK_TENANT_USAGE,
  });

export const useUpsertTenant = () => {
  const qc = useQueryClient();
  return useMutation<Tenant, Error, Tenant>({
    mutationFn: (tn: Tenant) => mockApi.tenants.save(tn),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rk.tenants() }),
  });
};

export const useSetTenantStatus = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; status: TenantStatus }>({
    mutationFn: async ({ id, status }) => {
      const list = await mockApi.tenants.list();
      const tn = list.find((t) => t.id === id);
      if (!tn) throw new Error("Tenant not found");
      await mockApi.tenants.save({ ...tn, status, updatedAt: new Date().toISOString() });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: rk.tenants() }),
  });
};

// ─── System Settings hooks (Task 22) ─────────────────────────────────────────

const SYSTEM_SETTINGS_KEY = "report.db.systemSettings";

function readSystemSettings(): SystemSettings | null {
  const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as SystemSettings; } catch { return null; }
}

function writeSystemSettings(s: SystemSettings): void {
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(s));
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  defaultLocale: "fa-IR",
  defaultTheme: "light",
  dateSystem: "jalali",
  flags: { advancedECharts: true, dashboardSharing: false, exportFormats: true },
  ai: { defaultProvider: "openai", defaultModel: "gpt-4o-mini", globalTokenBudget: 10_000_000, defaultCacheTtl: 86400, promptVersionPin: "report-gen@3" },
  security: { sessionPolicy: "8h", allowedExportFormats: ["pdf", "csv"], piiRedaction: true },
  integrations: { oidcIssuer: "https://auth.myceo.ir" },
};

export const useSystemSettings = () =>
  useQuery<SystemSettings>({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 80));
      return readSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
    },
    initialData: readSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS,
  });

export const useUpdateSystemSettings = () => {
  const qc = useQueryClient();
  return useMutation<SystemSettings, Error, SystemSettings>({
    mutationFn: async (s) => {
      await new Promise<void>((r) => setTimeout(r, 100));
      writeSystemSettings(s);
      return s;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["systemSettings"] }),
  });
};

export const useAudit = () => {
  const t = useTid();
  return useQuery<AuditRow[]>({
    queryKey: rk.audit(t),
    queryFn: USE_REAL_API
      ? () => auditHttpApi.list()
      : () => mockApi.audit.list(t ?? undefined),
  });
};

/** Filter shape for the audit log screen (all fields optional). */
export interface AuditFilter {
  from?: string;
  to?: string;
  actorId?: string;
  type?: string;
  status?: string;
}

/**
 * Filtered audit-event list.
 * HTTP path: delegates type/status to the backend query params; from/to/actorId
 * remain client-side post-filters since the backend only supports type+status.
 * Mock path: full client-side filtering over the tenant-scoped list.
 */
export const useAuditEvents = (filter: AuditFilter = {}) => {
  const t = useTid();
  return useQuery<AuditRow[]>({
    queryKey: [...rk.audit(t), filter] as const,
    queryFn: USE_REAL_API
      ? async () => {
          const rows = await auditHttpApi.list({
            type: filter.type,
            status: filter.status,
          });
          // Apply remaining client-side filters (from/to/actorId)
          return rows.filter((r) => {
            if (filter.from && r.ts < filter.from) return false;
            if (filter.to && r.ts > filter.to) return false;
            if (filter.actorId && r.actorId !== filter.actorId) return false;
            return true;
          });
        }
      : async () => {
          const rows = await mockApi.audit.list(t ?? undefined);
          return rows.filter((r) => {
            if (filter.type && r.type !== filter.type) return false;
            if (filter.from && r.ts < filter.from) return false;
            if (filter.to && r.ts > filter.to) return false;
            if (filter.actorId && r.actorId !== filter.actorId) return false;
            const ext = r as AuditRow & { status?: string };
            if (filter.status && ext.status !== filter.status) return false;
            return true;
          });
        },
  });
};

/** Cost-by-tenant summary derived from the mock audit seed. */
export interface TenantCostSeries {
  tenantId: string;
  series: { period: string; costUsd: number }[];
}

export const useAuditCostByTenant = () => {
  return useQuery<TenantCostSeries[]>({
    queryKey: ["auditCostByTenant"] as const,
    queryFn: async () => {
      const all = await mockApi.audit.list(undefined);
      const byTenant: Record<string, Record<string, number>> = {};
      for (const row of all) {
        if (!row.cost) continue;
        const period = row.ts.slice(0, 7); // "YYYY-MM"
        byTenant[row.tenantId] ??= {};
        byTenant[row.tenantId][period] = (byTenant[row.tenantId][period] ?? 0) + row.cost;
      }
      return Object.entries(byTenant).map(([tenantId, periods]) => ({
        tenantId,
        series: Object.entries(periods)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, costUsd]) => ({ period, costUsd })),
      }));
    },
  });
};

// ─── TenantAIConfig hooks (Task 18) ──────────────────────────────────────────

const AI_CONFIG_STORAGE_KEY = "report.db.tenantAIConfig";

function readAIConfig(tenantId: string): TenantAIConfig | null {
  const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!raw) return null;
  try {
    const all = JSON.parse(raw) as Record<string, TenantAIConfig>;
    return all[tenantId] ?? null;
  } catch {
    return null;
  }
}

function writeAIConfig(cfg: TenantAIConfig): void {
  const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  let all: Record<string, TenantAIConfig> = {};
  if (raw) {
    try { all = JSON.parse(raw) as Record<string, TenantAIConfig>; } catch { /* ignore */ }
  }
  all[cfg.tenantId] = cfg;
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(all));
}

const DEFAULT_AI_CONFIG = (tenantId: string): TenantAIConfig => ({
  tenantId,
  defaultModelId: "openai-gpt4o-mini",
  fallbackChain: ["openai-gpt4o-mini"],
  promptVersion: "report-gen@3",
  cache: { enabled: true, ttlSeconds: 86400 },
  quota: { monthlyTokenLimit: 5_000_000, monthlyCostUsdLimit: 200 },
  providers: [
    {
      id: "openai-gpt4o-mini",
      type: "openai",
      model: "gpt-4o-mini",
      keyRef: "secret://tenant/openai",
      params: { temperature: 0.1, maxTokens: 2048 },
      enabled: true,
    },
    {
      id: "ollama-local",
      type: "ollama",
      model: "qwen2.5:14b",
      keyRef: null,
      params: { temperature: 0.1, maxTokens: 2048 },
      enabled: true,
    },
  ],
});

export const useTenantAIConfig = () => {
  const t = useTid();
  return useQuery<TenantAIConfig>({
    queryKey: rk.tenantAIConfig(t),
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 100));
      return readAIConfig(t ?? "default") ?? DEFAULT_AI_CONFIG(t ?? "default");
    },
  });
};

export const useUpdateTenantAIConfig = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<TenantAIConfig, Error, TenantAIConfig>({
    mutationFn: async (cfg) => {
      await new Promise<void>((r) => setTimeout(r, 100));
      writeAIConfig(cfg);
      return cfg;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.tenantAIConfig(t) }),
  });
};

export const useTestProvider = () => {
  return useMutation<{ ok: boolean; latencyMs: number; error?: string }, Error, string>({
    mutationFn: async (_id: string) => {
      await new Promise<void>((r) => setTimeout(r, 400));
      return { ok: true, latencyMs: 87 };
    },
  });
};

// ─── AI usage series (mock data for usage/cost chart) ─────────────────────

export interface AIUsageSeriesData {
  perDay: { date: string; tokens: number }[];
  perModel: { model: string; costUsd: number }[];
}

const MOCK_USAGE_SERIES: AIUsageSeriesData = {
  perDay: [
    { date: "2026-06-01", tokens: 12400 },
    { date: "2026-06-02", tokens: 9800 },
    { date: "2026-06-03", tokens: 15200 },
    { date: "2026-06-04", tokens: 8100 },
    { date: "2026-06-05", tokens: 18700 },
    { date: "2026-06-06", tokens: 11300 },
    { date: "2026-06-07", tokens: 14500 },
    { date: "2026-06-08", tokens: 16200 },
    { date: "2026-06-09", tokens: 9600 },
    { date: "2026-06-10", tokens: 22300 },
  ],
  perModel: [
    { model: "gpt-4o-mini", costUsd: 4.52 },
    { model: "qwen2.5:14b", costUsd: 0.0 },
    { model: "deepseek-chat", costUsd: 1.23 },
    { model: "claude-3-haiku", costUsd: 2.87 },
  ],
};

export const useAIUsageSeries = () => {
  const t = useTid();
  return useQuery<AIUsageSeriesData>({
    queryKey: rk.aiUsageSeries(t),
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 150));
      return MOCK_USAGE_SERIES;
    },
    initialData: MOCK_USAGE_SERIES,
  });
};

// ─── Data Sources & Semantic Models hooks (Task 20) ───────────────────────────

/** Mock data-source record — mirrors the admin UI shape (not a full Tenant contract type). */
export interface DataSourceRecord {
  id: string;
  tenantId: string;
  name: string;
  kind: "sql" | "rest" | "file" | "warehouse";
  connectionRef: string;
  semanticModelId: string;
  status: "connected" | "error" | "unconfigured";
  rowCount?: number;
}

const MOCK_DATA_SOURCES: DataSourceRecord[] = [
  { id: "ds-project", tenantId: "global", name: "Projects Dataset", kind: "file",
    connectionRef: "fixture://projects", semanticModelId: "model-project",
    status: "connected", rowCount: 30 },
  { id: "ds-sales", tenantId: "global", name: "Sales Dataset", kind: "file",
    connectionRef: "fixture://sales", semanticModelId: "model-sales",
    status: "connected", rowCount: 30 },
  { id: "ds-finance", tenantId: "global", name: "Finance Dataset", kind: "file",
    connectionRef: "fixture://finance", semanticModelId: "model-finance",
    status: "connected", rowCount: 30 },
];

export const useDataSources = () => {
  const t = useTid();
  return useQuery<DataSourceRecord[]>({
    queryKey: ["dataSources", t],
    queryFn: async () => {
      await new Promise<void>((r) => setTimeout(r, 80));
      return MOCK_DATA_SOURCES;
    },
    initialData: MOCK_DATA_SOURCES,
  });
};

export const useSemanticModels = () => {
  return useQuery<SemanticModel[]>({
    queryKey: ["semanticModels"],
    queryFn: USE_REAL_API
      ? () => semanticModelsHttpApi.list()
      : async () => {
          await new Promise<void>((r) => setTimeout(r, 80));
          return Object.values(semanticModels);
        },
    // Only seed initialData in mock mode; in real mode we always fetch from backend.
    initialData: USE_REAL_API ? undefined : Object.values(semanticModels),
  });
};

export const useTestDataSource = () => {
  return useMutation<{ ok: boolean; error?: string }, Error, string>({
    mutationFn: async (_id: string) => {
      await new Promise<void>((r) => setTimeout(r, 400));
      return { ok: true };
    },
  });
};
