// Pure derivation of the questionnaire-style section reports (mech / elec / monitoring /
// integrated) from saved checklist details. Canonical scores come straight from the
// matching scorer (scoreMech/scoreElec/...) so report numbers can never disagree with the
// stored score; the DB is iterated only to build the human-readable display rows, using
// row-id + pass logic that mirrors the scorer exactly.

import { MECH_DB } from "../data/mechDb"
import { ELEC_DB, ELEC_RULES } from "../data/elecDb"
import { MONITORING_SECTIONS } from "../data/monitoringDb"
import { INTEGRATED_ITEMS } from "../data/integratedDb"
import { getGroupIndex } from "../data/utils"
import { scoreMech, type MechInput, type MechRowState } from "../scoring/mech"
import { scoreElec, ELEC_TABLE_TEMPLATES, type ElecInput, type ElecRowState } from "../scoring/elec"
import { scoreMonitoring, type MonitoringInput } from "../scoring/monitoring"
import { scoreIntegrated, type IntegratedInput } from "../scoring/integrated"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ChecklistReportRow {
  label: string
  /** Sub-grouping heading (mech/elec category, integrated target). */
  category?: string
  answer: string
  answered: boolean
  pass: boolean
}

export interface ChecklistReportSection {
  title: string
  /** Per-section max/score for mech/elec; null for all-or-nothing tools. */
  max: number | null
  score: number | null
  pass: boolean
  activeCount: number
  passedCount: number
  rows: ChecklistReportRow[]
  note?: string
}

export interface ChecklistReport {
  empty: boolean
  totalScore: number
  maxScore: number
  allPassed: boolean
  /** Building group code (mech/elec) or null. */
  buildingGroup: string | null
  scoreMode: "perSection" | "allOrNothing"
  sections: ChecklistReportSection[]
}

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`
const label = (prefix: unknown, text: unknown) => {
  const p = typeof prefix === "string" ? prefix.trim() : ""
  const t = typeof text === "string" ? text : ""
  return p ? `${p} ${t}` : t
}
const boolAnswer = (v: string | undefined) =>
  v === "y" ? { answer: "بله", answered: true } : v === "n" ? { answer: "خیر", answered: true } : { answer: "—", answered: false }

// ---------------------------------------------------------------- mechanical ----

const mechRowPass = (item: any, state: MechRowState): boolean => {
  if (item.type === "bool" || item.type === "bool_reverse") return state.radio === "y"
  if (item.type === "num") {
    const value = Number(state.number)
    if (!Number.isFinite(value)) return false
    return value >= (item.v?.min ?? -Infinity) && value <= (item.v?.max ?? Infinity)
  }
  if (item.type === "text") return Boolean(state.text?.trim())
  if (item.type === "eff_pair") return Boolean(state.eff?.trim() || state.rank?.trim())
  if (item.type === "custom_select") return Boolean(state.selectValue)
  return false
}

const mechAnswer = (item: any, state: MechRowState): { answer: string; answered: boolean } => {
  switch (item.type) {
    case "bool":
    case "bool_reverse":
      return boolAnswer(state.radio)
    case "num": {
      const has = state.number !== null && state.number !== undefined && (state.number as unknown) !== ""
      return has
        ? { answer: `${state.number}${item.unit ? ` ${item.unit}` : ""}`, answered: true }
        : { answer: "—", answered: false }
    }
    case "text":
      return state.text?.trim() ? { answer: state.text, answered: true } : { answer: "—", answered: false }
    case "eff_pair": {
      const parts = [state.eff?.trim(), state.rank?.trim()].filter(Boolean)
      return parts.length ? { answer: parts.join(" / "), answered: true } : { answer: "—", answered: false }
    }
    case "custom_select":
      return state.selectValue ? { answer: String(state.selectValue), answered: true } : { answer: "—", answered: false }
    default:
      return { answer: "—", answered: false }
  }
}

export function buildMechReport(details: MechInput | null | undefined): ChecklistReport {
  if (!details) return emptyChecklist(240, "perSection")
  const group = details.group ?? details.manualGroup ?? "A"
  const responses = details.responses ?? {}
  const logicOff = new Set(details.logicOffRows ?? [])
  const stats = scoreMech(details).sectionStats
  const groupActive = (minG?: string) => getGroupIndex(group) >= getGroupIndex(minG || "A")

  const sections: ChecklistReportSection[] = (MECH_DB as any[]).map((section, sIdx) => {
    const rows: ChecklistReportRow[] = []
    section.cats.forEach((cat: any, cIdx: number) => {
      const visit = (items: any[], prefix: string | null = null) => {
        items.forEach((item, itemIdx) => {
          const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
          const id = rowId(sIdx, cIdx, suffix)
          if (!(groupActive(item.minG) && !logicOff.has(id))) return
          const state = responses[id] || {}
          rows.push({
            label: label(item.char, item.text),
            category: cat.name,
            ...mechAnswer(item, state),
            pass: mechRowPass(item, state),
          })
        })
      }
      visit(cat.items || [])
      ;(cat.subGroups || []).forEach((sg: any, subIdx: number) => visit(sg.items || [], `sub${subIdx}`))
    })
    const s = stats[section.id]
    return {
      title: section.title,
      max: s.max,
      score: s.score,
      pass: s.score === s.max,
      activeCount: s.count,
      passedCount: s.passed,
      rows,
    }
  })

  const result = scoreMech(details)
  return {
    empty: false,
    totalScore: result.score,
    maxScore: result.maxScore,
    allPassed: result.score === result.maxScore,
    buildingGroup: group,
    scoreMode: "perSection",
    sections,
  }
}

// ---------------------------------------------------------------- electrical ----

const elecRowPass = (item: any, state: ElecRowState): boolean => {
  if (item.type === "bool") return state.radio === "y"
  if (item.type === "num") {
    const value = Number(state.number)
    if (!Number.isFinite(value)) return false
    return value >= (item.v?.min ?? -Infinity) && value <= (item.v?.max ?? Infinity)
  }
  if (item.type === "tb_dla" || item.type === "tb_u") {
    const template = ELEC_TABLE_TEMPLATES[item.type] ?? []
    const table = state.table || template.map(() => ({ checked: false, value: null }))
    if (!table.some((e) => e.checked)) return false
    return table.every((e, idx) => {
      if (!e.checked) return true
      const v = Number(e.value)
      return Number.isFinite(v) && v >= template[idx].limit
    })
  }
  return false
}

const elecAnswer = (item: any, state: ElecRowState): { answer: string; answered: boolean } => {
  if (item.type === "bool") return boolAnswer(state.radio)
  if (item.type === "num") {
    const has = state.number !== null && state.number !== undefined && (state.number as unknown) !== ""
    return has ? { answer: String(state.number), answered: true } : { answer: "—", answered: false }
  }
  if (item.type === "tb_dla" || item.type === "tb_u") {
    const template = ELEC_TABLE_TEMPLATES[item.type] ?? []
    const checked = (state.table || [])
      .map((e, idx) => (e.checked ? `${template[idx]?.name ?? `#${idx}`}: ${e.value ?? "-"}` : null))
      .filter(Boolean) as string[]
    return checked.length ? { answer: checked.join("، "), answered: true } : { answer: "—", answered: false }
  }
  return { answer: "—", answered: false }
}

export function buildElecReport(details: ElecInput | null | undefined): ChecklistReport {
  if (!details) return emptyChecklist(196, "perSection")
  const group = details.group ?? details.manualGroup ?? "A"
  const responses = details.responses ?? {}
  const cfg = (ELEC_RULES as Record<string, Record<string, boolean>>)[group] || {}
  const tagActive = (tag?: string) => (!tag ? true : cfg[tag] !== false)
  const stats = scoreElec(details).sectionStats
  const sections0 = (ELEC_DB as any[]).filter((s) => s.id !== "renew")

  const sections: ChecklistReportSection[] = sections0.map((section, sIdx) => {
    const rows: ChecklistReportRow[] = []
    section.cats.forEach((cat: any, cIdx: number) => {
      const visit = (items: any[], prefix: string | null = null) => {
        items.forEach((item, itemIdx) => {
          const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
          const id = rowId(sIdx, cIdx, suffix)
          if (!tagActive(item.tag)) return
          const state = responses[id] || {}
          rows.push({
            label: label(item.char, item.text),
            category: cat.name,
            ...elecAnswer(item, state),
            pass: elecRowPass(item, state),
          })
        })
      }
      visit(cat.items || [])
      ;(cat.subGroups || []).forEach((sg: any, subIdx: number) => visit(sg.items || [], `sub${subIdx}`))
    })
    const s = stats[section.id]
    return {
      title: section.title,
      max: s.max,
      score: s.score,
      pass: s.score === s.max,
      activeCount: s.count,
      passedCount: rows.filter((r) => r.pass).length,
      rows,
    }
  })

  const result = scoreElec(details)
  return {
    empty: false,
    totalScore: result.score,
    maxScore: result.maxScore,
    allPassed: result.score === result.maxScore,
    buildingGroup: group,
    scoreMode: "perSection",
    sections,
  }
}

// ---------------------------------------------------------------- monitoring ----

export function buildMonitoringReport(details: MonitoringInput | null | undefined): ChecklistReport {
  if (!details) return emptyChecklist(120, "allOrNothing")
  const toggles = details.toggles ?? {}
  const responses = details.responses ?? {}
  const result = scoreMonitoring(details)

  const sections: ChecklistReportSection[] = (MONITORING_SECTIONS as any[])
    .filter((section) => section.alwaysActive || toggles[section.key])
    .map((section) => {
      const rows: ChecklistReportRow[] = section.items.map((item: any, idx: number) => {
        const ans = responses[`${section.key}_${idx}`]
        return { label: label(item.alpha, item.text), ...boolAnswer(ans), pass: ans === "y" }
      })
      return {
        title: section.title,
        max: null,
        score: null,
        pass: rows.every((r) => r.pass),
        activeCount: rows.length,
        passedCount: rows.filter((r) => r.pass).length,
        rows,
      }
    })

  return {
    empty: false,
    totalScore: result.score,
    maxScore: result.maxScore,
    allPassed: result.allPassed,
    buildingGroup: null,
    scoreMode: "allOrNothing",
    sections,
  }
}

// ------------------------------------------------------------ integrated mgmt ----

export function buildIntegratedReport(details: IntegratedInput | null | undefined): ChecklistReport {
  if (!details) return emptyChecklist(77, "allOrNothing")
  const responses = details.responses ?? {}
  const result = scoreIntegrated(details)

  if (!details.logicActive) {
    return {
      empty: false,
      totalScore: result.score,
      maxScore: result.maxScore,
      allPassed: true,
      buildingGroup: null,
      scoreMode: "allOrNothing",
      sections: [
        {
          title: "مدیریت یکپارچه ساختمان",
          max: null,
          score: null,
          pass: true,
          activeCount: 0,
          passedCount: 0,
          rows: [],
          note: "سامانه مدیریت یکپارچه برای این پروژه الزامی نیست؛ امتیاز کامل لحاظ می‌شود.",
        },
      ],
    }
  }

  const rows: ChecklistReportRow[] = (INTEGRATED_ITEMS as any[]).map((item, idx) => {
    const ans = responses[`row_${idx}`]
    return { label: label(item.alpha, item.text), category: item.target, ...boolAnswer(ans), pass: ans === "y" }
  })

  return {
    empty: false,
    totalScore: result.score,
    maxScore: result.maxScore,
    allPassed: result.allPassed,
    buildingGroup: null,
    scoreMode: "allOrNothing",
    sections: [
      {
        title: "مدیریت یکپارچه ساختمان",
        max: null,
        score: null,
        pass: result.allPassed,
        activeCount: rows.length,
        passedCount: rows.filter((r) => r.pass).length,
        rows,
      },
    ],
  }
}

function emptyChecklist(maxScore: number, scoreMode: ChecklistReport["scoreMode"]): ChecklistReport {
  return { empty: true, totalScore: 0, maxScore, allPassed: false, buildingGroup: null, scoreMode, sections: [] }
}
