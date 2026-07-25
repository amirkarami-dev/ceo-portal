// Dispatcher + aggregate helpers over the six per-checklist scoring functions.

import type { ToolKey } from "../data/sections"
import type { ToolScore } from "./types"
import { scoreEnvOpaque } from "./envOpaque"
import { scoreEnvTrans } from "./envTrans"
import { scoreMech } from "./mech"
import { scoreElec } from "./elec"
import { scoreMonitoring } from "./monitoring"
import { scoreIntegrated } from "./integrated"

export * from "./types"
export * from "./envOpaque"
export * from "./envTrans"
export * from "./mech"
export * from "./elec"
export * from "./monitoring"
export * from "./integrated"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Score a single tool from its stored input (the per-tool `details` object).
export function scoreTool(toolKey: ToolKey, input: any, climateCode: string): ToolScore {
  switch (toolKey) {
    case "env_opaque.html":
      return scoreEnvOpaque(input ?? {}, climateCode)
    case "env_trans.html":
      return scoreEnvTrans(input ?? {}, climateCode)
    case "mech_checklist.html":
      return scoreMech(input ?? {})
    case "elec_checklist.html":
      return scoreElec(input ?? {})
    case "monitoring_checklist.html":
      return scoreMonitoring(input ?? {})
    case "integrated_mgmt.html":
      return scoreIntegrated(input ?? {})
    default:
      return { score: 0, maxScore: 0 }
  }
}
