// report-web/src/ai/mock-ai-service.ts
import type {
  IReportAIService, GenerateReportRequest, AIReportResult, AIUsage,
} from "../contracts/ai";
import type { ReportDefinition } from "../contracts/report-definition";
import type { ReportView } from "../contracts/presentation";
import { matchExample } from "./examples";
import { buildByRules, normalizePrompt } from "./rules";

/** TEMP fallback used only until Step 9 wires chooseView (Task 7). */
function fallbackViews(def: ReportDefinition): ReportView[] {
  return [{
    type: "table", library: "antd", component: "Table",
    title: def.name,
    mapping: { columns: def.columns.map((c) => c.field) },
  }];
}

/** Fabricated-but-plausible usage so cost/usage dashboards are demoable (§7.5). */
function fakeUsage(prompt: string, matched: boolean): AIUsage {
  const promptTokens = Math.max(8, Math.round(prompt.length / 3));
  const completionTokens = matched ? 120 : 180;
  return {
    provider: "mock",
    model: "mock-rules-v1",
    promptVersion: "report-gen@1",
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd: 0,
    cached: matched,
    latencyMs: 40 + Math.round(Math.random() * 60),
    fallbackUsed: false,
  };
}

export class MockReportAIService implements IReportAIService {
  async generate(req: GenerateReportRequest): Promise<AIReportResult> {
    const { prompt, semanticModel, locale } = req;
    const norm = normalizePrompt(prompt);

    const example = matchExample(norm, semanticModel.id);
    let definition: ReportDefinition;
    let matchedExample: string | undefined;
    let explanation: string;

    if (example) {
      definition = example.build(semanticModel);
      matchedExample = example.id;
      explanation = locale === "fa"
        ? `این درخواست با نمونهٔ «${definition.name}» تطبیق داده شد.`
        : `Matched the curated example "${definition.name}".`;
    } else {
      definition = buildByRules(norm, semanticModel);
      explanation = locale === "fa"
        ? `بر اساس فیلدهای مدل معنایی «${semanticModel.name["fa-IR"]}» ساخته شد.`
        : `Built from the "${semanticModel.name["en-US"]}" semantic model fields.`;
    }

    // Fill presentation.views via auto-viz (Task 7) — TEMP fallback until Step 9.
    if (definition.presentation.views.length === 0) {
      definition.presentation = { ...definition.presentation, views: fallbackViews(definition) };
    }

    return {
      definition,
      explanation,
      matchedExample,
      usage: fakeUsage(prompt, !!example),
    };
  }
}

/** Factory function (R2): returns MockReportAIService in v1. */
export function createAIService(): IReportAIService {
  return new MockReportAIService();
}
