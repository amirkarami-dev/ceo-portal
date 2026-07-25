// Pure scoring for the integrated-management checklist (integrated_mgmt.html).
// Lifted verbatim from web IntegratedMgmtChecklist.tsx — numbers MUST stay identical.

import { INTEGRATED_ITEMS, INTEGRATED_TOOL_MAX_SCORE } from "../data/integratedDb"

/* eslint-disable @typescript-eslint/no-explicit-any */

const ITEMS = INTEGRATED_ITEMS as any[]

export const INTEGRATED_MAX_SCORE = INTEGRATED_TOOL_MAX_SCORE

export interface IntegratedInput {
  logicActive?: boolean
  responses?: Record<string, string>
}

export interface IntegratedResult {
  score: number
  maxScore: number
  activeRows: number
  passedRows: number
  allPassed: boolean
}

export function scoreIntegrated(input: IntegratedInput): IntegratedResult {
  const logicActive = Boolean(input.logicActive)
  const responses = input.responses ?? {}

  const activeRows = logicActive ? ITEMS.length : 0
  const passedRows = logicActive
    ? ITEMS.filter((_, idx) => responses[`row_${idx}`] === "y").length
    : 0
  const allPassed = !logicActive || passedRows === ITEMS.length

  return {
    score: allPassed ? INTEGRATED_TOOL_MAX_SCORE : 0,
    maxScore: INTEGRATED_TOOL_MAX_SCORE,
    activeRows,
    passedRows,
    allPassed,
  }
}
