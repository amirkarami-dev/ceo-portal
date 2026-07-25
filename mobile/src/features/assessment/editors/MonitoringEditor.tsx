import { Pressable, View } from "react-native"
import { MONITORING_SECTIONS } from "@mabhas19/assessment-core"
import { AppText, Badge, Card } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { YesNo, type EditorProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

export function MonitoringEditor({ input, setInput }: EditorProps) {
  const toggles: Record<string, boolean> = input.toggles ?? {}
  const responses: Record<string, string> = input.responses ?? {}

  const setToggle = (key: string, on: boolean) =>
    setInput((prev: any) => ({ ...prev, toggles: { ...(prev.toggles ?? {}), [key]: on } }))
  const setResp = (key: string, v: string) =>
    setInput((prev: any) => ({ ...prev, responses: { ...(prev.responses ?? {}), [key]: v } }))

  return (
    <>
      {(MONITORING_SECTIONS as any[]).map((section) => {
        const active = section.alwaysActive || toggles[section.key]
        return (
          <Card key={section.key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="subtitle" style={{ flex: 1 }}>
                {section.title}
              </AppText>
              {!section.alwaysActive ? (
                <Pressable onPress={() => setToggle(section.key, !active)}>
                  <Badge tone={active ? "primary" : "muted"}>{section.toggleLabel}</Badge>
                </Pressable>
              ) : null}
            </View>
            {active
              ? section.items.map((item: any, idx: number) => {
                  const key = `${section.key}_${idx}`
                  return (
                    <View
                      key={key}
                      style={{
                        gap: 4,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: spacing.sm,
                        marginTop: spacing.sm,
                      }}
                    >
                      <AppText>{item.text}</AppText>
                      <YesNo value={responses[key]} onChange={(v) => setResp(key, v)} />
                    </View>
                  )
                })
              : null}
          </Card>
        )
      })}
    </>
  )
}
