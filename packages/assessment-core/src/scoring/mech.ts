// Pure scoring for the mechanical checklist (mech_checklist.html, max 240).
// Lifted verbatim from web MechChecklist.tsx — numbers MUST stay identical.

import { MECH_DB } from "../data/mechDb"
import { getGroupIndex } from "../data/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */

const DB = MECH_DB as any[]

export const MECH_MAX_SCORE = 240

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`

export interface MechRowState {
  radio?: string
  number?: number | null
  text?: string
  eff?: string
  rank?: string
  selectValue?: string
}

export interface MechInput {
  group?: string
  manualGroup?: string | null
  responses?: Record<string, MechRowState>
  logicOffRows?: string[]
}

const getRowPass = (item: any, state: MechRowState): boolean => {
  if (item.type === "bool" || item.type === "bool_reverse") {
    return state.radio === "y"
  }
  if (item.type === "num") {
    const value = Number(state.number)
    if (!Number.isFinite(value)) return false
    const min = item.v?.min ?? -Infinity
    const max = item.v?.max ?? Infinity
    return value >= min && value <= max
  }
  if (item.type === "text") {
    return Boolean(state.text?.trim())
  }
  if (item.type === "eff_pair") {
    return Boolean(state.eff?.trim() || state.rank?.trim())
  }
  if (item.type === "custom_select") {
    return Boolean(state.selectValue)
  }
  return false
}

export interface MechResult {
  score: number
  maxScore: number
  sectionStats: Record<string, { max: number; count: number; passed: number; score: number }>
}

export function scoreMech(input: MechInput): MechResult {
  const currentGroup = input.group ?? input.manualGroup ?? "A"
  const responses = input.responses ?? {}
  const logicOff = new Set(input.logicOffRows ?? [])

  const isRowGroupActive = (minGroup?: string) =>
    getGroupIndex(currentGroup) >= getGroupIndex(minGroup || "A")
  const isRowLogicActive = (id: string) => !logicOff.has(id)

  const sectionStats: MechResult["sectionStats"] = {}
  DB.forEach((section) => {
    sectionStats[section.id] = { max: section.max, count: 0, passed: 0, score: 0 }
  })

  DB.forEach((section, sIdx) => {
    section.cats.forEach((cat: any, cIdx: number) => {
      const visit = (items: any[], prefix: string | null = null) => {
        items.forEach((item, itemIdx) => {
          const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
          const id = rowId(sIdx, cIdx, suffix)
          const active = isRowGroupActive(item.minG) && isRowLogicActive(id)
          if (!active) return
          sectionStats[section.id].count += 1
          if (getRowPass(item, responses[id] || {})) sectionStats[section.id].passed += 1
        })
      }
      visit(cat.items || [])
      ;(cat.subGroups || []).forEach((subGroup: any, subIdx: number) => {
        visit(subGroup.items || [], `sub${subIdx}`)
      })
    })
  })

  Object.keys(sectionStats).forEach((sectionId) => {
    const section = sectionStats[sectionId]
    if (section.count === 0) {
      section.score = section.max
    } else {
      section.score = section.count === section.passed ? section.max : 0
    }
  })

  const totalScore = Object.values(sectionStats).reduce((sum, item) => sum + item.score, 0)
  return { score: totalScore, maxScore: MECH_MAX_SCORE, sectionStats }
}
