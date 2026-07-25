// Pure derivation of the transparent-envelope (windows) report from saved env_trans
// details. Reuses calcWindowU + the scorer's limits so per-window U/SHGC and pass match
// scoreEnvTrans exactly.

import { ENV_TRANS_GLASS_DB, ENV_TRANS_GAS_DB, ENV_TRANS_PROFILE_DB } from "../data/envTransDb"
import {
  TRANS_U_LIMIT_BY_TYPE,
  getTransShgcLimit,
  isWarmClimate,
  M19_CLIMATE_DEFINITIONS,
} from "../data/climate"
import { calcWindowU, ENV_TRANS_MAX_SCORE, type EnvTransInput, type TransWindow } from "../scoring/envTrans"

/* eslint-disable @typescript-eslint/no-explicit-any */

const GLASS = ENV_TRANS_GLASS_DB as any[]
const GAS = ENV_TRANS_GAS_DB as any[]
const PROFILE = ENV_TRANS_PROFILE_DB as any[]

const TYPE_LABELS: Record<string, string> = {
  fixed: "پنجره ثابت",
  operable: "پنجره بازشو",
  door: "در نورگذر",
  skylight: "نورگیر سقفی",
}

export interface WindowReportLayer {
  name: string
  thickness: number | null
  lambda: number | null
}

export interface WindowReportRow {
  name: string
  typeLabel: string
  frameName: string
  frameU: number
  layers: WindowReportLayer[]
  uTotal: number
  uLimit: number
  uPass: boolean
  shgc: number | null
  shgcLimit: number
  shgcPass: boolean
  pf: number
  pass: boolean
}

export interface WindowsReport {
  empty: boolean
  allPassed: boolean
  score: number
  maxScore: number
  climateCode: string
  climateLabel: string
  warm: boolean
  windows: WindowReportRow[]
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function buildEnvTransReport(
  input: EnvTransInput | null | undefined,
  climateCode: string,
): WindowsReport {
  const windows = (input?.windows ?? []) as any[]

  const rows: WindowReportRow[] = windows.map((w) => {
    const { uTotal } = calcWindowU(w as TransWindow)
    const uLimit = TRANS_U_LIMIT_BY_TYPE[w.type] || TRANS_U_LIMIT_BY_TYPE.fixed
    const pf = Number(w.pf) || 0
    const shgcLimit = getTransShgcLimit(climateCode, pf)
    const shgc = numOrNull(w.shgc)
    const uPass = uTotal > 0 && uTotal <= uLimit
    const shgcPass = shgc !== null && shgc <= shgcLimit

    const glass1 = GLASS[w.l1Idx]
    const gas = GAS[w.l2Idx]
    const glass2 = GLASS[w.l3Idx]
    const profile = PROFILE[w.profileIdx]

    const layers: WindowReportLayer[] = []
    if (glass1) layers.push({ name: glass1.n, thickness: numOrNull(w.l1Th), lambda: numOrNull(glass1.l) })
    if (gas) layers.push({ name: gas.n, thickness: numOrNull(w.l2Th), lambda: numOrNull(gas.l) })
    if (glass2) layers.push({ name: glass2.n, thickness: numOrNull(w.l3Th), lambda: numOrNull(glass2.l) })

    return {
      name: (typeof w.name === "string" && w.name.trim()) || TYPE_LABELS[w.type] || "پنجره",
      typeLabel: TYPE_LABELS[w.type] || String(w.type ?? "-"),
      frameName: profile?.n || "-",
      frameU: Number(profile?.u_f || 0),
      layers,
      uTotal,
      uLimit,
      uPass,
      shgc,
      shgcLimit,
      shgcPass,
      pf,
      pass: uPass && shgcPass,
    }
  })

  const allPassed = rows.length > 0 && rows.every((r) => r.pass)
  return {
    empty: rows.length === 0,
    allPassed,
    score: allPassed ? ENV_TRANS_MAX_SCORE : 0,
    maxScore: ENV_TRANS_MAX_SCORE,
    climateCode,
    climateLabel: M19_CLIMATE_DEFINITIONS[climateCode] ?? "",
    warm: isWarmClimate(climateCode),
    windows: rows,
  }
}
