// Pure scoring for the monitoring checklist (monitoring_checklist.html).
// Lifted verbatim from web MonitoringChecklist.tsx — numbers MUST stay identical.

import { MONITORING_SECTIONS, MONITORING_TOOL_MAX_SCORE } from "../data/monitoringDb"

/* eslint-disable @typescript-eslint/no-explicit-any */

const SECTIONS = MONITORING_SECTIONS as any[]

export const MONITORING_MAX_SCORE = MONITORING_TOOL_MAX_SCORE

export interface MonitoringInput {
  toggles?: Record<string, boolean>
  responses?: Record<string, string>
}

export interface MonitoringResult {
  score: number
  maxScore: number
  activeRows: number
  passedRows: number
  allPassed: boolean
}

export function scoreMonitoring(input: MonitoringInput): MonitoringResult {
  const toggles = input.toggles ?? {}
  const responses = input.responses ?? {}

  let allPassed = true
  let activeRows = 0
  let passedRows = 0

  SECTIONS.forEach((section) => {
    const isActive = section.alwaysActive || toggles[section.key]
    if (!isActive) return
    section.items.forEach((_: any, idx: number) => {
      const id = `${section.key}_${idx}`
      activeRows += 1
      if (responses[id] === "y") {
        passedRows += 1
      } else {
        allPassed = false
      }
    })
  })

  return {
    score: allPassed ? MONITORING_TOOL_MAX_SCORE : 0,
    maxScore: MONITORING_TOOL_MAX_SCORE,
    activeRows,
    passedRows,
    allPassed,
  }
}
