import { Fragment, useEffect } from "react"
import { View } from "react-native"
import {
  ELEC_DB,
  ELEC_RULES,
  ELEC_TABLE_TEMPLATES,
  GROUP_LABELS,
  MECH_DB,
  getGroupIndex,
  type GroupCode,
} from "@mabhas19/assessment-core"
import { AppText, Badge, Card, Checkbox, Field, Select } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { YesNo, type EditorProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mechanical custom-select toggles which rows are logically disabled.
const NON_CENTRAL_ROWS = [
  "s0_c1_0", "s0_c1_1", "s1_c2_0", "s1_c2_1", "s1_c2_2", "s1_c2_3", "s1_c2_4",
  "s1_c2_5", "s1_c2_6", "s1_c2_7", "s1_c2_8", "s1_c2_9", "s1_c2_10",
]
const CENTRAL_ROWS = [
  "s0_c2_0", "s0_c2_1", "s0_c2_2", "s0_c3_0", "s0_c3_1", "s1_c3_0",
  "s1_c3_1", "s1_c3_2", "s1_c3_3", "s1_c3_4", "s1_c3_5",
]

const rowId = (sIdx: number, cIdx: number, suffix: string | number) => `s${sIdx}_c${cIdx}_${suffix}`

const GROUP_OPTIONS = (Object.keys(GROUP_LABELS) as GroupCode[]).map((code) => ({
  label: GROUP_LABELS[code],
  value: code as string,
}))

export function GroupChecklistEditor({
  variant,
  input,
  setInput,
  group,
}: EditorProps & { variant: "mech" | "elec" }) {
  const sections =
    variant === "mech"
      ? (MECH_DB as any[])
      : (ELEC_DB as any[]).filter((section) => section.id !== "renew")

  const manualGroup: string | null = input.manualGroup ?? null
  const currentGroup = manualGroup || group || "A"
  const responses: Record<string, any> = input.responses ?? {}
  const logicOff = new Set<string>(input.logicOffRows ?? [])

  // Keep the effective group in the stored input so scoring reads it directly.
  useEffect(() => {
    if (input.group !== currentGroup) {
      setInput((prev: any) => ({ ...prev, group: currentGroup }))
    }
  }, [currentGroup, input.group, setInput])

  const setResp = (id: string, patch: any) =>
    setInput((prev: any) => ({
      ...prev,
      responses: { ...(prev.responses ?? {}), [id]: { ...(prev.responses?.[id] ?? {}), ...patch } },
    }))

  const setManualGroup = (value: string | null) =>
    setInput((prev: any) => ({ ...prev, manualGroup: value }))

  const handleSystemChange = (value: string) => {
    let next: string[] = []
    if (value === "غیر مرکزی") next = CENTRAL_ROWS
    else if (value === "مرکزی") next = NON_CENTRAL_ROWS
    setInput((prev: any) => ({ ...prev, logicOffRows: next }))
  }

  const isRowActive = (item: any, id: string): boolean => {
    if (variant === "mech") {
      const groupActive = getGroupIndex(currentGroup) >= getGroupIndex(item.minG || "A")
      return groupActive && !logicOff.has(id)
    }
    // elec: tag-based rules
    const cfg = (ELEC_RULES as Record<string, Record<string, boolean>>)[currentGroup] || {}
    if (!item.tag) return true
    return cfg[item.tag] !== false
  }

  const renderInput = (item: any, id: string) => {
    const state = responses[id] || {}
    switch (item.type) {
      case "bool":
      case "bool_reverse":
        return <YesNo value={state.radio} onChange={(v) => setResp(id, { radio: v })} />
      case "num":
        return (
          <Field
            keyboardType="numeric"
            placeholder={`${item.v?.min !== undefined ? `Min:${item.v.min} ` : ""}${item.v?.max !== undefined ? `Max:${item.v.max}` : ""} ${item.unit || ""}`}
            value={state.number?.toString() ?? ""}
            onChangeText={(txt) => setResp(id, { number: txt === "" ? null : Number(txt) })}
            textAlign="left"
          />
        )
      case "text":
        return <Field value={state.text ?? ""} onChangeText={(txt) => setResp(id, { text: txt })} />
      case "eff_pair":
        return (
          <View style={{ gap: spacing.sm }}>
            <Field placeholder="حداقل بازده" value={state.eff ?? ""} onChangeText={(txt) => setResp(id, { eff: txt })} />
            <Field placeholder="رده انرژی" value={state.rank ?? ""} onChangeText={(txt) => setResp(id, { rank: txt })} />
          </View>
        )
      case "custom_select":
        return (
          <Select
            value={state.selectValue ?? ""}
            placeholder="انتخاب…"
            options={(item.opts ?? []).map((o: string) => ({ label: o, value: o }))}
            onChange={(v) => {
              setResp(id, { selectValue: v })
              handleSystemChange(String(v))
            }}
          />
        )
      case "tb_dla":
      case "tb_u": {
        const template = ELEC_TABLE_TEMPLATES[item.type] ?? []
        const table = state.table ?? template.map(() => ({ checked: false, value: null }))
        return (
          <View style={{ gap: 6 }}>
            {template.map((row, idx) => (
              <View key={`${id}_${idx}`} style={{ gap: 4 }}>
                <Checkbox
                  label={`${row.name} (حداقل ${row.limit})`}
                  checked={Boolean(table[idx]?.checked)}
                  onChange={(checked) => {
                    const next = [...table]
                    next[idx] = { checked, value: checked ? next[idx]?.value ?? null : null }
                    setResp(id, { table: next })
                  }}
                />
                {table[idx]?.checked ? (
                  <Field
                    keyboardType="numeric"
                    value={table[idx]?.value?.toString() ?? ""}
                    onChangeText={(txt) => {
                      const next = [...table]
                      next[idx] = { ...next[idx], value: txt === "" ? null : Number(txt) }
                      setResp(id, { table: next })
                    }}
                    textAlign="left"
                  />
                ) : null}
              </View>
            ))}
          </View>
        )
      }
      default:
        return null
    }
  }

  const renderItem = (item: any, id: string) => {
    const active = isRowActive(item, id)
    return (
      <View
        key={id}
        style={{
          gap: 6,
          opacity: active ? 1 : 0.4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.sm,
          marginTop: spacing.sm,
        }}
      >
        <AppText>
          {item.char ? `${item.char}. ` : ""}
          {item.text}
        </AppText>
        {active ? renderInput(item, id) : <Badge>غیرفعال برای این گروه</Badge>}
      </View>
    )
  }

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
          <Badge tone="primary">گروه خودکار: {GROUP_LABELS[(group || "A") as GroupCode]}</Badge>
        </View>
        <Select
          label="گروه دستی (اختیاری)"
          value={manualGroup ?? ""}
          placeholder="خودکار"
          options={[{ label: "خودکار", value: "" }, ...GROUP_OPTIONS]}
          onChange={(v) => setManualGroup(v === "" ? null : String(v))}
        />
      </Card>

      {sections.map((section, sIdx) => (
        <Card key={section.id}>
          <AppText variant="subtitle">{section.title}</AppText>
          {section.intro ? <AppText variant="muted">{section.intro}</AppText> : null}
          {section.cats.map((cat: any, cIdx: number) => (
            <View key={`${section.id}_${cIdx}`} style={{ marginTop: spacing.sm }}>
              <AppText variant="label">{cat.name}</AppText>
              {(cat.items ?? []).map((item: any, itemIdx: number) =>
                renderItem(item, rowId(sIdx, cIdx, itemIdx)),
              )}
              {(cat.subGroups ?? []).map((subGroup: any, subIdx: number) => (
                <Fragment key={`${section.id}_${cIdx}_sub${subIdx}`}>
                  <AppText variant="muted" style={{ marginTop: spacing.sm }}>
                    {subGroup.label}
                  </AppText>
                  {(subGroup.items ?? []).map((item: any, itemIdx: number) =>
                    renderItem(item, rowId(sIdx, cIdx, `sub${subIdx}_${itemIdx}`)),
                  )}
                </Fragment>
              ))}
            </View>
          ))}
        </Card>
      ))}
    </>
  )
}
