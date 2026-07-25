// Pure scoring for the opaque-envelope checklist (env_opaque.html, max 105).
// Lifted verbatim from web EnvOpaqueChecklist.tsx — numbers MUST stay identical.

import { getOpaqueTargetR } from "../data/climate"
import { toNum } from "./types"

export interface OpaqueLayer {
  rValue?: number | null
  [key: string]: unknown
}

export interface OpaqueAnalysis {
  targetKey: string
  layers: OpaqueLayer[]
}

export interface OpaqueBridge {
  south: number | null
  north: number | null
  east: number | null
  west: number | null
  mitigation: boolean
}

export interface OpaqueShading {
  q1: string | null
  q2: string | null
}

export interface EnvOpaqueInput {
  analyses?: OpaqueAnalysis[]
  bridge?: OpaqueBridge
  shading?: OpaqueShading
}

export const ENV_OPAQUE_MAX_SCORE = 105

export interface EnvOpaqueResult {
  score: number
  maxScore: number
  envelopePass: boolean
  bridgePass: boolean
}

export function scoreEnvOpaque(input: EnvOpaqueInput, climateCode: string): EnvOpaqueResult {
  const analyses = input.analyses ?? []

  const analysisStats = analyses.map((analysis) => {
    const requiredR = getOpaqueTargetR(analysis.targetKey, climateCode)
    const totalR = (analysis.layers ?? []).reduce((sum, layer) => sum + toNum(layer.rValue), 0)
    return totalR > requiredR
  })
  const envelopePass = analysisStats.length > 0 && analysisStats.every((pass) => pass)

  let bridgePass = false
  const bridge = input.bridge
  if (bridge) {
    const values = [bridge.south, bridge.north, bridge.east, bridge.west]
    if (values.some((v) => v === null || v === undefined || (v as unknown) === "")) {
      bridgePass = false
    } else {
      const numericValues = values.map(toNum)
      const highBridge = numericValues.some((v) => v > 5)
      bridgePass = !highBridge ? true : Boolean(bridge.mitigation)
    }
  }

  const insulationScore = envelopePass && bridgePass ? 90 : 0
  const shading = input.shading
  const shadingScore = shading && (shading.q1 === "yes" || shading.q2 === "yes") ? 15 : 0

  return {
    score: insulationScore + shadingScore,
    maxScore: ENV_OPAQUE_MAX_SCORE,
    envelopePass,
    bridgePass,
  }
}
