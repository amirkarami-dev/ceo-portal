// Pure derivation of the opaque-envelope (env_opaque) REPORT view-model from a saved
// assessment's stored details. No React, no formatting — just the numbers and labels the
// printable report needs. Mirrors scoreEnvOpaque's pass/score logic exactly so the report
// can never disagree with the saved score.

import { getOpaqueTargetR, OPAQUE_TARGET_LABELS } from "../data/climate"
import { ENV_OPAQUE_DB } from "../data/envOpaqueDb"
import { toNum } from "../scoring/types"
import type { EnvOpaqueInput } from "../scoring/envOpaque"

const DB = ENV_OPAQUE_DB as Record<string, { label: string }>

export interface EnvReportLayer {
  /** 1-based row number within the assembly. */
  index: number
  categoryKey: string
  categoryLabel: string
  material: string
  manufacturer: string
  thickness: number | null
  density: string
  lambda: number | null
  rValue: number
  standard: string
}

export type EnvAssemblyGroup = "wall" | "roof" | "floor" | "door" | "other"

export interface EnvReportAssembly {
  /** Type code within its group, e.g. W1 / R1 / F1 / D1. */
  code: string
  group: EnvAssemblyGroup
  targetKey: string
  label: string
  requiredR: number
  /** Sum of layer R, rounded to 3 decimals for display. */
  totalR: number
  pass: boolean
  layers: EnvReportLayer[]
}

export interface EnvReportSummaryGroup {
  group: EnvAssemblyGroup
  title: string
  rows: Array<{ code: string; label: string; rValue: number; pass: boolean }>
}

export interface EnvReportBridge {
  south: number | null
  north: number | null
  east: number | null
  west: number | null
  mitigation: boolean
  allDefined: boolean
  highBridge: boolean
  pass: boolean
}

export interface EnvReportScores {
  insulation: number
  shading: number
  total: number
  max: number
}

export interface EnvOpaqueReport {
  empty: boolean
  assemblies: EnvReportAssembly[]
  summaryGroups: EnvReportSummaryGroup[]
  bridge: EnvReportBridge
  shading: { q1: string | null; q2: string | null }
  scores: EnvReportScores
  /** True when there is at least one assembly and all of them pass. */
  allPass: boolean
}

const GROUP_META: Array<{ group: EnvAssemblyGroup; prefix: string; title: string }> = [
  { group: "wall", prefix: "W", title: "مقاومت حرارتی دیوارهای خارجی" },
  { group: "roof", prefix: "R", title: "مقاومت حرارتی سقف" },
  { group: "floor", prefix: "F", title: "مقاومت حرارتی کف" },
  { group: "door", prefix: "D", title: "مقاومت حرارتی درهای غیر نورگذر" },
]

const groupOf = (targetKey: string): EnvAssemblyGroup => {
  const head = targetKey.split("_")[0]
  if (head === "wall" || head === "roof" || head === "floor" || head === "door") return head
  return "other"
}

const asStr = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v)

const asNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const round3 = (n: number): number => Number(n.toFixed(3))

/**
 * Build the opaque-envelope report view-model from the stored `env_opaque.html` details
 * (`{ analyses, bridge, shading }`) and the project's climate code.
 */
export function buildEnvOpaqueReport(
  input: EnvOpaqueInput | null | undefined,
  climateCode: string,
): EnvOpaqueReport {
  const analyses = input?.analyses ?? []
  const prefixCounter: Record<string, number> = {}

  const assemblies: EnvReportAssembly[] = analyses.map((analysis) => {
    const group = groupOf(analysis.targetKey)
    const meta = GROUP_META.find((g) => g.group === group)
    const prefix = meta?.prefix ?? "X"
    prefixCounter[prefix] = (prefixCounter[prefix] ?? 0) + 1
    const code = `${prefix}${prefixCounter[prefix]}`

    const requiredR = getOpaqueTargetR(analysis.targetKey, climateCode)
    const rawLayers = analysis.layers ?? []
    const totalRRaw = rawLayers.reduce((sum, layer) => sum + toNum(layer.rValue), 0)

    const layers: EnvReportLayer[] = rawLayers.map((layer, i) => {
      const l = layer as Record<string, unknown>
      const categoryKey = asStr(l.categoryKey)
      return {
        index: i + 1,
        categoryKey,
        categoryLabel: (categoryKey && DB[categoryKey]?.label) || "-",
        material: asStr(l.materialName) || "-",
        manufacturer: asStr(l.manufacturer) || "-",
        thickness: asNumOrNull(l.thickness),
        density: asStr(l.density) || "-",
        lambda: asNumOrNull(l.lambda),
        rValue: toNum(l.rValue),
        standard: asStr(l.standard) || "-",
      }
    })

    return {
      code,
      group,
      targetKey: analysis.targetKey,
      label: OPAQUE_TARGET_LABELS[analysis.targetKey] ?? analysis.targetKey,
      requiredR,
      totalR: round3(totalRRaw),
      // Compare with the UNROUNDED sum so pass matches scoreEnvOpaque exactly.
      pass: totalRRaw > requiredR,
      layers,
    }
  })

  const summaryGroups: EnvReportSummaryGroup[] = GROUP_META.map((meta) => ({
    group: meta.group,
    title: meta.title,
    rows: assemblies
      .filter((a) => a.group === meta.group)
      .map((a) => ({ code: a.code, label: a.label, rValue: a.totalR, pass: a.pass })),
  })).filter((g) => g.rows.length > 0)

  // Bridge — identical logic to scoreEnvOpaque.
  const b = input?.bridge
  const bridgeValues = [b?.south, b?.north, b?.east, b?.west]
  const allDefined =
    !!b && !bridgeValues.some((v) => v === null || v === undefined || (v as unknown) === "")
  const highBridge = allDefined && bridgeValues.map((v) => toNum(v)).some((v) => v > 5)
  const bridgePass = allDefined ? (!highBridge ? true : Boolean(b?.mitigation)) : false

  const envelopePass = assemblies.length > 0 && assemblies.every((a) => a.pass)
  const shadingQ1 = input?.shading?.q1 ?? null
  const shadingQ2 = input?.shading?.q2 ?? null
  const insulation = envelopePass && bridgePass ? 90 : 0
  const shadingScore = shadingQ1 === "yes" || shadingQ2 === "yes" ? 15 : 0

  return {
    empty: assemblies.length === 0,
    assemblies,
    summaryGroups,
    bridge: {
      south: b?.south ?? null,
      north: b?.north ?? null,
      east: b?.east ?? null,
      west: b?.west ?? null,
      mitigation: Boolean(b?.mitigation),
      allDefined,
      highBridge,
      pass: bridgePass,
    },
    shading: { q1: shadingQ1, q2: shadingQ2 },
    scores: { insulation, shading: shadingScore, total: insulation + shadingScore, max: 105 },
    allPass: envelopePass,
  }
}
