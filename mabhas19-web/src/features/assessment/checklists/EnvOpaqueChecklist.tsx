"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge, Card, CardBody, CardHeader, Input, Select, cn } from "@/components/ui"
import { ENV_OPAQUE_DB, ENV_OPAQUE_PRESETS } from "../data/envOpaqueDb"
import { getOpaqueTargetR, OPAQUE_TARGET_LABELS } from "../data/climate"
import { calcBuildingGroup } from "../data/utils"
import type { ToolResult } from "../data/sections"
import { genId, toNum, type ChecklistProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const TARGET_KEYS = Object.keys(OPAQUE_TARGET_LABELS)
const TOOL_KEY = "env_opaque.html" as const
const TOOL_MAX_SCORE = 105

const DB = ENV_OPAQUE_DB as Record<string, { label: string; items: any[] }>
const PRESETS = ENV_OPAQUE_PRESETS as Record<string, { layers: any[] }>

interface Layer {
  id: string
  categoryKey: string
  materialIndex: number
  materialName: string
  manufacturer: string
  thickness: number | null
  density: string
  lambda: number | null
  rValue: number
  standard: string
  fixedThickness: boolean
}

interface Analysis {
  id: string
  targetKey: string
  layers: Layer[]
}

interface BridgeState {
  south: number | null
  north: number | null
  east: number | null
  west: number | null
  mitigation: boolean
}

interface ShadingState {
  q1: string | null
  q2: string | null
}

const createLayer = (): Layer => ({
  id: genId(),
  categoryKey: "",
  materialIndex: -1,
  materialName: "",
  manufacturer: "",
  thickness: null,
  density: "",
  lambda: null,
  rValue: 0,
  standard: "",
  fixedThickness: false,
})

const createAnalysis = (targetKey: string): Analysis => ({
  id: genId(),
  targetKey,
  layers: [createLayer()],
})

export default function EnvOpaqueChecklist({ meta, climateCode, initial, onResult }: ChecklistProps) {
  const selectedClimate = climateCode

  const init = initial as
    | { analyses?: Analysis[]; bridge?: BridgeState; shading?: ShadingState }
    | undefined

  const [analyses, setAnalyses] = useState<Analysis[]>(
    () => init?.analyses && init.analyses.length > 0 ? init.analyses : [createAnalysis("wall_ext_open")]
  )
  const [bridge, setBridge] = useState<BridgeState>(
    () => init?.bridge ?? { south: null, north: null, east: null, west: null, mitigation: false }
  )
  const [shading, setShading] = useState<ShadingState>(() => init?.shading ?? { q1: null, q2: null })

  const buildingGroup = useMemo(
    () =>
      calcBuildingGroup({
        area: meta.totalArea,
        floors: meta.floorCount,
        units: meta.unitCount,
      }),
    [meta]
  )

  const analysisStats = useMemo(() => {
    return analyses.map((analysis) => {
      const requiredR = getOpaqueTargetR(analysis.targetKey, selectedClimate)
      const totalR = analysis.layers.reduce((sum, layer) => sum + toNum(layer.rValue), 0)
      const pass = totalR > requiredR
      return { ...analysis, requiredR, totalR, pass }
    })
  }, [analyses, selectedClimate])

  const envelopePass = useMemo(() => {
    if (analysisStats.length === 0) return false
    return analysisStats.every((item) => item.pass)
  }, [analysisStats])

  const bridgePass = useMemo(() => {
    const values = [bridge.south, bridge.north, bridge.east, bridge.west]
    if (values.some((v) => v === null || v === undefined || (v as unknown) === "")) {
      return false
    }
    const numericValues = values.map(toNum)
    const highBridge = numericValues.some((v) => v > 5)
    if (!highBridge) return true
    return bridge.mitigation
  }, [bridge])

  const insulationScore = envelopePass && bridgePass ? 90 : 0
  const shadingScore = shading.q1 === "yes" || shading.q2 === "yes" ? 15 : 0
  const totalScore = insulationScore + shadingScore

  useEffect(() => {
    const result: ToolResult = {
      toolKey: TOOL_KEY,
      score: totalScore,
      maxScore: TOOL_MAX_SCORE,
      details: { analyses, bridge, shading, envelopePass, bridgePass },
    }
    onResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalScore, envelopePass, bridgePass, analyses, bridge, shading])

  const updateAnalysis = (analysisId: string, updater: (a: Analysis) => Analysis) => {
    setAnalyses((prev) => prev.map((a) => (a.id !== analysisId ? a : updater(a))))
  }

  const updateLayer = (analysisId: string, layerId: string, updater: (l: Layer) => Layer) => {
    updateAnalysis(analysisId, (analysis) => ({
      ...analysis,
      layers: analysis.layers.map((layer) => (layer.id !== layerId ? layer : updater(layer))),
    }))
  }

  const getMaterialItem = (categoryKey: string, materialIndex: number): any => {
    if (!categoryKey || materialIndex < 0 || !DB[categoryKey]) return null
    return DB[categoryKey].items[materialIndex] || null
  }

  const recalcLayerR = (layer: Layer): number => {
    if (toNum(layer.lambda) > 0 && toNum(layer.thickness) > 0) {
      return Number((toNum(layer.thickness) / 1000 / toNum(layer.lambda)).toFixed(3))
    }
    return toNum(layer.rValue)
  }

  const onCategoryChange = (analysisId: string, layerId: string, categoryKey: string) => {
    updateLayer(analysisId, layerId, (layer) => ({
      ...layer,
      categoryKey,
      materialIndex: -1,
      materialName: "",
      thickness: null,
      density: "",
      lambda: null,
      rValue: 0,
      standard: "",
      fixedThickness: false,
    }))
  }

  const onMaterialChange = (analysisId: string, layerId: string, materialIndex: number) => {
    updateLayer(analysisId, layerId, (layer) => {
      const material = getMaterialItem(layer.categoryKey, materialIndex)
      if (!material) return layer

      if (material.r !== undefined && material.r !== null) {
        return {
          ...layer,
          materialIndex,
          materialName: material.n,
          density: material.d || "",
          lambda: null,
          thickness: material.t || layer.thickness,
          rValue: Number(material.r),
          standard: material.std || "",
          fixedThickness: Boolean(material.t),
        }
      }

      const thickness = layer.thickness || material.t || null
      const lambda = toNum(material.l)
      const computedR =
        lambda > 0 && toNum(thickness) > 0
          ? Number((toNum(thickness) / 1000 / lambda).toFixed(3))
          : 0

      return {
        ...layer,
        materialIndex,
        materialName: material.n,
        density: material.d || "",
        lambda,
        thickness,
        rValue: computedR,
        standard: material.std || "",
        fixedThickness: false,
      }
    })
  }

  const onThicknessChange = (analysisId: string, layerId: string, thicknessValue: number | null) => {
    updateLayer(analysisId, layerId, (layer) => {
      const nextLayer = { ...layer, thickness: thicknessValue }
      return { ...nextLayer, rValue: recalcLayerR(nextLayer) }
    })
  }

  const addLayer = (analysisId: string) => {
    updateAnalysis(analysisId, (analysis) => ({
      ...analysis,
      layers: [...analysis.layers, createLayer()],
    }))
  }

  const removeLayer = (analysisId: string, layerId: string) => {
    updateAnalysis(analysisId, (analysis) => {
      const nextLayers = analysis.layers.filter((layer) => layer.id !== layerId)
      return { ...analysis, layers: nextLayers.length > 0 ? nextLayers : [createLayer()] }
    })
  }

  const addAnalysis = () => {
    setAnalyses((prev) => [...prev, createAnalysis("wall_ext_open")])
  }

  const removeAnalysis = (analysisId: string) => {
    setAnalyses((prev) => {
      const next = prev.filter((item) => item.id !== analysisId)
      return next.length > 0 ? next : [createAnalysis("wall_ext_open")]
    })
  }

  const applyPreset = (analysisId: string, presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (!preset) return
    updateAnalysis(analysisId, (analysis) => ({
      ...analysis,
      targetKey: presetKey,
      layers: preset.layers.map((item: any) => {
        const material = getMaterialItem(item.c, item.i)
        const isFixed = material?.r !== undefined && material?.r !== null
        const lambda = isFixed ? null : toNum(material?.l)
        const thickness = item.t || material?.t || null
        const rValue = isFixed
          ? Number(material.r)
          : toNum(lambda) > 0 && toNum(thickness) > 0
            ? Number((toNum(thickness) / 1000 / toNum(lambda)).toFixed(3))
            : 0
        return {
          id: genId(),
          categoryKey: item.c,
          materialIndex: item.i,
          materialName: material?.n || item.n || "",
          manufacturer: "",
          thickness,
          density: material?.d || "",
          lambda,
          rValue,
          standard: material?.std || "",
          fixedThickness: Boolean(isFixed && material?.t),
        }
      }),
    }))
  }

  const highBridge =
    toNum(bridge.south) > 5 ||
    toNum(bridge.north) > 5 ||
    toNum(bridge.east) > 5 ||
    toNum(bridge.west) > 5

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">گروه پیشنهادی: {buildingGroup.label}</Badge>
            <Badge tone="brand">اقلیم فعال: {selectedClimate}</Badge>
            <Badge tone="slate">متراژ: {meta.totalArea} m²</Badge>
            <Badge tone="slate">طبقات: {meta.floorCount}</Badge>
            <Badge tone="slate">واحد: {meta.unitCount}</Badge>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800">جداره‌های غیرنورگذر</span>
        <button
          type="button"
          onClick={addAnalysis}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          افزودن جداره
        </button>
      </div>

      {analysisStats.map((analysis, idx) => (
        <Card key={analysis.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">جداره {idx + 1}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(analysis.id, analysis.targetKey)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  بارگذاری پیش‌فرض
                </button>
                <button
                  type="button"
                  onClick={() => removeAnalysis(analysis.id)}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                >
                  حذف
                </button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-1 block text-xs text-slate-500">نوع جداره</label>
                <Select
                  value={analysis.targetKey}
                  onChange={(e) =>
                    updateAnalysis(analysis.id, (old) => ({ ...old, targetKey: e.target.value }))
                  }
                >
                  {TARGET_KEYS.map((targetKey) => (
                    <option key={targetKey} value={targetKey}>
                      {OPAQUE_TARGET_LABELS[targetKey]} (R&gt;
                      {getOpaqueTargetR(targetKey, selectedClimate)})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="text-xs text-slate-500">R موردنیاز</div>
                <div className="text-lg font-semibold">{analysis.requiredR.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">R محاسبه‌شده</div>
                <div className="text-lg font-semibold">{analysis.totalR.toFixed(3)}</div>
              </div>
            </div>

            <div className="m19-table-wrap">
              <table className="m19-table">
                <thead>
                  <tr>
                    <th>ردیف</th>
                    <th>دسته</th>
                    <th>مصالح</th>
                    <th>تولیدکننده</th>
                    <th>ضخامت (mm)</th>
                    <th>چگالی</th>
                    <th>λ</th>
                    <th>R</th>
                    <th>استاندارد</th>
                    <th>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.layers.map((layer, layerIndex) => {
                    const materials = layer.categoryKey ? DB[layer.categoryKey]?.items || [] : []
                    return (
                      <tr key={layer.id}>
                        <td>{layerIndex + 1}</td>
                        <td>
                          <Select
                            className="min-w-40"
                            value={layer.categoryKey}
                            onChange={(e) => onCategoryChange(analysis.id, layer.id, e.target.value)}
                          >
                            <option value="">—</option>
                            {Object.keys(DB).map((key) => (
                              <option key={key} value={key}>
                                {DB[key].label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            className="min-w-52"
                            value={layer.materialIndex >= 0 ? String(layer.materialIndex) : ""}
                            disabled={!layer.categoryKey}
                            onChange={(e) =>
                              onMaterialChange(analysis.id, layer.id, Number(e.target.value))
                            }
                          >
                            <option value="">—</option>
                            {materials.map((material: any, mIdx: number) => (
                              <option key={mIdx} value={mIdx}>
                                {material.n}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Input
                            value={layer.manufacturer}
                            onChange={(e) =>
                              updateLayer(analysis.id, layer.id, (old) => ({
                                ...old,
                                manufacturer: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            className="w-24"
                            disabled={layer.fixedThickness}
                            value={layer.thickness ?? ""}
                            onChange={(e) =>
                              onThicknessChange(
                                analysis.id,
                                layer.id,
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td>{layer.density || "-"}</td>
                        <td>{layer.lambda ? layer.lambda.toFixed(3) : "-"}</td>
                        <td>{toNum(layer.rValue).toFixed(3)}</td>
                        <td>{layer.standard || "-"}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLayer(analysis.id, layer.id)}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => addLayer(analysis.id)}
              className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              افزودن لایه
            </button>
            <div className="mt-3">
              <span className={cn(analysis.pass ? "text-emerald-700" : "text-red-600", "text-sm font-medium")}>
                {analysis.pass ? "تایید: R > Rmin" : "عدم تایید: R ≤ Rmin"}
              </span>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <span className="font-medium">پل حرارتی و سایه‌اندازی</span>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["south", "پل حرارتی جنوب"],
                ["north", "شمال"],
                ["east", "شرق"],
                ["west", "غرب"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-slate-500">{label}</label>
                <Input
                  type="number"
                  value={bridge[key] ?? ""}
                  onChange={(e) =>
                    setBridge((prev) => ({
                      ...prev,
                      [key]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">سوال سایه‌انداز ۱:</span>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="shading-q1"
                  checked={shading.q1 === "yes"}
                  onChange={() => setShading((prev) => ({ ...prev, q1: "yes" }))}
                />
                بله
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="shading-q1"
                  checked={shading.q1 === "no"}
                  onChange={() => setShading((prev) => ({ ...prev, q1: "no" }))}
                />
                خیر
              </label>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">سوال سایه‌انداز ۲:</span>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="shading-q2"
                  checked={shading.q2 === "yes"}
                  onChange={() => setShading((prev) => ({ ...prev, q2: "yes" }))}
                />
                بله
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="shading-q2"
                  checked={shading.q2 === "no"}
                  onChange={() => setShading((prev) => ({ ...prev, q2: "no" }))}
                />
                خیر
              </label>
            </div>
          </div>

          {highBridge ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>پل حرارتی بیش از ۵ شناسایی شد. انتخاب تمهیدات کاهش پل حرارتی الزامی است.</p>
              <div className="mt-2 flex items-center gap-4">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="bridge-mit"
                    checked={bridge.mitigation === true}
                    onChange={() => setBridge((prev) => ({ ...prev, mitigation: true }))}
                  />
                  تمهیدات انجام شد
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="bridge-mit"
                    checked={bridge.mitigation === false}
                    onChange={() => setBridge((prev) => ({ ...prev, mitigation: false }))}
                  />
                  انجام نشد
                </label>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">امتیاز عایق‌کاری</div>
            <div className="text-2xl font-bold">{insulationScore} / 90</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">امتیاز سایه‌اندازی</div>
            <div className="text-2xl font-bold">{shadingScore} / 15</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-slate-500">امتیاز نهایی بخش</div>
            <div className="text-2xl font-bold text-brand-700">{totalScore} / 105</div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
