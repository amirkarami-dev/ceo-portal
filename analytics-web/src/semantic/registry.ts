import type { SemanticModel } from "../contracts/semantic";
import type { Dataset } from "../contracts/dataset";
import { projectModel } from "./models/project";
import { salesModel } from "./models/sales";
import { financeModel } from "./models/finance";
import { ozInfoModel, engineerProjectsModel } from "./models/kurdnezam";
import { projectData } from "./datasets/project";
import { salesData } from "./datasets/sales";
import { financeData } from "./datasets/finance";

// Named re-exports so tests and UI code can import models directly:
// import { salesModel, projectModel } from "../semantic/registry"
export { projectModel, salesModel, financeModel };
export { ozInfoModel, engineerProjectsModel };

/** In REAL mode the dataset picker + auto-viz use the live KurdNezam models (matching the
 *  backend store); in MOCK/dev mode they use the bundled sample models + in-browser data. */
const USE_REAL_MODELS =
  (import.meta.env.VITE_USE_MOCK_API as string | undefined) === "false";

/** All bundled semantic models, keyed by model id. */
export const semanticModels: Record<string, SemanticModel> = USE_REAL_MODELS
  ? {
      [ozInfoModel.id]: ozInfoModel,
      [engineerProjectsModel.id]: engineerProjectsModel,
    }
  : {
      // sales first ON PURPOSE: the Ask-AI default dataset is listSemanticModels()[0],
      // and the sample prompts (and AskAiBuilder tests) assume model-sales is the default.
      [salesModel.id]: salesModel,
      [projectModel.id]: projectModel,
      [financeModel.id]: financeModel,
    };

/** All bundled sample datasets, keyed by entity `source` (the value a
 *  ReportDefinition.dataset points at). */
export const datasets: Record<string, Dataset> = {
  [projectModel.entities[0].source]: projectData,
  [salesModel.entities[0].source]: salesData,
  [financeModel.entities[0].source]: financeData,
};

export function getSemanticModel(id: string): SemanticModel {
  const model = semanticModels[id];
  if (!model) throw new Error(`Unknown semantic model: ${id}`);
  return model;
}

export function getDataset(source: string): Dataset {
  const data = datasets[source];
  if (!data) throw new Error(`Unknown dataset: ${source}`);
  return data;
}

/** List all bundled semantic models with their key and localised label (fa-IR default). */
export function listSemanticModels(): { key: string; label: string }[] {
  return Object.values(semanticModels).map((m) => ({
    key: m.id,
    label: m.name["fa-IR"] ?? m.name["en-US"] ?? m.id,
  }));
}

/** Find the model that owns an entity whose `source` matches. */
export function getModelForDataset(source: string): SemanticModel {
  for (const model of Object.values(semanticModels)) {
    if (model.entities.some((e) => e.source === source)) return model;
  }
  throw new Error(`Unknown dataset source: ${source}`);
}
