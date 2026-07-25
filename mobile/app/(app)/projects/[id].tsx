import { useCallback, useState } from "react"
import { ActivityIndicator, Linking, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import {
  ASSESSMENT_SECTIONS,
  TOTAL_MAX_SCORE,
  calcBuildingGroup,
  scoreTool,
  type ToolKey,
} from "@mabhas19/assessment-core"
import { AppText, Badge, Button, Card, Screen } from "@/components/ui"
import { projectsApi } from "@/lib/endpoints"
import { ApiError } from "@/lib/api"
import type { Project } from "@/lib/types"
import { t } from "@/i18n"
import { colors, spacing } from "@/theme"

type SavedResult = { score: number; maxScore: number; title?: string }

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [inputs, setInputs] = useState<Record<string, unknown>>({})
  const [results, setResults] = useState<Record<string, SavedResult>>({})
  const [loading, setLoading] = useState(true)
  const [reporting, setReporting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const proj = await projectsApi.get(id)
      setProject(proj)
      try {
        const assessment = await projectsApi.getAssessment(id)
        if (assessment.inputJson) setInputs(JSON.parse(assessment.inputJson))
        if (assessment.resultJson) setResults(JSON.parse(assessment.resultJson))
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const onDownloadReport = async () => {
    if (!id) return
    setReporting(true)
    try {
      const { downloadUrl } = await projectsApi.report(id)
      await Linking.openURL(downloadUrl)
    } catch {
      // surfaced silently for now
    } finally {
      setReporting(false)
    }
  }

  if (loading || !project) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const group = calcBuildingGroup({
    area: Number(project.totalArea ?? 0),
    floors: Number(project.floorCount ?? 0),
    units: Number(project.unitCount ?? 0),
  })
  const climateCode = project.climateCode ?? "4"

  // Total derived from saved per-tool results (kept in sync with the web client).
  const totalScore = Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0)

  return (
    <Screen>
      <Card>
        <AppText variant="title">{project.title}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 }}>
          {project.city ? <Badge>{project.city}</Badge> : null}
          <Badge tone="primary">
            {t("buildingGroup")}: {group.label}
          </Badge>
          <Badge>
            {t("climateCode")}: {climateCode}
          </Badge>
          <Badge>{project.totalArea ?? 0} m²</Badge>
        </View>
      </Card>

      <Card>
        <AppText variant="muted">{t("totalScore")}</AppText>
        <AppText variant="title" style={{ color: colors.primary }}>
          {totalScore} {t("of")} {TOTAL_MAX_SCORE}
        </AppText>
      </Card>

      {ASSESSMENT_SECTIONS.map((section) => (
        <Card key={section.key}>
          <AppText variant="subtitle">{section.title}</AppText>
          {section.tools.map((tool) => {
            const toolKey = tool.toolKey as ToolKey
            const saved = results[toolKey]
            // Recompute live from the saved input using the shared engine to confirm parity.
            const live = scoreTool(toolKey, inputs[toolKey], climateCode)
            const shownScore = saved?.score ?? live.score
            return (
              <View
                key={toolKey}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  marginTop: spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText>{tool.name}</AppText>
                  <Badge tone={shownScore > 0 ? "primary" : "muted"}>
                    {t("score")}: {shownScore} / {tool.maxScore}
                  </Badge>
                </View>
                <Button
                  title={t("openTool")}
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/projects/checklist",
                      params: { id: String(id), tool: toolKey },
                    })
                  }
                />
              </View>
            )
          })}
        </Card>
      ))}

      <Button
        title={reporting ? t("generatingReport") : t("downloadReport")}
        onPress={onDownloadReport}
        loading={reporting}
      />
    </Screen>
  )
}
