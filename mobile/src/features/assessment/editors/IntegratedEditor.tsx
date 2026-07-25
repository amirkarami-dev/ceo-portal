import { Pressable, View } from "react-native"
import { INTEGRATED_ITEMS } from "@mabhas19/assessment-core"
import { AppText, Badge, Card } from "@/components/ui"
import { t } from "@/i18n"
import { YesNo, type EditorProps } from "./shared"

/* eslint-disable @typescript-eslint/no-explicit-any */

export function IntegratedEditor({ input, setInput }: EditorProps) {
  const logicActive: boolean = input.logicActive ?? false
  const responses: Record<string, string> = input.responses ?? {}

  const setResp = (key: string, v: string) =>
    setInput((prev: any) => ({ ...prev, responses: { ...(prev.responses ?? {}), [key]: v } }))

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText style={{ flex: 1 }}>سامانه مدیریت یکپارچه فعال است؟</AppText>
          <Pressable onPress={() => setInput((prev: any) => ({ ...prev, logicActive: !logicActive }))}>
            <Badge tone={logicActive ? "primary" : "muted"}>{logicActive ? t("yes") : t("no")}</Badge>
          </Pressable>
        </View>
      </Card>
      {logicActive
        ? (INTEGRATED_ITEMS as any[]).map((item, idx) => {
            const key = `row_${idx}`
            return (
              <Card key={key}>
                <AppText>{item.text}</AppText>
                {item.target ? <AppText variant="muted">{item.target}</AppText> : null}
                <YesNo value={responses[key]} onChange={(v) => setResp(key, v)} />
              </Card>
            )
          })
        : null}
    </>
  )
}
