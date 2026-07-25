import { useEffect } from "react"
import { Pressable, View } from "react-native"
import {
  ENV_OPAQUE_DB,
  ENV_OPAQUE_PRESETS,
  OPAQUE_TARGET_LABELS,
  getOpaqueTargetR,
  toNum,
} from "@mabhas19/assessment-core"
import { AppText, Badge, Button, Card, Checkbox, Field, Select } from "@/components/ui"
import { t } from "@/i18n"
import { colors, radius, spacing } from "@/theme"
import type { EditorProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const DB = ENV_OPAQUE_DB as Record<string, { label: string; items: any[] }>
const PRESETS = ENV_OPAQUE_PRESETS as Record<string, { layers: any[] }>
const TARGET_KEYS = Object.keys(OPAQUE_TARGET_LABELS)

let idCounter = 0
const genId = () => `${Date.now()}_${idCounter++}`

const createLayer = () => ({
  id: genId(),
  categoryKey: "",
  materialIndex: -1,
  materialName: "",
  thickness: null as number | null,
  density: "",
  lambda: null as number | null,
  rValue: 0,
  standard: "",
  fixedThickness: false,
})
const createAnalysis = (targetKey: string) => ({ id: genId(), targetKey, layers: [createLayer()] })

const getMaterialItem = (categoryKey: string, materialIndex: number): any => {
  if (!categoryKey || materialIndex < 0 || !DB[categoryKey]) return null
  return DB[categoryKey].items[materialIndex] || null
}
const recalcLayerR = (layer: any): number => {
  if (toNum(layer.lambda) > 0 && toNum(layer.thickness) > 0) {
    return Number((toNum(layer.thickness) / 1000 / toNum(layer.lambda)).toFixed(3))
  }
  return toNum(layer.rValue)
}

// Yes/No that stores "yes"/"no" (shading scoring expects these literal values).
function YesNoText({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {([["yes", t("yes")], ["no", t("no")]] as const).map(([val, label]) => {
        const active = value === val
        return (
          <Pressable
            key={val}
            onPress={() => onChange(val)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primarySoft : colors.surface,
            }}
          >
            <AppText style={{ color: active ? colors.primaryDark : colors.muted }}>{label}</AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

export function EnvOpaqueEditor({ input, setInput, climateCode }: EditorProps) {
  const analyses: any[] = input.analyses ?? []
  const bridge = input.bridge ?? { south: null, north: null, east: null, west: null, mitigation: false }
  const shading = input.shading ?? { q1: null, q2: null }

  useEffect(() => {
    if (!input.analyses) {
      setInput((prev: any) => ({ ...prev, analyses: [createAnalysis("wall_ext_open")] }))
    }
  }, [input.analyses, setInput])

  const setAnalyses = (updater: (list: any[]) => any[]) =>
    setInput((prev: any) => ({ ...prev, analyses: updater(prev.analyses ?? []) }))
  const updateAnalysis = (id: string, updater: (a: any) => any) =>
    setAnalyses((list) => list.map((a) => (a.id !== id ? a : updater(a))))
  const updateLayer = (aId: string, lId: string, updater: (l: any) => any) =>
    updateAnalysis(aId, (a) => ({ ...a, layers: a.layers.map((l: any) => (l.id !== lId ? l : updater(l))) }))

  const onCategoryChange = (aId: string, lId: string, categoryKey: string) =>
    updateLayer(aId, lId, (l) => ({
      ...l,
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

  const onMaterialChange = (aId: string, lId: string, materialIndex: number) =>
    updateLayer(aId, lId, (l) => {
      const material = getMaterialItem(l.categoryKey, materialIndex)
      if (!material) return l
      if (material.r !== undefined && material.r !== null) {
        return {
          ...l,
          materialIndex,
          materialName: material.n,
          density: material.d || "",
          lambda: null,
          thickness: material.t || l.thickness,
          rValue: Number(material.r),
          standard: material.std || "",
          fixedThickness: Boolean(material.t),
        }
      }
      const thickness = l.thickness || material.t || null
      const lambda = toNum(material.l)
      const computedR =
        lambda > 0 && toNum(thickness) > 0 ? Number((toNum(thickness) / 1000 / lambda).toFixed(3)) : 0
      return {
        ...l,
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

  const onThicknessChange = (aId: string, lId: string, value: number | null) =>
    updateLayer(aId, lId, (l) => {
      const next = { ...l, thickness: value }
      return { ...next, rValue: recalcLayerR(next) }
    })

  const applyPreset = (aId: string, presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (!preset) return
    updateAnalysis(aId, (a) => ({
      ...a,
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

  const setBridge = (patch: any) => setInput((prev: any) => ({ ...prev, bridge: { ...bridge, ...patch } }))
  const setShading = (patch: any) => setInput((prev: any) => ({ ...prev, shading: { ...shading, ...patch } }))

  const highBridge =
    toNum(bridge.south) > 5 || toNum(bridge.north) > 5 || toNum(bridge.east) > 5 || toNum(bridge.west) > 5

  return (
    <>
      {analyses.map((analysis, idx) => {
        const requiredR = getOpaqueTargetR(analysis.targetKey, climateCode)
        const totalR = analysis.layers.reduce((sum: number, l: any) => sum + toNum(l.rValue), 0)
        const pass = totalR > requiredR
        return (
          <Card key={analysis.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="subtitle">جداره {idx + 1}</AppText>
              <Button
                title={t("delete")}
                variant="danger"
                onPress={() => setAnalyses((list) => (list.length > 1 ? list.filter((a) => a.id !== analysis.id) : list))}
              />
            </View>

            <Select
              label="نوع جداره"
              value={analysis.targetKey}
              options={TARGET_KEYS.map((key) => ({ label: OPAQUE_TARGET_LABELS[key], value: key }))}
              onChange={(v) => updateAnalysis(analysis.id, (a) => ({ ...a, targetKey: String(v) }))}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <Badge>R موردنیاز: {requiredR.toFixed(2)}</Badge>
              <Badge tone={pass ? "primary" : "muted"}>R محاسبه‌شده: {totalR.toFixed(3)}</Badge>
              <Badge tone={pass ? "primary" : "muted"}>{pass ? "تأیید" : "عدم تأیید"}</Badge>
            </View>

            {analysis.layers.map((layer: any, layerIdx: number) => {
              const materials = layer.categoryKey ? DB[layer.categoryKey]?.items ?? [] : []
              return (
                <View
                  key={layer.id}
                  style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm, gap: 6 }}
                >
                  <AppText variant="label">لایه {layerIdx + 1} — R: {toNum(layer.rValue).toFixed(3)}</AppText>
                  <Select
                    label="دسته"
                    value={layer.categoryKey}
                    placeholder="—"
                    options={Object.keys(DB).map((key) => ({ label: DB[key].label, value: key }))}
                    onChange={(v) => onCategoryChange(analysis.id, layer.id, String(v))}
                  />
                  {layer.categoryKey ? (
                    <Select
                      label="مصالح"
                      value={layer.materialIndex >= 0 ? layer.materialIndex : ""}
                      placeholder="—"
                      options={materials.map((m: any, i: number) => ({ label: m.n, value: i }))}
                      onChange={(v) => onMaterialChange(analysis.id, layer.id, Number(v))}
                    />
                  ) : null}
                  {layer.materialIndex >= 0 && !layer.fixedThickness ? (
                    <Field
                      label="ضخامت (mm)"
                      keyboardType="numeric"
                      value={layer.thickness?.toString() ?? ""}
                      onChangeText={(txt) =>
                        onThicknessChange(analysis.id, layer.id, txt === "" ? null : Number(txt))
                      }
                      textAlign="left"
                    />
                  ) : null}
                  <Button
                    title={t("delete")}
                    variant="outline"
                    onPress={() =>
                      updateAnalysis(analysis.id, (a) => ({
                        ...a,
                        layers: a.layers.length > 1 ? a.layers.filter((l: any) => l.id !== layer.id) : a.layers,
                      }))
                    }
                  />
                </View>
              )
            })}

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="افزودن لایه"
                variant="outline"
                onPress={() => updateAnalysis(analysis.id, (a) => ({ ...a, layers: [...a.layers, createLayer()] }))}
              />
              <Button title="بارگذاری پیش‌فرض" variant="outline" onPress={() => applyPreset(analysis.id, analysis.targetKey)} />
            </View>
          </Card>
        )
      })}

      <Button title="افزودن جداره" onPress={() => setAnalyses((list) => [...list, createAnalysis("wall_ext_open")])} />

      <Card>
        <AppText variant="subtitle">پل حرارتی و سایه‌اندازی</AppText>
        {(
          [
            ["south", "پل حرارتی جنوب"],
            ["north", "شمال"],
            ["east", "شرق"],
            ["west", "غرب"],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            label={label}
            keyboardType="numeric"
            value={bridge[key]?.toString() ?? ""}
            onChangeText={(txt) => setBridge({ [key]: txt === "" ? null : Number(txt) })}
            textAlign="left"
          />
        ))}
        {highBridge ? (
          <Checkbox
            label="تمهیدات کاهش پل حرارتی انجام شد"
            checked={Boolean(bridge.mitigation)}
            onChange={(v) => setBridge({ mitigation: v })}
          />
        ) : null}

        <View style={{ gap: 4, marginTop: spacing.sm }}>
          <AppText>سوال سایه‌انداز ۱</AppText>
          <YesNoText value={shading.q1} onChange={(v) => setShading({ q1: v })} />
        </View>
        <View style={{ gap: 4, marginTop: spacing.sm }}>
          <AppText>سوال سایه‌انداز ۲</AppText>
          <YesNoText value={shading.q2} onChange={(v) => setShading({ q2: v })} />
        </View>
      </Card>
    </>
  )
}
