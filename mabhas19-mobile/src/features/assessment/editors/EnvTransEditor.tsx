import { useEffect } from "react"
import { View } from "react-native"
import {
  ENV_TRANS_GAS_DB,
  ENV_TRANS_GLASS_DB,
  ENV_TRANS_PRESETS,
  ENV_TRANS_PROFILE_DB,
  TRANS_U_LIMIT_BY_TYPE,
  calcWindowU,
  getTransShgcLimit,
} from "@mabhas19/assessment-core"
import { AppText, Badge, Button, Card, Field, Select } from "@/components/ui"
import { t } from "@/i18n"
import { colors, spacing } from "@/theme"
import type { EditorProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

const GLASS = ENV_TRANS_GLASS_DB as any[]
const GAS = ENV_TRANS_GAS_DB as any[]
const PROFILE = ENV_TRANS_PROFILE_DB as any[]
const PRESETS = ENV_TRANS_PRESETS as Record<string, any>

const TYPE_OPTIONS = [
  { label: "پنجره ثابت", value: "fixed" },
  { label: "پنجره متحرک", value: "operable" },
  { label: "در نورگذر", value: "door" },
  { label: "نورگیر سقفی", value: "skylight" },
]

let idCounter = 0
const genId = () => `w_${Date.now()}_${idCounter++}`

const createWindowFromPreset = (presetKey: string) => {
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
    shgc: preset.shgc as number | null,
    pf: null as number | null,
  }
}

export function EnvTransEditor({ input, setInput, climateCode }: EditorProps) {
  const windows: any[] = input.windows ?? []

  useEffect(() => {
    if (!input.windows) {
      setInput((prev: any) => ({ ...prev, windows: [createWindowFromPreset("fixed_window")] }))
    }
  }, [input.windows, setInput])

  const setWindows = (updater: (list: any[]) => any[]) =>
    setInput((prev: any) => ({ ...prev, windows: updater(prev.windows ?? []) }))
  const updateWindow = (id: string, patch: any) =>
    setWindows((list) => list.map((w) => (w.id !== id ? w : { ...w, ...patch })))

  return (
    <>
      <Select
        label="افزودن جداره از پیش‌فرض"
        value=""
        placeholder="پیش‌فرض…"
        options={Object.keys(PRESETS).map((key) => ({ label: PRESETS[key].title, value: key }))}
        onChange={(v) => setWindows((list) => [...list, createWindowFromPreset(String(v))])}
      />

      {windows.map((windowItem, idx) => {
        const { uTotal } = calcWindowU(windowItem)
        const uLimit = TRANS_U_LIMIT_BY_TYPE[windowItem.type] || TRANS_U_LIMIT_BY_TYPE.fixed
        const shgcLimit = getTransShgcLimit(climateCode, Number(windowItem.pf) || 0)
        const uPass = uTotal > 0 && uTotal <= uLimit
        const shgcPass = Number.isFinite(Number(windowItem.shgc)) && Number(windowItem.shgc) <= shgcLimit
        return (
          <Card key={windowItem.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="subtitle">جداره نورگذر {idx + 1}</AppText>
              <Button
                title={t("delete")}
                variant="danger"
                onPress={() => setWindows((list) => (list.length > 1 ? list.filter((w) => w.id !== windowItem.id) : list))}
              />
            </View>

            <Field label="نام/جهت" value={windowItem.name ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { name: txt })} />
            <Select
              label="نوع جداره"
              value={windowItem.type}
              options={TYPE_OPTIONS}
              onChange={(v) => updateWindow(windowItem.id, { type: String(v) })}
            />
            <Select
              label="نوع پروفیل"
              value={windowItem.profileIdx}
              options={PROFILE.map((p: any, i: number) => ({ label: `${p.n} | Uf=${p.u_f}`, value: i }))}
              onChange={(v) => updateWindow(windowItem.id, { profileIdx: Number(v) })}
            />

            <Select
              label="لایه اول شیشه"
              value={windowItem.l1Idx}
              options={GLASS.map((g: any, i: number) => ({ label: g.n, value: i }))}
              onChange={(v) => updateWindow(windowItem.id, { l1Idx: Number(v) })}
            />
            <Field label="ضخامت لایه ۱ (mm)" keyboardType="numeric" value={windowItem.l1Th?.toString() ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { l1Th: txt === "" ? 0 : Number(txt) })} textAlign="left" />
            <Select
              label="لایه میانی (گاز)"
              value={windowItem.l2Idx}
              options={GAS.map((g: any, i: number) => ({ label: g.n, value: i }))}
              onChange={(v) => updateWindow(windowItem.id, { l2Idx: Number(v) })}
            />
            <Field label="ضخامت لایه میانی (mm)" keyboardType="numeric" value={windowItem.l2Th?.toString() ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { l2Th: txt === "" ? 0 : Number(txt) })} textAlign="left" />
            <Select
              label="لایه دوم شیشه"
              value={windowItem.l3Idx}
              options={GLASS.map((g: any, i: number) => ({ label: g.n, value: i }))}
              onChange={(v) => updateWindow(windowItem.id, { l3Idx: Number(v) })}
            />
            <Field label="ضخامت لایه ۲ (mm)" keyboardType="numeric" value={windowItem.l3Th?.toString() ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { l3Th: txt === "" ? 0 : Number(txt) })} textAlign="left" />

            <Field label="SHGC" keyboardType="numeric" value={windowItem.shgc?.toString() ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { shgc: txt === "" ? null : Number(txt) })} textAlign="left" />
            <Field label="PF (سایه‌بان)" keyboardType="numeric" value={windowItem.pf?.toString() ?? ""} onChangeText={(txt) => updateWindow(windowItem.id, { pf: txt === "" ? null : Number(txt) })} textAlign="left" />

            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
              <Badge tone={uPass ? "primary" : "muted"}>U = {uTotal.toFixed(2)} / حد {uLimit}</Badge>
              <Badge tone={shgcPass ? "primary" : "muted"}>SHGC حد {shgcLimit}</Badge>
            </View>
          </Card>
        )
      })}
    </>
  )
}
