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
    branding: { primaryColor: "#326BFC", accentColor: "#06B5F8", productName: "گزارش‌ساز آلفا" },
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
      /**
       * The other branch: no `targetDefinition`, so `buildDrilldownDefinition` falls back to the
       * dimension after the drilled one — none here, so the child is the province's detail rows.
       * Two seeded reports, two code paths, so neither rots unnoticed.
       *
       * A second `groupBy` would make the fallback richer and was tried; it also turns this report
       * into a 2-dimension matrix, which auto-viz routes to a heatmap — and a heatmap does not
       * drill, so the demo would have removed the very thing it was demonstrating. The seed's job is
       * to show the report someone actually saved, not to be bent around a code path.
       */
      drilldown: { enabled: true, operator: "eq" },
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
      /**
       * Drill: a province opens its own months.
       *
       * The seed carried no `drilldown` at all, so **nothing drilled in local mock data** — not by
       * mouse and not from the keyboard. Both consumers build the child with
       * `buildDrilldownDefinition`, which throws without this and is caught as a silent skip, so the
       * whole feature looked wired up and did nothing.
       *
       * `targetDefinition` rather than the inline fallback: with one `groupBy`, the fallback's
       * "next dimension after the drilled one" is undefined, so the child has no grouping and
       * collapses to a single KPI. Naming the child explicitly gives the useful answer — the
       * clicked province broken down by month — and exercises the branch a real report would use.
       */
      drilldown: {
        enabled: true,
        operator: "eq",
        targetDefinition: {
          id: "rep-revenue-months",
          schemaVersion: "1.0",
          name: "درآمد ماهانه",
          dataset: "sales",
          columns: [
            { field: "orderDate", label: "ماه" },
            { field: "amount", label: "درآمد" },
          ],
          groupBy: [{ field: "orderDate", dateBucket: "month" }],
          metrics: [
            { field: "amount", aggregation: "sum", alias: "sum_amount", label: "مجموع درآمد" },
          ],
          presentation: { views: [] },
        },
      },
      presentation: { views: [] },
    },
  },
  {
    id: "rep-quota",
    tenantId: "tenant-acme",
    ownerName: "آرش مدیری",
    visibility: "tenant",
    updatedAt: now,
    /**
     * A custom report: its data comes from `presentation/custom/engineer-quota`, not from the query
     * engine. `dataset`, `columns` and `groupBy` are the envelope the report shell expects and carry
     * nothing — the wart named in the design doc, paid once so the page, toolbar, breadcrumb, roles
     * and dashboards all keep working unchanged.
     */
    definition: {
      id: "rep-quota",
      schemaVersion: "1.0",
      name: "وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته",
      dataset: "oz_info",
      columns: [],
      presentation: {
        views: [
          {
            type: "chart",
            library: "custom",
            component: "EngineerQuota",
            // Parameters live in `options`, not `mapping`: ViewMapping is a fixed set of named chart
            // bindings with no index signature, and widening it would weaken every chart's typing.
            options: { cityId: 25, reshte: 4 },
            mapping: {},
          },
        ],
      },
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
    // A custom report pinned beside an ordinary one, so the dashboard exercises both paths. The
    // quota widget is taller: it carries a four-row table and four rings, not a single chart.
    widgets: [
      { i: "w1", reportId: "rep-revenue", viewIndex: 0, title: "درآمد ماهانه" },
      { i: "w2", reportId: "rep-quota", viewIndex: 0, title: "سهمیه مهندسان" },
    ],
    layout: [
      { i: "w1", x: 0, y: 0, w: 6, h: 4 },
      // h:16 -> 16*40 + 15*10 = 790px. The report is a note, a six-column table AND four rings; at
      // h:10 the rings sat below the card's scroll line, so the widget demonstrated half of itself.
      { i: "w2", x: 0, y: 4, w: 12, h: 16 },
    ],
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
