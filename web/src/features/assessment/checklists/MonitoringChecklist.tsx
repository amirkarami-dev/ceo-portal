"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge, Card, CardBody, CardHeader } from "@/components/ui"
import { MONITORING_SECTIONS, MONITORING_TOOL_MAX_SCORE } from "../data/monitoringDb"
import { toPersianDigits } from "../data/utils"
import type { ToolResult } from "../data/sections"
import { type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TOOL_KEY = "monitoring_checklist.html" as const
const SECTIONS = MONITORING_SECTIONS as any[]

type Toggles = { central: boolean; green: boolean; small: boolean; [k: string]: boolean }
type Responses = Record<string, string>

export default function MonitoringChecklist({ meta, climateCode, initial, onResult }: ChecklistProps) {
  const init = initial as { toggles?: Toggles; responses?: Responses } | undefined

  const [toggles, setToggles] = useState<Toggles>(
    init?.toggles ?? { central: false, green: false, small: false }
  )
  const [responses, setResponses] = useState<Responses>(init?.responses ?? {})

  const sectionStates = useMemo(() => {
    return SECTIONS.map((section) => ({
      ...section,
      isActive: section.alwaysActive || toggles[section.key],
    }))
  }, [toggles])

  const scoreState = useMemo(() => {
    let allPassed = true
    let activeRows = 0
    let passedRows = 0

    sectionStates.forEach((section) => {
      if (!section.isActive) return
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
      activeRows,
      passedRows,
      allPassed,
      totalScore: allPassed ? MONITORING_TOOL_MAX_SCORE : 0,
    }
  }, [responses, sectionStates])

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: scoreState.totalScore,
      maxScore: MONITORING_TOOL_MAX_SCORE,
      details: {
        toggles,
        responses,
        activeRows: scoreState.activeRows,
        passedRows: scoreState.passedRows,
        allPassed: scoreState.allPassed,
      },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    toggles,
    responses,
    scoreState.activeRows,
    scoreState.passedRows,
    scoreState.allPassed,
    scoreState.totalScore,
  ])

  const setResponse = (sectionKey: string, itemIdx: number, value: string) => {
    const id = `${sectionKey}_${itemIdx}`
    setResponses((prev) => ({ ...prev, [id]: value }))
  }

  const onToggle = (sectionKey: string, checked: boolean) => {
    setToggles((prev) => ({ ...prev, [sectionKey]: checked }))
    if (!checked) {
      setResponses((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${sectionKey}_`)))
      )
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="slate">شهر: {meta.city || "-"}</Badge>
            <Badge tone="brand">اقلیم: {climateCode || "-"}</Badge>
            <Badge tone="slate">متراژ: {meta.totalArea} m²</Badge>
            {SECTIONS.filter((section) => !section.alwaysActive).map((section) => (
              <label key={section.key} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(toggles[section.key])}
                  onChange={(e) => onToggle(section.key, e.target.checked)}
                />
                {section.toggleLabel}
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">
            امتیازات تمامی قسمتهای بخش پایش و زیر پایش به صورت شرط لازم دیده شده است و امتیاز کل تنها در صورت
            رعایت تمامی موارد دریافت خواهد شد.
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">سوالات فعال</div>
            <div className="text-2xl font-bold">{toPersianDigits(scoreState.activeRows)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">پاسخ‌های تایید شده</div>
            <div className="text-2xl font-bold">{toPersianDigits(scoreState.passedRows)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">امتیاز پایش</div>
            <div className="text-2xl font-bold text-brand-700">
              {scoreState.totalScore} / {MONITORING_TOOL_MAX_SCORE}
            </div>
          </CardBody>
        </Card>
      </div>

      {sectionStates.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <span className="font-medium">{section.title}</span>
          </CardHeader>
          <CardBody>
            {!section.isActive && (
              <div className="mb-2">
                <Badge tone="slate">این بخش غیرفعال است</Badge>
              </div>
            )}
            <div className="m19-table-wrap">
              <table className="m19-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ردیف</th>
                    <th>شرح شرط</th>
                    <th style={{ width: 220 }}>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item: any, itemIdx: number) => {
                    const id = `${section.key}_${itemIdx}`
                    return (
                      <tr key={id} className={!section.isActive ? "m19-row-disabled" : ""}>
                        <td>{toPersianDigits(itemIdx + 1)}</td>
                        <td>
                          <span className="font-semibold text-brand-700">{item.alpha}</span> {item.text}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={id}
                                disabled={!section.isActive}
                                checked={responses[id] === "y"}
                                onChange={() => setResponse(section.key, itemIdx, "y")}
                              />
                              بله
                            </label>
                            <label className="flex items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={id}
                                disabled={!section.isActive}
                                checked={responses[id] === "n"}
                                onChange={() => setResponse(section.key, itemIdx, "n")}
                              />
                              خیر
                            </label>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">{section.footer}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
