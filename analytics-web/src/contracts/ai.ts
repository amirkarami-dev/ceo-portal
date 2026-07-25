import type { ReportDefinition } from "./report-definition";
import type { SemanticModel } from "./semantic";

// ─── AI Provider / TenantAIConfig (Task 18) ────────────────────────────────

export type ProviderType =
  | "openai"
  | "azure-openai"
  | "ollama"
  | "deepseek"
  | "glm"
  | "claude"
  | "gemini"
  | "openrouter"
  | "custom";

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  model: string;
  baseUrl?: string;
  deployment?: string;
  apiVersion?: string;
  /** secret reference — never the raw key. null for local/keyless providers. */
  keyRef: string | null;
  headers?: Record<string, string>;
  params: { temperature: number; maxTokens: number; responseFormat?: string };
  pricing?: { inputPer1k: number; outputPer1k: number };
  enabled: boolean;
}

export interface TenantAIConfig {
  tenantId: string;
  defaultModelId: string;
  fallbackChain: string[];
  promptVersion: string;
  cache: { enabled: boolean; ttlSeconds: number };
  quota: { monthlyTokenLimit: number; monthlyCostUsdLimit: number };
  providers: ProviderConfig[];
}

// R2: the AI seam. ONE method: generate(req). The spec §7.4 multi-method
// interface (generateReport/refineReport/suggestPrompts/stream) is collapsed
// to this single canonical signature.

export interface GenerateReportRequest {
  /** Raw user text, e.g. "درآمد ماهانه به تفکیک استان". */
  prompt: string;
  /** The tenant's semantic model — the ONLY schema the AI ever sees. */
  semanticModel: SemanticModel;
  locale: "fa" | "en";
}

/** The AI's output envelope (R2). */
export interface AIReportResult {
  /** Validated, ready for the Query Engine. */
  definition: ReportDefinition;
  /** Human-readable interpretation ("I read this as…"). */
  explanation?: string;
  /** Token/cost/provider metadata for usage dashboards & audit log. */
  usage?: AIUsage;
  /** id of the matched example, when generation came from the example library. */
  matchedExample?: string;
}

export interface AIUsage {
  provider: string; // "openai" | "ollama" | "mock" | ...
  model: string; // "gpt-4o-mini", "mock-rules-v1", ...
  promptVersion: string; // "report-gen@3"
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number; // estimated; 0 for ollama/mock
  cached: boolean; // true if served from response cache
  latencyMs: number;
  fallbackUsed: boolean; // true if a non-primary provider answered
}

/** The single seam between UI and AI. v1 → MockReportAIService; later → Http. */
export interface IReportAIService {
  generate(req: GenerateReportRequest): Promise<AIReportResult>;
}
