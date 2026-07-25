"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Badge, Card, CardBody, CardHeader, Input, Select } from "@/components/ui"
import { ELEC_DB, ELEC_RULES } from "../data/elecDb"
import { calcBuildingGroup, GROUP_LABELS } from "../data/utils"
import type { GroupCode } from "../data/utils"
import type { ToolResult } from "../data/sections"
import { type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TOOL_KEY = "elec_checklist.html" as const
const TOOL_MAX_SCORE = 196
const DB = ELEC_DB as any[]
const RULES = ELEC_RULES as Record<string, Record<string, boolean>>
const GROUP_OPTIONS = (Object.keys(GROUP_LABELS) as GroupCode[]).map((code) => ({
  label: GROUP_LABELS[code],
  value: code,
}))
const ELECTRIC_SECTIONS = DB.filter((section) => section.id !== "renew")

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

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`

const getTableTemplate = (type: string) => {
  if (type === "tb_dla") return TB_DLA_ROWS
  if (type === "tb_u") return TB_U_ROWS
  return []
}

type TableEntry = { checked: boolean; value: number | null }
type RowState = { radio?: string; number?: number | null; table?: TableEntry[] }
type Responses = Record<string, RowState>

export default function ElecChecklist({ meta, initial, onResult }: ChecklistProps) {
  const init = initial as { responses?: Responses; manualGroup?: string | null } | undefined

  const [manualGroup, setManualGroup] = useState<string | null>(init?.manualGroup ?? null)
  const [responses, setResponses] = useState<Responses>(init?.responses ?? {})

  const autoGroup = useMemo(
    () => calcBuildingGroup({ area: meta.totalArea, floors: meta.floorCount, units: meta.unitCount }),
    [meta]
  )
  const currentGroup = manualGroup || autoGroup.code

  const isTagActive = (tag?: string) => {
    const cfg = RULES[currentGroup] || {}
    if (!tag) return true
    if (cfg[tag] === false) return false
    return true
  }

  const setResponse = (id: string, patch: RowState) => {
    setResponses((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))
  }

  const scoreState = useMemo(() => {
    const sectionStats: Record<string, { max: number; count: number; ok: boolean; score: number }> = {}
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
        const renderItems = (items: any[], prefix: string | null = null) => {
          items.forEach((item, itemIdx) => {
            const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
            const id = rowId(sIdx, cIdx, suffix)
            if (!isTagActive(item.tag)) return
            sectionStats[section.id].count += 1
            const pass = evaluateRow(item, id)
            if (!pass) sectionStats[section.id].ok = false
          })
        }
        renderItems(cat.items || [])
        ;(cat.subGroups || []).forEach((subGroup: any, subIdx: number) => {
          renderItems(subGroup.items || [], `sub${subIdx}`)
        })
      })
    })

    Object.keys(sectionStats).forEach((sectionId) => {
      const section = sectionStats[sectionId]
      section.score = section.count > 0 && section.ok ? section.max : 0
    })

    const totalScore = Object.values(sectionStats).reduce((sum, item) => sum + item.score, 0)
    return { sectionStats, totalScore }
  }, [responses, currentGroup]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: scoreState.totalScore,
      maxScore: TOOL_MAX_SCORE,
      details: { group: currentGroup, responses, manualGroup },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreState.totalScore, currentGroup, responses, manualGroup])

  const renderTableInput = (item: any, id: string) => {
    const template = getTableTemplate(item.type)
    const state = responses[id] || {}
    const table = state.table || template.map(() => ({ checked: false, value: null as number | null }))

    return (
      <div className="flex flex-col gap-1.5">
        {template.map((row, idx) => (
          <div key={`${id}_inner_${idx}`} className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={table[idx].checked}
                onChange={(e) => {
                  const next = [...table]
                  next[idx] = {
                    ...next[idx],
                    checked: e.target.checked,
                    value: e.target.checked ? next[idx].value : null,
                  }
                  setResponse(id, { table: next })
                }}
              />
              {row.name} (حداقل {row.limit})
            </label>
            <Input
              type="number"
              className="w-24"
              disabled={!table[idx].checked}
              value={table[idx].value ?? ""}
              onChange={(e) => {
                const next = [...table]
                next[idx] = { ...next[idx], value: e.target.value === "" ? null : Number(e.target.value) }
                setResponse(id, { table: next })
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  const renderInput = (item: any, id: string) => {
    if (item.type === "bool") {
      return (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name={id} checked={responses[id]?.radio === "y"} onChange={() => setResponse(id, { radio: "y" })} />
            بله
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name={id} checked={responses[id]?.radio === "n"} onChange={() => setResponse(id, { radio: "n" })} />
            خیر
          </label>
        </div>
      )
    }
    if (item.type === "num") {
      return (
        <div className="flex flex-col gap-0.5">
          <Input
            type="number"
            value={responses[id]?.number ?? ""}
            onChange={(e) => setResponse(id, { number: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <span className="text-xs text-slate-500">
            {item.v?.min !== undefined ? `Min:${item.v.min} ` : ""}
            {item.v?.max !== undefined ? `Max:${item.v.max}` : ""} {item.unit || ""}
          </span>
        </div>
      )
    }
    if (item.type === "tb_dla" || item.type === "tb_u") {
      return renderTableInput(item, id)
    }
    return "-"
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="flex flex-wrap items-center gap-2 md:col-span-3">
              <Badge tone="slate">متراژ: {meta.totalArea} m²</Badge>
              <Badge tone="slate">طبقات: {meta.floorCount}</Badge>
              <Badge tone="slate">واحد: {meta.unitCount}</Badge>
              <Badge tone="brand">گروه خودکار: {GROUP_LABELS[autoGroup.code]}</Badge>
              <Badge tone="brand">گروه فعال: {GROUP_LABELS[currentGroup as GroupCode]}</Badge>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">گروه دستی (اختیاری)</label>
              <Select value={manualGroup ?? ""} onChange={(e) => setManualGroup(e.target.value || null)}>
                <option value="">خودکار</option>
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ELECTRIC_SECTIONS.map((section) => {
          const stat = scoreState.sectionStats[section.id]
          return (
            <Card key={section.id}>
              <CardBody>
                <div className="text-xs text-slate-500">{section.title}</div>
                <div className="text-lg font-bold">
                  {stat?.score || 0} / {section.max}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardBody>
          <div className="text-xs text-slate-500">امتیاز کل بخش برق</div>
          <div className="text-2xl font-bold text-brand-700">{scoreState.totalScore} / 196</div>
        </CardBody>
      </Card>

      {ELECTRIC_SECTIONS.map((section, sIdx) => (
        <Card key={section.id}>
          <CardHeader>
            <span className="font-medium">{section.title}</span>
          </CardHeader>
          <CardBody>
            <p className="mb-2 text-xs text-slate-500">{section.intro}</p>
            {section.cats.map((cat: any, cIdx: number) => (
              <div key={`${section.id}_${cat.name}`} className="mb-4">
                <div className="mb-2 border-b border-slate-200 pb-1 text-sm font-medium text-slate-700">
                  {cat.name}
                </div>
                <div className="m19-table-wrap">
                  <table className="m19-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>ردیف</th>
                        <th>شرح</th>
                        <th style={{ width: 360 }}>وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cat.items || []).map((item: any, itemIdx: number) => {
                        const id = rowId(sIdx, cIdx, itemIdx)
                        const active = isTagActive(item.tag)
                        return (
                          <tr key={id} className={!active ? "m19-row-disabled" : ""}>
                            <td>{item.char}</td>
                            <td>{item.text}</td>
                            <td>{renderInput(item, id)}</td>
                          </tr>
                        )
                      })}
                      {(cat.subGroups || []).map((subGroup: any, subIdx: number) => (
                        <Fragment key={`${section.id}_${cat.name}_sub${subIdx}`}>
                          <tr className="m19-sub-header">
                            <td colSpan={3}>{subGroup.label}</td>
                          </tr>
                          {(subGroup.items || []).map((item: any, itemIdx: number) => {
                            const id = rowId(sIdx, cIdx, `sub${subIdx}_${itemIdx}`)
                            const active = isTagActive(item.tag)
                            return (
                              <tr key={id} className={!active ? "m19-row-disabled" : ""}>
                                <td>{item.char}</td>
                                <td>{item.text}</td>
                                <td>{renderInput(item, id)}</td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-500">{cat.footer}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
