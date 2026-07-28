import type { Dispatch, SetStateAction } from "react"
import { Pressable, View } from "react-native"
import { AppText } from "@/components/ui"
import { t } from "@/i18n"
import { colors, radius, spacing } from "@/theme"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EditorProps {
  input: any
  setInput: Dispatch<SetStateAction<any>>
  climateCode: string
  // Auto-detected building-group code (from the project's area/floors/units).
  group: string
}

// Yes / No pill toggle used by every checklist.
export function YesNo({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (v: "y" | "n") => void
}) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {(["y", "n"] as const).map((option) => {
        const active = value === option
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primarySoft : colors.surface,
            }}
          >
            <AppText style={{ color: active ? colors.primaryDark : colors.muted }}>
              {option === "y" ? t("yes") : t("no")}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}
