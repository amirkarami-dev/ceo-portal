import type { Tenant } from "../contracts/tenant";
import type { AIProviderRow, UserRow, AuditRow, StoredReport } from "./mockApi";
import type { DashboardRecord } from "./queries";

const now = "2026-06-22T00:00:00.000Z";

export const SEED_TENANTS: Tenant[] = [
  {
    id: "tenant-acme",
    slug: "acme-co",
    displayName: "شرکت آلفا",
    status: "active",
    plan: "pro",
    branding: { primaryColor: "#10b981", accentColor: "#0ea5e9", productName: "گزارش‌ساز آلفا" },
    aiConfig: {
      defaultProviderId: "prov-openai",
      providers: [],
      fallbackChain: ["prov-ollama"],
      promptVersion: "v1",
      responseCacheTtlSeconds: 300,
      monthlyTokenBudget: 50000,
      monthlyCostBudget: 20,
    },
    quotas: {
      maxUsers: 100,
      maxReports: 1000,
      maxDashboards: 100,
      maxDataSources: 20,
      monthlyAiTokens: 50000,
      monthlyAiCost: 20,
      monthlyExports: 1000,
      storageMb: 10240,
    },
    dataSourceIds: ["ds-project"],
    defaultLocale: "fa-IR",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "tenant-beta",
    slug: "beta-co",
    displayName: "شرکت بتا",
    status: "trial",
    plan: "free",
    branding: { primaryColor: "#6366f1" },
    aiConfig: {
      defaultProviderId: "prov-azure",
      providers: [],
      fallbackChain: [],
      promptVersion: "v1",
      responseCacheTtlSeconds: 300,
      monthlyTokenBudget: 1000,
      monthlyCostBudget: 5,
    },
    quotas: {
      maxUsers: 5,
      maxReports: 50,
      maxDashboards: 10,
      maxDataSources: 2,
      monthlyAiTokens: 1000,
      monthlyAiCost: 5,
      monthlyExports: 50,
      storageMb: 512,
    },
    dataSourceIds: ["ds-sales"],
    defaultLocale: "fa-IR",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_USERS: UserRow[] = [
  {
    id: "u-1",
    tenantId: "tenant-acme",
    name: "آرش مدیری",
    email: "admin@acme.test",
    roles: ["TenantAdmin"],
    status: "active",
  },
  {
    id: "u-2",
    tenantId: "tenant-acme",
    name: "نگار طراح",
    email: "designer@acme.test",
    roles: ["ReportDesigner"],
    status: "active",
  },
  {
    id: "u-3",
    tenantId: "tenant-acme",
    name: "سارا کاربر",
    email: "viewer@acme.test",
    roles: ["Viewer"],
    status: "active",
  },
  {
    id: "u-4",
    tenantId: "tenant-beta",
    name: "بهرام مدیری",
    email: "admin@beta.test",
    roles: ["TenantAdmin"],
    status: "active",
  },
];

export const SEED_PROVIDERS: AIProviderRow[] = [
  { id: "prov-openai", tenantId: "tenant-acme", type: "OpenAI", model: "gpt-4o-mini", status: "active" },
  { id: "prov-ollama", tenantId: "tenant-acme", type: "Ollama", model: "llama3.1", status: "inactive" },
  { id: "prov-azure", tenantId: "tenant-beta", type: "Azure", model: "gpt-4o", status: "active" },
];

// Each report is a SavedReport envelope (+ internal tenantId for scoped listing).
export const SEED_REPORTS: StoredReport[] = [
  {
    id: "rep-delayed",
    tenantId: "tenant-acme",
    ownerName: "آرش مدیری",
    visibility: "tenant",
    updatedAt: now,
    definition: {
      id: "rep-delayed",
      schemaVersion: "1.0",
      name: "پروژه‌های با تاخیر بیش از ۳۰ روز",
      dataset: "projects",
      columns: [
        { field: "province", label: "استان" },
        { field: "status", label: "وضعیت" },
        { field: "delayDays", label: "تأخیر (روز)" },
      ],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "delayDays", aggregation: "avg", alias: "avg_delay", label: "میانگین تأخیر" }],
      presentation: { views: [] },
    },
  },
  {
    id: "rep-revenue",
    tenantId: "tenant-acme",
    ownerName: "آرش مدیری",
    visibility: "tenant",
    updatedAt: now,
    definition: {
      id: "rep-revenue",
      schemaVersion: "1.0",
      name: "درآمد ماهانه به تفکیک استان",
      dataset: "sales",
      columns: [
        { field: "province", label: "استان" },
        { field: "amount", label: "درآمد" },
      ],
      groupBy: [{ field: "province" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "sum_amount", label: "مجموع درآمد" }],
      presentation: { views: [] },
    },
  },
];

export const SEED_DASHBOARDS: DashboardRecord[] = [
  {
    id: "dash-exec",
    tenantId: "tenant-acme",
    name: "داشبورد مدیریتی",
    ownerName: "آرش مدیری",
    createdAt: now,
    updatedAt: now,
    widgets: [{ i: "w1", reportId: "rep-revenue", viewIndex: 0, title: "درآمد ماهانه" }],
    layout: [{ i: "w1", x: 0, y: 0, w: 6, h: 4 }],
  },
];

export const SEED_AUDIT: AuditRow[] = [
  { id: "ev-1", tenantId: "tenant-acme", actorId: "u-1", type: "ai.generate", ts: now, tokens: 420, cost: 0.002 },
  { id: "ev-2", tenantId: "tenant-acme", actorId: "u-2", type: "report.run", ts: now },
  { id: "ev-3", tenantId: "tenant-acme", actorId: "u-2", type: "export.csv", ts: now },
];

// ─── Test helpers ────────────────────────────────────────────────────────────

/**
 * Resets the mock localStorage DB back to the seeded data.
 * Call in beforeEach to give each test a clean slate.
 */
export function resetMockDb(): void {
  localStorage.clear();
  localStorage.setItem("report.db.reports", JSON.stringify(SEED_REPORTS));
  localStorage.setItem("report.db.dashboards", JSON.stringify(SEED_DASHBOARDS));
  localStorage.setItem("report.db.providers", JSON.stringify(SEED_PROVIDERS));
  localStorage.setItem("report.db.users", JSON.stringify(SEED_USERS));
  localStorage.setItem("report.db.tenants", JSON.stringify(SEED_TENANTS));
  localStorage.setItem("report.db.audit", JSON.stringify(SEED_AUDIT));
}

/**
 * Seeds reports into the mock DB (same as resetMockDb for reports slice).
 * Provided separately so tests can call resetMockDb() + seedReports() idiomatically.
 */
export function seedReports(): void {
  localStorage.setItem("report.db.reports", JSON.stringify(SEED_REPORTS));
}

/** Returns the id of the first seeded report (stable across test runs). */
export function firstSeededReportId(): string {
  return SEED_REPORTS[0].id;
}

/**
 * Seeds dashboards into the mock DB.
 * Provided separately so tests can call resetMockDb() + seedDashboards() idiomatically.
 */
export function seedDashboards(): void {
  localStorage.setItem("report.db.dashboards", JSON.stringify(SEED_DASHBOARDS));
}

/** Returns the id of the first seeded dashboard (stable across test runs). */
export function firstSeededDashboardId(): string {
  return SEED_DASHBOARDS[0].id;
}
