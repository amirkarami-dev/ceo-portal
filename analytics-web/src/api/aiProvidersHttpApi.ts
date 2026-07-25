// analytics-web/src/api/aiProvidersHttpApi.ts
// HTTP implementations of the AI Providers calls that back the
// useProviders hook when VITE_USE_MOCK_API === "false".
//
// Backend endpoints (all live under /api/AiProviders):
//   GET  /api/AiProviders                 → BackendAiProvider[]  (no secrets)
//   POST /api/AiProviders  { id, type, enabled, config } → upsert (204 or { id })

import { httpClient } from "./httpClient";
import type { AIProviderRow } from "./mockApi";

/** Shape the backend returns for each AI Provider item (no secrets) */
interface BackendAiProvider {
  id: string;
  type: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

/** Maps backend type strings to the frontend union type. */
function mapType(raw: string): AIProviderRow["type"] {
  const upper = raw.toUpperCase();
  if (upper === "OPENAI") return "OpenAI";
  if (upper === "AZURE") return "Azure";
  if (upper === "OLLAMA") return "Ollama";
  if (upper === "CLAUDE") return "Claude";
  // Default to OpenAI for unknown types
  return "OpenAI";
}

function backendToFrontend(b: BackendAiProvider): AIProviderRow {
  return {
    id: b.id,
    tenantId: "",
    type: mapType(b.type),
    model: (b.config?.["model"] as string | undefined) ?? "",
    status: b.enabled ? "active" : "inactive",
  };
}

export const aiProvidersHttpApi = {
  /** GET /api/AiProviders — returns the list without secrets. */
  async list(): Promise<AIProviderRow[]> {
    const items = await httpClient.get<BackendAiProvider[]>("/api/AiProviders");
    return items.map(backendToFrontend);
  },

  /**
   * POST /api/AiProviders — upserts a provider config.
   * Maps the frontend row back to the backend upsert shape.
   */
  async upsert(row: AIProviderRow): Promise<void> {
    await httpClient.post("/api/AiProviders", {
      id: row.id,
      type: row.type,
      enabled: row.status === "active",
      config: { model: row.model },
    });
  },
};
