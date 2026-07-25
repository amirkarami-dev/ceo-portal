// analytics-web/src/ai/index.ts
// Barrel: re-export the service factory and its types so consumers never
// import from concrete implementation files directly.
//
// createAIService() returns:
//   VITE_AI_MODE="gateway" | "http"  →  HttpReportAIService (real API)
//   anything else (default "mock")   →  MockReportAIService (localStorage / rules)

import { MockReportAIService } from "./mock-ai-service";
import { HttpReportAIService } from "./http-ai-service";
import type { IReportAIService } from "./IReportAIService";

export function createAIService(): IReportAIService {
  const mode = (import.meta.env.VITE_AI_MODE as string | undefined) ?? "mock";
  if (mode === "gateway" || mode === "http") {
    return new HttpReportAIService();
  }
  return new MockReportAIService();
}

export type { IReportAIService, GenerateReportRequest, AIReportResult } from "./IReportAIService";
