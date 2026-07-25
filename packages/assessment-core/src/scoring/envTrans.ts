// Pure scoring for the transparent-envelope checklist (env_trans.html, max 93).
// Lifted verbatim from web EnvTransChecklist.tsx — numbers MUST stay identical.

import { ENV_TRANS_GAS_DB, ENV_TRANS_GLASS_DB, ENV_TRANS_PROFILE_DB } from "../data/envTransDb"
import { getTransShgcLimit, TRANS_U_LIMIT_BY_TYPE } from "../data/climate"

/* eslint-disable @typescript-eslint/no-explicit-any */

const GLASS = ENV_TRANS_GLASS_DB as any[]
const GAS = ENV_TRANS_GAS_DB as any[]
const PROFILE = ENV_TRANS_PROFILE_DB as any[]

export interface TransWindow {
  type: string
  profileIdx: number
  l1Idx: number
  l2Idx: number
  l3Idx: number
  l1Th: number
  l2Th: number
  l3Th: number
  shgc: number | null
  pf: number | null
}

export interface EnvTransInput {
  windows?: TransWindow[]
}

export const ENV_TRANS_MAX_SCORE = 93

const calcLayerR = (lambda: unknown, thickness: unknown): number => {
  const lam = Number(lambda)
  const th = Number(thickness)
  if (!Number.isFinite(lam) || lam <= 0 || !Number.isFinite(th) || th <= 0) return 0
  return Number((th / 1000 / lam).toFixed(3))
}

export const calcWindowU = (windowItem: TransWindow): { uTotal: number } => {
  const l1 = GLASS[windowItem.l1Idx]
  const l2 = GAS[windowItem.l2Idx]
  const l3 = GLASS[windowItem.l3Idx]
  const profile = PROFILE[windowItem.profileIdx]

  const r1 = calcLayerR(l1?.l, windowItem.l1Th)
  const r2 = calcLayerR(l2?.l, windowItem.l2Th)
  const r3 = calcLayerR(l3?.l, windowItem.l3Th)
  const uFrame = Number(profile?.u_f || 0)
  const rTotalGlass = 0.17 + r1 + r2 + r3
  const uGlass = rTotalGlass > 0 ? 1 / rTotalGlass : 0
  let uTotal = uGlass * 0.8 + uFrame * 0.2
  if (!uFrame) uTotal = uGlass
  return { uTotal: Number(uTotal.toFixed(2)) }
}

export interface EnvTransResult {
  score: number
  maxScore: number
  allPassed: boolean
}

export function scoreEnvTrans(input: EnvTransInput, climateCode: string): EnvTransResult {
  const windows = input.windows ?? []
  const allPassed =
    windows.length > 0 &&
    windows.every((windowItem) => {
      const { uTotal } = calcWindowU(windowItem)
      const uLimit = TRANS_U_LIMIT_BY_TYPE[windowItem.type] || TRANS_U_LIMIT_BY_TYPE.fixed
      const pfValue = Number(windowItem.pf) || 0
      const shgcLimit = getTransShgcLimit(climateCode, pfValue)
      const shgcValue = Number(windowItem.shgc)
      const uPass = uTotal > 0 && uTotal <= uLimit
      const shgcPass = Number.isFinite(shgcValue) && shgcValue <= shgcLimit
      return uPass && shgcPass
    })

  return { score: allPassed ? ENV_TRANS_MAX_SCORE : 0, maxScore: ENV_TRANS_MAX_SCORE, allPassed }
}
