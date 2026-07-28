"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Alert, Badge, Card, CardBody, CardHeader, Spinner } from "@/components/ui"
import { useProject } from "@/lib/queries"
import AssessmentWorkspace from "@/features/assessment/AssessmentWorkspace"
import type { BuildingMeta } from "@/features/assessment/checklists/shared"

export default function AssessmentPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const t = useTranslations("assessment")

  const projectQuery = useProject(id)
  const project = projectQuery.data ?? null

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Alert variant="error">{t("saveError")}</Alert>
      </div>
    )
  }

  const meta: BuildingMeta = {
    totalArea: Number(project.totalArea) || 0,
    floorCount: Number(project.floorCount) || 0,
    unitCount: Number(project.unitCount) || 0,
    city: project.city ?? undefined,
    usage: project.usage ?? undefined,
  }
  const climateCode = project.climateCode || "4"

  // Section keys the user may edit (from the FarsNezam typ list). Null = all editable.
  const editableSections = project.allowedSections
    ? project.allowedSections.split(",").map((s) => s.trim()).filter(Boolean)
    : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <span className="font-semibold text-slate-800">{t("buildingMeta")}</span>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{project.title}</Badge>
            {project.city ? <Badge tone="slate">{project.city}</Badge> : null}
            <Badge tone="slate">
              {t("climate")}: {climateCode}
            </Badge>
            <Badge tone="slate">{meta.totalArea} m²</Badge>
            <Badge tone="slate">{meta.floorCount} طبقه</Badge>
            <Badge tone="slate">{meta.unitCount} واحد</Badge>
          </div>
        </CardBody>
      </Card>

      <AssessmentWorkspace
        projectId={id}
        meta={meta}
        climateCode={climateCode}
        editableSections={editableSections}
      />
    </div>
  )
}
