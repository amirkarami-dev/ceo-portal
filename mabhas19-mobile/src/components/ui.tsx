// Small set of styled RN primitives shared across screens (emerald design system).
import { useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors, radius, spacing } from "@/theme"

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollBody}>{children}</View>
      )}
    </SafeAreaView>
  )
}

export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  )
}

export function AppText({
  children,
  variant = "body",
  style,
}: {
  children: ReactNode
  variant?: "title" | "subtitle" | "body" | "muted" | "label"
  style?: object
}) {
  return <Text style={[styles.text, styles[variant], style]}>{children}</Text>
}

export function Field({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.text, styles.label]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        textAlign="right"
        {...props}
      />
    </View>
  )
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: {
  title: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "primary" | "outline" | "danger"
}) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "outline" && styles.btnOutline,
        variant === "danger" && styles.btnDanger,
        (pressed || isDisabled) && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : colors.primaryFg} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "outline" ? styles.btnTextOutline : styles.btnTextSolid,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" }) {
  return (
    <View style={[styles.badge, tone === "primary" && styles.badgePrimary]}>
      <Text style={[styles.badgeText, tone === "primary" && styles.badgeTextPrimary]}>{children}</Text>
    </View>
  )
}

export interface SelectOption<T> {
  label: string
  value: T
}

// Modal-based dropdown (no native picker dependency).
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = "—",
}: {
  label?: string
  value: T | null | undefined
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.text, styles.label]}>{label}</Text> : null}
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text
          style={[styles.text, { color: selected ? colors.foreground : colors.muted }]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={options}
              keyExtractor={(o, i) => `${String(o.value)}_${i}`}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  <Text
                    style={[
                      styles.text,
                      item.value === value && { color: colors.primary, fontWeight: "600" },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Pressable style={styles.checkboxRow} onPress={() => onChange(!checked)}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxOn]}>
        {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
      </View>
      <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  scrollBody: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  text: { color: colors.foreground, writingDirection: "rtl" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 14 },
  muted: { fontSize: 13, color: colors.muted },
  label: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  field: { gap: 2 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.foreground,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnPressed: { opacity: 0.7 },
  btnText: { fontSize: 15, fontWeight: "600" },
  btnTextSolid: { color: colors.primaryFg },
  btnTextOutline: { color: colors.primary },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgePrimary: { backgroundColor: colors.primarySoft },
  badgeText: { fontSize: 12, color: colors.muted },
  badgeTextPrimary: { color: colors.primaryDark, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "70%",
    paddingVertical: spacing.sm,
  },
  optionRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.primaryFg, fontSize: 14, fontWeight: "700" },
})
