import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { useFocusEffect, useLocalSearchParams } from "expo-router"
import {
  ALL_TOOLS,
  TOTAL_MAX_SCORE,
  calcBuildingGroup,
  scoreTool,
  type ToolKey,
} from "@mabhas19/assessment-core"
import { AppText, Badge, Button, Card, Screen } from "@/components/ui"
import { ChecklistEditor } from "@/features/assessment/editors"
import { projectsApi } from "@/lib/endpoints"
import { ApiError } from "@/lib/api"
import type { Project } from "@/lib/types"
import { t } from "@/i18n"
import { colors } from "@/theme"

/* eslint-disable @typescript-eslint/no-explicit-any */

type SavedResult = { score: number; maxScore: number; title?: string }

export default function ChecklistScreen() {
  const { id, tool } = useLocalSearchParams<{ id: string; tool: ToolKey }>()
  const toolKey = tool as ToolKey
  const toolMeta = ALL_TOOLS.find((toolItem) => toolItem.toolKey === toolKey)

  const [project, setProject] = useState<Project | null>(null)
  const [allInputs, setAllInputs] = useState<Record<string, any>>({})
  const [allResults, setAllResults] = useState<Record<string, SavedResult>>({})
  const [input, setInput] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const proj = await projectsApi.get(id)
    setProject(proj)
    try {
      const assessment = await projectsApi.getAssessment(id)
      const inputs = assessment.inputJson ? JSON.parse(assessment.inputJson) : {}
      const results = assessment.resultJson ? JSON.parse(assessment.resultJson) : {}
      setAllInputs(inputs)
      setAllResults(results)
      setInput(inputs[toolKey] ?? {})
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    } finally {
      setLoading(false)
    }
  }, [id, toolKey])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const climateCode = project?.climateCode ?? "4"
  const group = useMemo(
    () =>
      calcBuildingGroup({
        area: Number(project?.totalArea ?? 0),
        floors: Number(project?.floorCount ?? 0),
        units: Number(project?.unitCount ?? 0),
      }).code,
    [project],
  )

  const live = useMemo(() => scoreTool(toolKey, input, climateCode), [toolKey, input, climateCode])

  const onSave = async () => {
    if (!id) return
    setSaving(true)
    setSaved(false)
    try {
      const nextInputs = { ...allInputs, [toolKey]: input }
      const nextResults: Record<string, SavedResult> = {
        ...allResults,
        [toolKey]: { score: live.score, maxScore: live.maxScore, title: toolMeta?.name },
      }
      const totalScore = Object.values(nextResults).reduce((sum, r) => sum + (r.score || 0), 0)
      await projectsApi.saveAssessment(id, {
        inputJson: JSON.stringify(nextInputs),
        resultJson: JSON.stringify(nextResults),
        totalScore,
        maxScore: TOTAL_MAX_SCORE,
      })
      setAllInputs(nextInputs)
      setAllResults(nextResults)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Screen>
      <Card>
        <AppText variant="subtitle">{toolMeta?.name}</AppText>
        <Badge tone={live.score > 0 ? "primary" : "muted"}>
          {t("score")}: {live.score} / {toolMeta?.maxScore}
        </Badge>
      </Card>

      <ChecklistEditor toolKey={toolKey} input={input} setInput={setInput} climateCode={climateCode} group={group} />

      {saved ? <AppText style={{ color: colors.success }}>{t("saveSuccess")}</AppText> : null}
      <Button title={saving ? t("saving") : t("save")} onPress={onSave} loading={saving} />
    </Screen>
  )
}
