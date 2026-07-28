"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Badge, Card, CardBody, CardHeader, Input, Select } from "@/components/ui"
import { MECH_DB } from "../data/mechDb"
import { calcBuildingGroup, getGroupIndex, GROUP_LABELS } from "../data/utils"
import type { GroupCode } from "../data/utils"
import type { ToolResult } from "../data/sections"
import { type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TOOL_KEY = "mech_checklist.html" as const
const TOOL_MAX_SCORE = 240
const DB = MECH_DB as any[]
const GROUP_OPTIONS = (Object.keys(GROUP_LABELS) as GroupCode[]).map((code) => ({
  label: GROUP_LABELS[code],
  value: code,
}))

const NON_CENTRAL_ROWS = [
  "s0_c1_0", "s0_c1_1", "s1_c2_0", "s1_c2_1", "s1_c2_2", "s1_c2_3", "s1_c2_4",
  "s1_c2_5", "s1_c2_6", "s1_c2_7", "s1_c2_8", "s1_c2_9", "s1_c2_10",
]
const CENTRAL_ROWS = [
  "s0_c2_0", "s0_c2_1", "s0_c2_2", "s0_c3_0", "s0_c3_1", "s1_c3_0",
  "s1_c3_1", "s1_c3_2", "s1_c3_3", "s1_c3_4", "s1_c3_5",
]

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`

type RowState = { radio?: string; number?: number | null; text?: string; eff?: string; rank?: string; selectValue?: string }
type Responses = Record<string, RowState>

export default function MechChecklist({ meta, initial, onResult }: ChecklistProps) {
  const init = initial as
    | { responses?: Responses; manualGroup?: string | null; logicOffRows?: string[] }
    | undefined

  const [manualGroup, setManualGroup] = useState<string | null>(init?.manualGroup ?? null)
  const [responses, setResponses] = useState<Responses>(init?.responses ?? {})
  const [logicOffRows, setLogicOffRows] = useState<Set<string>>(
    () => new Set(init?.logicOffRows ?? [])
  )

  const autoGroup = useMemo(
    () => calcBuildingGroup({ area: meta.totalArea, floors: meta.floorCount, units: meta.unitCount }),
    [meta]
  )

  const currentGroup = manualGroup || autoGroup.code

  const isRowGroupActive = (minGroup?: string) =>
    getGroupIndex(currentGroup) >= getGroupIndex(minGroup || "A")

  const isRowLogicActive = (id: string) => !logicOffRows.has(id)

  const getRowPass = (item: any, id: string): boolean => {
    const state = responses[id] || {}
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

  const scoreState = useMemo(() => {
    const sectionStats: Record<string, { max: number; count: number; passed: number; score: number }> = {}
    DB.forEach((section) => {
      sectionStats[section.id] = { max: section.max, count: 0, passed: 0, score: 0 }
    })

    DB.forEach((section, sIdx) => {
      section.cats.forEach((cat: any, cIdx: number) => {
        const renderItems = (items: any[], prefix: string | null = null) => {
          items.forEach((item, itemIdx) => {
            const suffix = prefix ? `${prefix}_${itemIdx}` : itemIdx
            const id = rowId(sIdx, cIdx, suffix)
            const active = isRowGroupActive(item.minG) && isRowLogicActive(id)
            if (!active) return
            sectionStats[section.id].count += 1
            if (getRowPass(item, id)) sectionStats[section.id].passed += 1
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
      if (section.count === 0) {
        section.score = section.max
      } else {
        section.score = section.count === section.passed ? section.max : 0
      }
    })

    const totalScore = Object.values(sectionStats).reduce((sum, item) => sum + item.score, 0)
    return { sectionStats, totalScore }
  }, [responses, currentGroup, logicOffRows]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: scoreState.totalScore,
      maxScore: TOOL_MAX_SCORE,
      details: { group: currentGroup, responses, manualGroup, logicOffRows: Array.from(logicOffRows) },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreState.totalScore, currentGroup, responses, manualGroup, logicOffRows])

  const setResponse = (id: string, patch: RowState) => {
    setResponses((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))
  }

  const handleSystemChange = (value: string) => {
    const nextLogicOff = new Set<string>()
    if (value === "غیر مرکزی") {
      CENTRAL_ROWS.forEach((id) => nextLogicOff.add(id))
    } else if (value === "مرکزی") {
      NON_CENTRAL_ROWS.forEach((id) => nextLogicOff.add(id))
    }
    setLogicOffRows(nextLogicOff)
  }

  const renderInput = (item: any, id: string) => {
    const state = responses[id] || {}
    if (item.type === "bool" || item.type === "bool_reverse") {
      return (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name={id} checked={state.radio === "y"} onChange={() => setResponse(id, { radio: "y" })} />
            بله
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name={id} checked={state.radio === "n"} onChange={() => setResponse(id, { radio: "n" })} />
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
            className="w-44"
            value={state.number ?? ""}
            onChange={(e) => setResponse(id, { number: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <span className="text-xs text-slate-500">
            {item.v?.min !== undefined ? `Min:${item.v.min} ` : ""}
            {item.v?.max !== undefined ? `Max:${item.v.max}` : ""} {item.unit || ""}
          </span>
        </div>
      )
    }
    if (item.type === "text") {
      return <Input value={state.text ?? ""} onChange={(e) => setResponse(id, { text: e.target.value })} />
    }
    if (item.type === "eff_pair") {
      return (
        <div className="flex flex-col gap-1.5">
          <Input placeholder="حداقل بازده" value={state.eff ?? ""} onChange={(e) => setResponse(id, { eff: e.target.value })} />
          <Input placeholder="رده انرژی" value={state.rank ?? ""} onChange={(e) => setResponse(id, { rank: e.target.value })} />
        </div>
      )
    }
    if (item.type === "custom_select") {
      return (
        <Select
          className="w-52"
          value={state.selectValue ?? ""}
          onChange={(e) => {
            setResponse(id, { selectValue: e.target.value })
            handleSystemChange(e.target.value)
          }}
        >
          <option value="">انتخاب...</option>
          {(item.opts || []).map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      )
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {DB.map((section) => {
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
          <div className="text-xs text-slate-500">امتیاز کل بخش مکانیک</div>
          <div className="text-2xl font-bold text-brand-700">{scoreState.totalScore} / 240</div>
        </CardBody>
      </Card>

      {DB.map((section, sIdx) => (
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
                        <th style={{ width: 280 }}>وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cat.items || []).map((item: any, itemIdx: number) => {
                        const id = rowId(sIdx, cIdx, itemIdx)
                        const isActive = isRowGroupActive(item.minG) && isRowLogicActive(id)
                        return (
                          <tr key={id} className={!isActive ? "m19-row-disabled" : ""}>
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
                            const isActive = isRowGroupActive(item.minG) && isRowLogicActive(id)
                            return (
                              <tr key={id} className={!isActive ? "m19-row-disabled" : ""}>
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
                <p className="mt-1 text-xs text-slate-500">{section.footer}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
