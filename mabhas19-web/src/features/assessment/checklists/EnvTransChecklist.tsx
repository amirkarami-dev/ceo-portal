"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardBody, CardHeader, Input, Select, cn } from "@/components/ui"
import {
  ENV_TRANS_GAS_DB,
  ENV_TRANS_GLASS_DB,
  ENV_TRANS_PRESETS,
  ENV_TRANS_PROFILE_DB,
} from "../data/envTransDb"
import { getTransShgcLimit, TRANS_U_LIMIT_BY_TYPE } from "../data/climate"
import type { ToolResult } from "../data/sections"
import { genId, type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TOOL_KEY = "env_trans.html" as const
const TOOL_MAX_SCORE = 93

const GLASS = ENV_TRANS_GLASS_DB as any[]
const GAS = ENV_TRANS_GAS_DB as any[]
const PROFILE = ENV_TRANS_PROFILE_DB as any[]
const PRESETS = ENV_TRANS_PRESETS as Record<string, any>

const PRESET_OPTIONS = Object.keys(PRESETS).map((key) => ({
  label: PRESETS[key].title,
  value: key,
}))

interface WindowItem {
  id: string
  presetKey: string
  name: string
  type: string
  profileIdx: number
  l1Idx: number
  l2Idx: number
  l3Idx: number
  l1Th: number
  l2Th: number
  l3Th: number
  shgc: number | null
  vlt: number | null
  pf: number | null
}

const calcLayerR = (lambda: unknown, thickness: unknown): number => {
  const lam = Number(lambda)
  const th = Number(thickness)
  if (!Number.isFinite(lam) || lam <= 0 || !Number.isFinite(th) || th <= 0) return 0
  return Number((th / 1000 / lam).toFixed(3))
}

const calcWindowU = (windowItem: WindowItem) => {
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
  return { r1, r2, r3, uTotal: Number(uTotal.toFixed(2)) }
}

const createWindowFromPreset = (presetKey: string): WindowItem => {
  const preset = PRESETS[presetKey] || PRESETS.fixed_window
  return {
    id: genId(),
    presetKey,
    name: preset.title,
    type: preset.type,
    profileIdx: preset.f_idx,
    l1Idx: preset.l1_idx,
    l2Idx: preset.l2_idx,
    l3Idx: preset.l3_idx,
    l1Th: 6,
    l2Th: 12,
    l3Th: 4,
    shgc: preset.shgc,
    vlt: preset.vlt,
    pf: null,
  }
}

export default function EnvTransChecklist({ climateCode, initial, onResult }: ChecklistProps) {
  const selectedClimate = climateCode
  const init = initial as { windows?: WindowItem[] } | undefined

  const [windows, setWindows] = useState<WindowItem[]>(
    () => (init?.windows && init.windows.length > 0 ? init.windows : [createWindowFromPreset("fixed_window")])
  )

  const enrichedWindows = useMemo(() => {
    return windows.map((windowItem) => {
      const uData = calcWindowU(windowItem)
      const uLimit = TRANS_U_LIMIT_BY_TYPE[windowItem.type] || TRANS_U_LIMIT_BY_TYPE.fixed
      const pfValue = Number(windowItem.pf) || 0
      const shgcLimit = getTransShgcLimit(selectedClimate, pfValue)
      const shgcValue = Number(windowItem.shgc)
      const uPass = uData.uTotal > 0 && uData.uTotal <= uLimit
      const shgcPass = Number.isFinite(shgcValue) && shgcValue <= shgcLimit
      return { ...windowItem, ...uData, uLimit, shgcLimit, uPass, shgcPass }
    })
  }, [windows, selectedClimate])

  const allPassed = useMemo(() => {
    if (enrichedWindows.length === 0) return false
    return enrichedWindows.every((item) => item.uPass && item.shgcPass)
  }, [enrichedWindows])

  const totalScore = allPassed ? TOOL_MAX_SCORE : 0

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: totalScore,
      maxScore: TOOL_MAX_SCORE,
      details: { windows, allPassed },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalScore, windows, allPassed])

  const updateWindow = (windowId: string, updater: (w: WindowItem) => WindowItem) => {
    setWindows((prev) => prev.map((item) => (item.id !== windowId ? item : updater(item))))
  }

  const addWindow = (presetKey: string) => {
    setWindows((prev) => [...prev, createWindowFromPreset(presetKey || "fixed_window")])
  }

  const removeWindow = (windowId: string) => {
    setWindows((prev) => {
      const next = prev.filter((item) => item.id !== windowId)
      return next.length > 0 ? next : [createWindowFromPreset("fixed_window")]
    })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">جداره‌های نورگذر</span>
        <div className="flex gap-2">
          <Select
            className="w-56"
            value=""
            onChange={(e) => {
              if (e.target.value) addWindow(e.target.value)
            }}
          >
            <option value="">پیش‌فرض...</option>
            {PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => addWindow("fixed_window")}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            افزودن جداره
          </button>
        </div>
      </div>

      {enrichedWindows.map((windowItem, idx) => (
        <Card key={windowItem.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">جداره نورگذر {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeWindow(windowItem.id)}
                className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
              >
                حذف
              </button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">نام/جهت</label>
                <Input
                  value={windowItem.name}
                  onChange={(e) => updateWindow(windowItem.id, (old) => ({ ...old, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">نوع جداره</label>
                <Select
                  value={windowItem.type}
                  onChange={(e) => updateWindow(windowItem.id, (old) => ({ ...old, type: e.target.value }))}
                >
                  <option value="fixed">پنجره ثابت</option>
                  <option value="operable">پنجره متحرک</option>
                  <option value="door">در نورگذر</option>
                  <option value="skylight">نورگیر سقفی</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">نوع پروفیل</label>
                <Select
                  value={windowItem.profileIdx}
                  onChange={(e) =>
                    updateWindow(windowItem.id, (old) => ({ ...old, profileIdx: Number(e.target.value) }))
                  }
                >
                  {PROFILE.map((profile: any, profileIdx: number) => (
                    <option key={profileIdx} value={profileIdx}>
                      {profile.n} | Uf={profile.u_f}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                [
                  ["لایه اول شیشه", "l1Idx", "l1Th", "r1", GLASS],
                  ["لایه میانی (گاز)", "l2Idx", "l2Th", "r2", GAS],
                  ["لایه دوم شیشه", "l3Idx", "l3Th", "r3", GLASS],
                ] as const
              ).map(([title, idxKey, thKey, rKey, db]) => (
                <Card key={idxKey}>
                  <CardBody>
                    <div className="mb-2 text-sm font-medium">{title}</div>
                    <Select
                      value={windowItem[idxKey] as number}
                      onChange={(e) =>
                        updateWindow(windowItem.id, (old) => ({ ...old, [idxKey]: Number(e.target.value) }))
                      }
                    >
                      {db.map((item: any, itemIdx: number) => (
                        <option key={itemIdx} value={itemIdx}>
                          {item.n}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      className="mt-2"
                      value={(windowItem[thKey] as number) ?? ""}
                      onChange={(e) =>
                        updateWindow(windowItem.id, (old) => ({
                          ...old,
                          [thKey]: e.target.value === "" ? 0 : Number(e.target.value),
                        }))
                      }
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {rKey.toUpperCase()}: {(windowItem[rKey] as number).toFixed(3)}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">SHGC</label>
                <Input
                  type="number"
                  step="0.01"
                  value={windowItem.shgc ?? ""}
                  onChange={(e) =>
                    updateWindow(windowItem.id, (old) => ({
                      ...old,
                      shgc: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">VLT (%)</label>
                <Input
                  type="number"
                  value={windowItem.vlt ?? ""}
                  onChange={(e) =>
                    updateWindow(windowItem.id, (old) => ({
                      ...old,
                      vlt: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">PF (سایه‌بان)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={windowItem.pf ?? ""}
                  onChange={(e) =>
                    updateWindow(windowItem.id, (old) => ({
                      ...old,
                      pf: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className={cn(windowItem.uPass ? "text-emerald-700" : "text-red-600", "font-medium")}>
                U = {windowItem.uTotal.toFixed(2)} / حد: {windowItem.uLimit}
              </span>
              <span className={cn(windowItem.shgcPass ? "text-emerald-700" : "text-red-600", "font-medium")}>
                SHGC حد: {windowItem.shgcLimit}
              </span>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <span className="font-medium">خلاصه کنترل‌ها</span>
        </CardHeader>
        <CardBody>
          <div className="m19-table-wrap">
            <table className="m19-table">
              <thead>
                <tr>
                  <th>نام جداره</th>
                  <th>U (W/m².K)</th>
                  <th>SHGC</th>
                  <th>VLT</th>
                </tr>
              </thead>
              <tbody>
                {enrichedWindows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name || "جداره بدون نام"}</td>
                    <td>
                      {row.uTotal.toFixed(2)}{" "}
                      <span className={row.uPass ? "text-emerald-700" : "text-red-600"}>
                        {row.uPass ? `≤ ${row.uLimit}` : `> ${row.uLimit}`}
                      </span>
                    </td>
                    <td>
                      {row.shgc ?? "-"}{" "}
                      <span className={row.shgcPass ? "text-emerald-700" : "text-red-600"}>
                        {row.shgcPass ? `≤ ${row.shgcLimit}` : `> ${row.shgcLimit}`}
                      </span>
                    </td>
                    <td>{row.vlt || row.vlt === 0 ? `${row.vlt}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">تعداد جداره بررسی‌شده</div>
            <div className="text-2xl font-bold">{enrichedWindows.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">وضعیت کنترل</div>
            <div className="text-2xl font-bold">{allPassed ? "تایید" : "عدم تایید"}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">امتیاز نهایی بخش</div>
            <div className="text-2xl font-bold text-brand-700">{totalScore} / 93</div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
