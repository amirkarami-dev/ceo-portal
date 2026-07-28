import { useCallback, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { AppText, Badge, Button, Card } from "@/components/ui"
import { SafeAreaView } from "react-native-safe-area-context"
import { projectsApi } from "@/lib/endpoints"
import type { Project } from "@/lib/types"
import { t } from "@/i18n"
import { colors, spacing } from "@/theme"

export default function ProjectsScreen() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const data = await projectsApi.list()
      setProjects(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceMuted }} edges={["bottom"]}>
      <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1 }}>
        <Button title={t("newProject")} onPress={() => router.push("/(app)/projects/new")} />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <AppText variant="muted">{t("saveError")}</AppText>
            <Button title={t("retry")} variant="outline" onPress={load} />
          </View>
        ) : projects.length === 0 ? (
          <AppText variant="muted" style={{ marginTop: spacing.xl, textAlign: "center" }}>
            {t("noProjects")}
          </AppText>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/(app)/projects/${item.id}`)}>
                <Card>
                  <AppText variant="subtitle">{item.title}</AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 }}>
                    {item.city ? <Badge>{item.city}</Badge> : null}
                    {item.buildingGroupLabel ? (
                      <Badge tone="primary">
                        {t("buildingGroup")}: {item.buildingGroupLabel}
                      </Badge>
                    ) : null}
                    {item.hasAssessment && item.totalScore != null ? (
                      <Badge tone="primary">
                        {t("score")}: {item.totalScore} / {item.maxScore ?? 831}
                      </Badge>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
