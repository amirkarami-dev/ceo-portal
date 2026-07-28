"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge, Card, CardBody, CardHeader, Select } from "@/components/ui"
import {
  getIntegratedAutoActivation,
  INTEGRATED_ITEMS,
  INTEGRATED_TOOL_MAX_SCORE,
  INTEGRATED_USAGE_OPTIONS,
  scoreIntegrated,
} from "../data/integratedDb"
import { toPersianDigits } from "../data/utils"
import type { ToolResult } from "../data/sections"
import { type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TOOL_KEY = "integrated_mgmt.html" as const
const ITEMS = INTEGRATED_ITEMS as any[]
const USAGE_OPTIONS = INTEGRATED_USAGE_OPTIONS as { value: string; label: string }[]

type Responses = Record<string, string>
type LogicMode = "manual_off" | "manual_on" | "auto_on" | "auto_off"

export default function IntegratedMgmtChecklist({ meta, climateCode, initial, onResult }: ChecklistProps) {
  const init = initial as
    | { usage?: string; responses?: Responses; logicActive?: boolean; logicMode?: LogicMode }
    | undefined

  const [usage, setUsage] = useState<string>(init?.usage ?? meta.usage ?? "")
  const [logicActive, setLogicActive] = useState<boolean>(init?.logicActive ?? false)
  const [logicMode, setLogicMode] = useState<LogicMode>(init?.logicMode ?? "manual_off")
  const [responses, setResponses] = useState<Responses>(init?.responses ?? {})

  const autoLogicActive = useMemo(
    () =>
      getIntegratedAutoActivation({
        usage,
        totalArea: meta.totalArea,
        floorCount: meta.floorCount,
      }),
    [usage, meta.totalArea, meta.floorCount]
  )

  useEffect(() => {
    // TODO: refactor to derived state (scoring-sensitive)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogicActive(autoLogicActive)
    setLogicMode(autoLogicActive ? "auto_on" : "auto_off")
  }, [autoLogicActive])

  useEffect(() => {
    // TODO: refactor to derived state (scoring-sensitive)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!logicActive) setResponses({})
  }, [logicActive])

  const scoreState = useMemo(() => {
    // Single source of truth: the tested pure scorer in @mabhas19/assessment-core,
    // instead of duplicating the math here.
    const r = scoreIntegrated({ logicActive, responses })
    return {
      activeRows: r.activeRows,
      passedRows: r.passedRows,
      allPassed: r.allPassed,
      totalScore: r.score,
    }
  }, [logicActive, responses])

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: scoreState.totalScore,
      maxScore: INTEGRATED_TOOL_MAX_SCORE,
      details: {
        usage,
        responses,
        logicActive,
        logicMode,
        autoLogicActive,
        activeRows: scoreState.activeRows,
        passedRows: scoreState.passedRows,
        allPassed: scoreState.allPassed,
      },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    usage,
    responses,
    logicActive,
    logicMode,
    autoLogicActive,
    scoreState.activeRows,
    scoreState.passedRows,
    scoreState.allPassed,
    scoreState.totalScore,
  ])

  const logicStatusTag =
    logicMode === "auto_on"
      ? "فعال (تشخیص خودکار)"
      : logicMode === "manual_on"
        ? "فعال (انتخاب دستی)"
        : logicMode === "manual_off"
          ? "غیرفعال (انتخاب دستی)"
          : "غیرفعال (تشخیص خودکار)"

  const toggleLogic = () => {
    const next = !logicActive
    setLogicActive(next)
    setLogicMode(next ? "manual_on" : "manual_off")
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">کاربری ساختمان</label>
              <Select value={usage} onChange={(e) => setUsage(e.target.value)}>
                <option value="">انتخاب کنید...</option>
                {USAGE_OPTIONS.map((o, i) => (
                  <option key={`${o.value}_${i}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">شهر: {meta.city || "-"}</Badge>
              <Badge tone="brand">اقلیم: {climateCode || "-"}</Badge>
              <Badge tone="slate">متراژ: {meta.totalArea} m²</Badge>
              <Badge tone="slate">طبقات: {meta.floorCount}</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={logicActive ? "green" : "slate"}>{logicStatusTag}</Badge>
            <button
              type="button"
              onClick={toggleLogic}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              {logicActive ? "غیرفعال‌سازی دستی" : "فعالسازی دستی"}
            </button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="text-sm text-slate-500">
            امتیازات تمامی قسمتهای مدیریت یکپارچه ساختمان به صورت شرط لازم دیده شده است و امتیاز کل تنها در صورت
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
            <div className="text-xs text-slate-500">امتیاز مدیریت یکپارچه</div>
            <div className="text-2xl font-bold text-brand-700">
              {scoreState.totalScore} / {INTEGRATED_TOOL_MAX_SCORE}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <span className="font-medium">جدول ارزیابی مدیریت یکپارچه ساختمان</span>
        </CardHeader>
        <CardBody>
          <div className="m19-table-wrap">
            <table className="m19-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ردیف</th>
                  <th>شرح سوال ارزیابی</th>
                  <th style={{ width: 220 }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {ITEMS.map((item, idx) => {
                  const id = `row_${idx}`
                  return (
                    <tr key={id} className={!logicActive ? "m19-row-disabled" : ""}>
                      <td>{toPersianDigits(idx + 1)}</td>
                      <td>
                        <span className="font-semibold text-brand-700">{item.alpha}</span> {item.text}
                        <br />
                        <span className="text-xs text-slate-500">{item.target}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name={id}
                              disabled={!logicActive}
                              checked={responses[id] === "y"}
                              onChange={() => setResponses((prev) => ({ ...prev, [id]: "y" }))}
                            />
                            بله
                          </label>
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name={id}
                              disabled={!logicActive}
                              checked={responses[id] === "n"}
                              onChange={() => setResponses((prev) => ({ ...prev, [id]: "n" }))}
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
          <p className="mt-1 text-xs text-slate-500">
            برای بندهای ۱ و ۲ این جدول مستندات نقشه ها و دیاگرامهای مربوطه بارگذاری شود. برای بند ۳ این جدول
            مستندات نقشه ها و صورتجلسات مربوطه بارگذاری شود.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
