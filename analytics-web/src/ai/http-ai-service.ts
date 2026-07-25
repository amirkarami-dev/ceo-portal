// analytics-web/src/ai/http-ai-service.ts
// Real AI service that calls POST /api/Reports/generate on the backend.
// Only used when VITE_AI_MODE="gateway" (or "http").

import type {
  IReportAIService,
  GenerateReportRequest,
  AIReportResult,
} from "../contracts/ai";
import type { ReportDefinition } from "../contracts/report-definition";
import { httpClient } from "../api/httpClient";

/** Shape the backend returns from POST /api/Reports/generate */
interface BackendGenerateResponse {
  // The backend returns the ReportDefinition directly (the "AI service" shape).
  // Fields are mapped 1-to-1; the frontend ReportDefinition is the canonical type.
  id?: string;
  name?: string;
  description?: string;
  schemaVersion?: string;
  [key: string]: unknown;
}

export class HttpReportAIService implements IReportAIService {
  async generate(req: GenerateReportRequest): Promise<AIReportResult> {
    const backendResp = await httpClient.post<BackendGenerateResponse>(
      "/api/Reports/generate",
      {
        prompt: req.prompt,
        semanticModelId: req.semanticModel.id,
      },
    );

    // The backend returns a ReportDefinition directly.
    // Cast it to the frontend type — both share the same schema.
    const definition = backendResp as unknown as ReportDefinition;

    return {
      definition,
      // explanation and usage are optional on AIReportResult; the HTTP backend
      // does not return them, so we leave them undefined.
    };
  }
}
