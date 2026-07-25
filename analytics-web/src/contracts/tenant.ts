// §11 — multi-tenant model. v1: seeded into localStorage by the mock API + Zustand.

export type TenantStatus = "active" | "suspended" | "trial";
export type TenantPlan = "free" | "pro" | "enterprise";

export interface Tenant {
  id: string; // ULID/GUID; the isolation key
  slug: string; // url/display key, e.g. "acme-co"
  displayName: string; // Persian display name, e.g. "شرکت آلفا"
  status: TenantStatus;
  plan: TenantPlan;
  branding: TenantBranding;
  aiConfig: TenantAiConfig; // §11.5
  quotas: TenantQuotas; // §11.6
  dataSourceIds: string[]; // FKs into per-tenant data sources (§11.4)
  defaultLocale: "fa-IR" | "en-US";
  createdAt: string; // ISO
  updatedAt: string;
}

export interface TenantBranding {
  logoUrl?: string;
  primaryColor: string; // hex; feeds the AntD ConfigProvider theme token
  accentColor?: string;
  productName?: string; // white-label override of "AI Reporting"
  faviconUrl?: string;
  loginBackgroundUrl?: string;
}

// Every tenant-scoped entity carries a tenantId FK (§11.2).
export interface TenantScoped {
  tenantId: string;
}

// §11.5 — per-tenant AI configuration.
export interface TenantAiConfig {
  defaultProviderId: string;
  providers: AiProviderConfig[]; // OpenAI, Azure, Ollama, DeepSeek, GLM, Claude, Gemini, OpenRouter, Custom
  fallbackChain: string[]; // provider ids, tried in order
  promptVersion: string; // pinned prompt template version
  responseCacheTtlSeconds: number;
  monthlyTokenBudget: number; // feeds quota (§11.6)
  monthlyCostBudget: number; // currency units
}

export interface AiProviderConfig extends TenantScoped {
  id: string;
  provider:
    | "openai"
    | "azure"
    | "ollama"
    | "deepseek"
    | "glm"
    | "claude"
    | "gemini"
    | "openrouter"
    | "custom";
  model: string;
  apiKeyRef: string; // opaque; secret resolved server-side
  baseUrl?: string; // for ollama/custom/azure
  enabled: boolean;
}

// §11.6 — quota management.
export interface TenantQuotas {
  maxUsers: number;
  maxReports: number;
  maxDashboards: number;
  maxDataSources: number;
  monthlyAiTokens: number; // see TenantAiConfig.monthlyTokenBudget
  monthlyAiCost: number;
  monthlyExports: number;
  storageMb: number;
}

export interface TenantUsage extends TenantScoped {
  period: string; // "2026-06"
  users: number;
  reports: number;
  dashboards: number;
  dataSources: number;
  aiTokens: number;
  aiCost: number;
  exports: number;
  storageMb: number;
}
