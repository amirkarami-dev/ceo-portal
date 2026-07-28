import { useState } from "react"
import { useRouter } from "expo-router"
import { AppText, Button, Card, Field, Screen } from "@/components/ui"
import { projectsApi } from "@/lib/endpoints"
import { ApiError } from "@/lib/api"
import type { CreateProjectInput } from "@/lib/types"
import { t } from "@/i18n"
import { colors } from "@/theme"

export default function NewProjectScreen() {
  const router = useRouter()
  const [form, setForm] = useState<CreateProjectInput>({ title: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof CreateProjectInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))
  const setNum = (key: keyof CreateProjectInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value === "" ? undefined : Number(value) }))

  const onSubmit = async () => {
    if (!form.title?.trim()) {
      setError(t("title"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { id } = await projectsApi.create({ ...form, title: form.title!.trim() })
      router.replace(`/(app)/projects/${id}`)
    } catch (err) {
      // Subscription quota and validation errors surface here.
      const body = err instanceof ApiError ? (err.body as { detail?: string } | null) : null
      setError(body?.detail ?? t("saveError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Card>
        <AppText variant="subtitle">{t("createProject")}</AppText>
        <Field label={t("title")} value={form.title} onChangeText={(v) => set("title", v)} />
        <Field label={t("client")} value={form.client ?? ""} onChangeText={(v) => set("client", v)} />
        <Field label={t("city")} value={form.city ?? ""} onChangeText={(v) => set("city", v)} />
        <Field
          label={t("climateCode")}
          value={form.climateCode ?? ""}
          onChangeText={(v) => set("climateCode", v)}
          textAlign="left"
        />
        <Field
          label={t("totalArea")}
          keyboardType="numeric"
          value={form.totalArea?.toString() ?? ""}
          onChangeText={(v) => setNum("totalArea", v)}
          textAlign="left"
        />
        <Field
          label={t("floorCount")}
          keyboardType="numeric"
          value={form.floorCount?.toString() ?? ""}
          onChangeText={(v) => setNum("floorCount", v)}
          textAlign="left"
        />
        <Field
          label={t("unitCount")}
          keyboardType="numeric"
          value={form.unitCount?.toString() ?? ""}
          onChangeText={(v) => setNum("unitCount", v)}
          textAlign="left"
        />

        {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}

        <Button title={busy ? t("saving") : t("save")} onPress={onSubmit} loading={busy} />
        <Button title={t("cancel")} variant="outline" onPress={() => router.back()} />
      </Card>
    </Screen>
  )
}
