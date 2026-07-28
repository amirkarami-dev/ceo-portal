"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Alert, Badge, Button, Spinner, cn } from "@/components/ui"
import { useAssessment, useSaveAssessment } from "@/lib/queries"
import type { Assessment } from "@/lib/types"
import {
  ASSESSMENT_SECTIONS,
  TOTAL_MAX_SCORE,
  type AssessmentSection,
  type ToolKey,
  type ToolResult,
} from "./data/sections"
import type { BuildingMeta } from "./checklists/shared"
import EnvOpaqueChecklist from "./checklists/EnvOpaqueChecklist"
import EnvTransChecklist from "./checklists/EnvTransChecklist"
import MechChecklist from "./checklists/MechChecklist"
import ElecChecklist from "./checklists/ElecChecklist"
import MonitoringChecklist from "./checklists/MonitoringChecklist"
import IntegratedMgmtChecklist from "./checklists/IntegratedMgmtChecklist"

type ChecklistComponent = React.ComponentType<{
  meta: BuildingMeta
  climateCode: string
  initial?: Record<string, unknown>
  onResult: (r: ToolResult) => void
}>

const TOOL_COMPONENTS: Record<ToolKey, ChecklistComponent> = {
  "env_opaque.html": EnvOpaqueChecklist,
  "env_trans.html": EnvTransChecklist,
  "mech_checklist.html": MechChecklist,
  "elec_checklist.html": ElecChecklist,
  "monitoring_checklist.html": MonitoringChecklist,
  "integrated_mgmt.html": IntegratedMgmtChecklist,
}

interface AssessmentWorkspaceProps {
  projectId: string
  meta: BuildingMeta
  climateCode: string
  /** Section keys the user may EDIT (from the project's external typ list).
   * Null/empty = every section is editable (manually-created projects). */
  editableSections?: string[] | null
}

// Parse the stored assessment JSON into the inputs each checklist hydrates from and
// the score-only results used to show badges/totals before a tool is opened.
function parseAssessment(assessment: Assessment | null | undefined): {
  initialInputs: Record<string, Record<string, unknown>>
  loadedResults: Record<string, ToolResult>
} {
  const initialInputs: Record<string, Record<string, unknown>> = {}
  const loadedResults: Record<string, ToolResult> = {}
  if (!assessment) return { initialInputs, loadedResults }
  try {
    if (assessment.inputJson) {
      Object.assign(initialInputs, JSON.parse(assessment.inputJson))
    }
  } catch {
    // ignore malformed inputJson
  }
  try {
    if (assessment.resultJson) {
      const raw = JSON.parse(assessment.resultJson) as Record<
        string,
        { score: number; maxScore: number; title?: string }
      >
      Object.entries(raw).forEach(([toolKey, r]) => {
        loadedResults[toolKey] = {
          toolKey: toolKey as ToolKey,
          score: r.score,
          maxScore: r.maxScore,
        }
      })
    }
  } catch {
    // ignore malformed resultJson
  }
  return { initialInputs, loadedResults }
}

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function AssessmentWorkspace({
  projectId,
  meta,
  climateCode,
  editableSections,
}: AssessmentWorkspaceProps) {
  const t = useTranslations("assessment")

  const assessmentQuery = useAssessment(projectId)
  const saveAssessment = useSaveAssessment(projectId)

  // Loaded data is derived from the query (no set-state-on-load); runtime edits from the
  // checklists overlay it, so opened tools win over the score-only loaded entries.
  const { initialInputs, loadedResults } = useMemo(
    () => parseAssessment(assessmentQuery.data),
    [assessmentQuery.data]
  )
  const [runtimeResults, setRuntimeResults] = useState<Record<string, ToolResult>>({})
  const [openTool, setOpenTool] = useState<ToolKey | null>(null)

  const results = useMemo(
    () => ({ ...loadedResults, ...runtimeResults }),
    [loadedResults, runtimeResults]
  )

  const isEditable = (sectionKey: string) =>
    !editableSections || editableSections.length === 0 || editableSections.includes(sectionKey)

  const handleResult = (result: ToolResult) => {
    setRuntimeResults((prev) => {
      const existing = prev[result.toolKey] ?? loadedResults[result.toolKey]
      if (
        existing &&
        existing.score === result.score &&
        existing.maxScore === result.maxScore &&
        JSON.stringify(existing.details) === JSON.stringify(result.details)
      ) {
        return prev
      }
      return { ...prev, [result.toolKey]: result }
    })
  }

  const totalScore = useMemo(
    () => Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0),
    [results]
  )

  const handleSave = () => {
    const inputMap: Record<string, unknown> = {}
    const resultMap: Record<string, { score: number; maxScore: number; title: string }> = {}
    ASSESSMENT_SECTIONS.forEach((section) => {
      section.tools.forEach((tool) => {
        const r = results[tool.toolKey]
        if (r) {
          inputMap[tool.toolKey] = r.details ?? {}
          resultMap[tool.toolKey] = {
            score: r.score,
            maxScore: r.maxScore,
            title: tool.name,
          }
        }
      })
    })
    saveAssessment.mutate({
      inputJson: JSON.stringify(inputMap),
      resultJson: JSON.stringify(resultMap),
      totalScore,
      maxScore: TOTAL_MAX_SCORE,
    })
  }

  if (assessmentQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  // The open tool renders full-width below the card grid (checklists are large tables).
  const openSection: AssessmentSection | undefined = openTool
    ? ASSESSMENT_SECTIONS.find((s) => s.tools.some((tool) => tool.toolKey === openTool))
    : undefined
  const openToolDef = openSection?.tools.find((tool) => tool.toolKey === openTool)
  const openEditable = openSection ? isEditable(openSection.key) : true
  const OpenComp = openTool ? TOOL_COMPONENTS[openTool] : null

  return (
    <div className="flex flex-col gap-5">
      {/* Header: total score + save */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-muted-foreground">{t("totalScore")}</span>
          <span dir="ltr" className="text-2xl font-extrabold text-primary tabular-nums">
            {totalScore} / {TOTAL_MAX_SCORE}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {saveAssessment.isSuccess ? (
            <Alert variant="success">{t("saveSuccess")}</Alert>
          ) : saveAssessment.isError ? (
            <Alert variant="error">{t("saveError")}</Alert>
          ) : null}
          <Button onClick={handleSave} disabled={saveAssessment.isPending}>
            {saveAssessment.isPending ? <Spinner /> : null}
            {t("save")}
          </Button>
        </div>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ASSESSMENT_SECTIONS.map((section) => {
          const editable = isEditable(section.key)
          const sectionScore = section.tools.reduce(
            (sum, tool) => sum + (results[tool.toolKey]?.score ?? 0),
            0
          )
          const sectionMax = section.tools.reduce((sum, tool) => sum + tool.maxScore, 0)
          const pct = sectionMax > 0 ? Math.round((sectionScore / sectionMax) * 100) : 0

          return (
            <section
              key={section.key}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card",
                !editable && "opacity-90"
              )}
            >
              {/* Section color accent */}
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: section.color }}
                aria-hidden
              />

              <div className="flex flex-col gap-4 p-5 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: section.color }}
                      aria-hidden
                    />
                    <h3 className="truncate text-sm font-bold text-card-foreground">
                      {section.title}
                    </h3>
                  </div>
                  {editable ? (
                    <Badge tone={sectionScore > 0 ? "green" : "slate"}>
                      <span dir="ltr" className="tabular-nums">
                        {sectionScore} / {sectionMax}
                      </span>
                    </Badge>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      <LockGlyph className="h-3 w-3" />
                      {t("readOnly")}
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="h-1.5 grow overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", editable ? "bg-primary" : "bg-muted-foreground/40")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {pct}%
                  </span>
                </div>

                {section.reminder ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    {section.reminder}
                  </p>
                ) : null}

                {/* Tools */}
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {section.tools.map((tool) => {
                    const r = results[tool.toolKey]
                    const isOpen = openTool === tool.toolKey
                    return (
                      <li
                        key={tool.toolKey}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-card-foreground">
                            {tool.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span dir="ltr" className="tabular-nums">
                              {r?.score ?? 0} / {tool.maxScore}
                            </span>{" "}
                            {t("score")}
                          </div>
                        </div>
                        <Button
                          variant={isOpen ? "outline" : editable ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setOpenTool(isOpen ? null : tool.toolKey)}
                        >
                          {isOpen ? t("closeTool") : editable ? t("openTool") : t("view")}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          )
        })}
      </div>

      {/* Open checklist — full width below the grid */}
      {openTool && OpenComp && openSection && openToolDef ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: openSection.color }}
                aria-hidden
              />
              <h3 className="truncate text-sm font-bold text-card-foreground">{openToolDef.name}</h3>
              {!openEditable ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  <LockGlyph className="h-3 w-3" />
                  {t("readOnly")}
                </span>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenTool(null)}>
              {t("closeTool")}
            </Button>
          </div>

          {!openEditable ? (
            <div className="border-b border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
              {t("readOnlyNotice")}
            </div>
          ) : null}

          <div
            className={cn("px-5 py-5", !openEditable && "pointer-events-none select-none opacity-60")}
            aria-disabled={!openEditable}
          >
            <OpenComp
              meta={meta}
              climateCode={climateCode}
              initial={initialInputs[openTool]}
              onResult={handleResult}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
