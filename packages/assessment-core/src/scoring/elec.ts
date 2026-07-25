// Pure scoring for the electrical checklist (elec_checklist.html, max 196).
// Lifted verbatim from web ElecChecklist.tsx — numbers MUST stay identical.

import { ELEC_DB, ELEC_RULES } from "../data/elecDb"

/* eslint-disable @typescript-eslint/no-explicit-any */

const DB = ELEC_DB as any[]
const RULES = ELEC_RULES as Record<string, Record<string, boolean>>
const ELECTRIC_SECTIONS = DB.filter((section) => section.id !== "renew")

export const ELEC_MAX_SCORE = 196

const TB_DLA_ROWS = [
  { name: "اداری کوچک تر از ۲۰۰۰ متر مربع", limit: 20 },
  { name: "اداری بزرگتر از ۲۰۰۰ متر مربع", limit: 40 },
  { name: "تجاری کوچک تر از ۲۰۰۰ متر مربع", limit: 10 },
  { name: "تجاری بزرگتر از ۲۰۰۰ متر مربع", limit: 60 },
  { name: "آموزشی", limit: 45 },
  { name: "انبار، سوله صنعتی", limit: 50 },
]
const TB_U_ROWS = [
  { name: "پارکینگ", limit: 0.4 },
  { name: "راهروها و فضاهای عمومی", limit: 0.5 },
  { name: "اداری و فضاهای کار", limit: 0.7 },
  { name: "کلاسهای درس", limit: 0.7 },
  { name: "فضاهای عمومی و بستری بیمارستانها", limit: 0.6 },
  { name: "آزمایشگاه و فضاهای فعالیتهای دقیق", limit: 0.8 },
]

// Exposed so the UI editors render the exact same table rows the scoring uses.
export const ELEC_TABLE_TEMPLATES: Record<string, { name: string; limit: number }[]> = {
  tb_dla: TB_DLA_ROWS,
  tb_u: TB_U_ROWS,
}

const getTableTemplate = (type: string) => ELEC_TABLE_TEMPLATES[type] ?? []

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`

export interface ElecTableEntry {
  checked: boolean
  value: number | null
}
export interface ElecRowState {
  radio?: string
  number?: number | null
  table?: ElecTableEntry[]
}

export interface ElecInput {
  group?: string
  manualGroup?: string | null
  responses?: Record<string, ElecRowState>
}

export interface ElecResult {
  score: number
  maxScore: number
  sectionStats: Record<string, { max: number; count: number; ok: boolean; score: number }>
}

export function scoreElec(input: ElecInput): ElecResult {
  const currentGroup = input.group ?? input.manualGroup ?? "A"
  const responses = input.responses ?? {}

  const isTagActive = (tag?: string) => {
    const cfg = RULES[currentGroup] || {}
    if (!tag) return true
    if (cfg[tag] === false) return false
    return true
  }

  const sectionStats: ElecResult["sectionStats"] = {}
  ELECTRIC_SECTIONS.forEach((section) => {
    sectionStats[section.id] = { max: section.max, count: 0, ok: true, score: 0 }
  })

  const evaluateRow = (item: any, id: string): boolean => {
    const state = responses[id] || {}
    if (item.type === "bool") {
      return state.radio === "y"
    }
    if (item.type === "num") {
      const value = Number(state.number)
      if (!Number.isFinite(value)) return false
      const min = item.v?.min ?? -Infinity
      const max = item.v?.max ?? Infinity
      return value >= min && value <= max
    }
    if (item.type === "tb_dla" || item.type === "tb_u") {
      const template = getTableTemplate(item.type)
      const table = state.table || template.map(() => ({ checked: false, value: null }))
      const checkedRows = table.filter((entry) => entry.checked)
      if (checkedRows.length === 0) return false
      return table.every((entry, idx) => {
        if (!entry.checked) return true
        const value = Number(entry.value)
        if (!Number.isFinite(value)) return false
        return value >= template[idx].limit
      })
    }
    return false
  }

  ELECTRIC_SECTIONS.forEach((section, sIdx) => {
    section.cats.forEach((cat: any, cIdx: number) => {
      const visit = (items: any[], prefix: string | null = null) => {
        items.forEach((item, itemIdx) => {
          const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
          const id = rowId(sIdx, cIdx, suffix)
          if (!isTagActive(item.tag)) return
          sectionStats[section.id].count += 1
          const pass = evaluateRow(item, id)
          if (!pass) sectionStats[section.id].ok = false
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
    section.score = section.count > 0 && section.ok ? section.max : 0
  })

  const totalScore = Object.values(sectionStats).reduce((sum, item) => sum + item.score, 0)
  return { score: totalScore, maxScore: ELEC_MAX_SCORE, sectionStats }
}
