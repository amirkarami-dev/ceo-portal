"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import {
  useAssessment,
  useDeleteProject,
  useGenerateReport,
  useProject,
  useUpdateProject,
} from "@/lib/queries"
import type { CreateProjectInput } from "@/lib/types"
import { M19_CLIMATE_DEFINITIONS } from "@/features/assessment/data/climate"
import { ASSESSMENT_SECTIONS, type ToolKey } from "@/features/assessment/data/sections"
import type { ProjectDto } from "@/components/projects/project-types"
import { ProjectForm } from "@/components/projects/project-form"
import { Modal } from "@/components/projects/modal"
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
} from "@/components/ui"

function fmt(locale: string, n: number | undefined | null): string {
  if (n == null) return "-"
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(n)
}

type FieldIcon =
  | "client"
  | "usage"
  | "city"
  | "address"
  | "climate"
  | "area"
  | "floors"
  | "units"
  | "gauge"

// One coherent hand-rolled stroke-icon family (this repo has no icon dependency).
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-4 w-4",
  "aria-hidden": true,
} as const

function FieldGlyph({ icon }: { icon: FieldIcon }) {
  switch (icon) {
    case "client": // employer / person
      return (
        <svg {...ICON_PROPS}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case "usage": // tag / category
      return (
        <svg {...ICON_PROPS}>
          <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8Z" />
          <circle cx="7.5" cy="7.5" r="1.3" />
        </svg>
      )
    case "city": // buildings
      return (
        <svg {...ICON_PROPS}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4v18" />
          <path d="M19 21V11l-7-4" />
          <path d="M9 9h.01M9 13h.01M9 17h.01" />
        </svg>
      )
    case "address": // map pin
      return (
        <svg {...ICON_PROPS}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    case "climate": // cloud + sun
      return (
        <svg {...ICON_PROPS}>
          <path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M5.6 17a5 5 0 1 1 9.8-1.5" />
          <path d="M13 22H7a4 4 0 0 1 0-8 5 5 0 0 1 9.7-1.3A3.5 3.5 0 0 1 19 22Z" />
        </svg>
      )
    case "area": // bounded area / ruler
      return (
        <svg {...ICON_PROPS}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 3v3M16 3v3M3 8h3M3 16h3M21 8h-3M21 16h-3M8 21v-3M16 21v-3" />
        </svg>
      )
    case "floors": // layers
      return (
        <svg {...ICON_PROPS}>
          <path d="m12 2 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
      )
    case "units": // door / home
      return (
        <svg {...ICON_PROPS}>
          <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
          <path d="M2 21h20" />
          <path d="M14 12h.01" />
        </svg>
      )
    case "gauge": // assessment result
      return (
        <svg {...ICON_PROPS}>
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 9-9" />
          <path d="m13.4 10.6 2.6-2.6" />
          <circle cx="12" cy="12" r="1.6" />
          <path d="M16 4.5 21 3l-1.5 5" />
        </svg>
      )
    default:
      return null
  }
}

// Per-section PDF reports. A section becomes exportable once its report exists AND the
// tools that report needs have saved results. Extend this map as more section reports
// are implemented (mech/elec/mon/bms + env windows).
const SECTION_REPORTS: Record<
  string,
  { href: (id: string) => string; requiredTools: ToolKey[] }
> = {
  env: { href: (id) => `/reports/env/${id}`, requiredTools: ["env_opaque.html"] },
  mech: { href: (id) => `/reports/checklist/mech/${id}`, requiredTools: ["mech_checklist.html"] },
  elec: { href: (id) => `/reports/checklist/elec/${id}`, requiredTools: ["elec_checklist.html"] },
  mon: { href: (id) => `/reports/checklist/mon/${id}`, requiredTools: ["monitoring_checklist.html"] },
  bms: { href: (id) => `/reports/checklist/bms/${id}`, requiredTools: ["integrated_mgmt.html"] },
}

export default function ProjectDetailClient() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""

  const t = useTranslations("projects")
  const tc = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()

  const projectQuery = useProject(id)
  const assessmentQuery = useAssessment(id)
  const updateProject = useUpdateProject(id)
  const generateReport = useGenerateReport(id)
  const deleteProject = useDeleteProject()

  const [editOpen, setEditOpen] = useState(false)

  const project = (projectQuery.data ?? null) as ProjectDto | null

  // Which checklist tools have saved results — drives per-section export gating.
  const completedTools = useMemo(() => {
    const set = new Set<string>()
    try {
      const rj = assessmentQuery.data?.resultJson
      if (rj) Object.keys(JSON.parse(rj) as Record<string, unknown>).forEach((k) => set.add(k))
    } catch {
      /* ignore malformed resultJson */
    }
    return set
  }, [assessmentQuery.data])

  const handleSave = (input: CreateProjectInput) => {
    updateProject.mutate(input, { onSuccess: () => setEditOpen(false) })
  }

  const handleReport = () => {
    generateReport.mutate(undefined, {
      onSuccess: (res) => {
        if (res?.downloadUrl) window.open(res.downloadUrl, "_blank")
      },
    })
  }

  const handleDelete = () => {
    if (!window.confirm(t("deleteConfirm"))) return
    deleteProject.mutate(id, { onSuccess: () => router.push("/projects") })
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Spinner className="me-2 text-brand-700" />
        {tc("loading")}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{tc("error")}</Alert>
        <Link href="/projects">
          <Button variant="outline">{tc("back")}</Button>
        </Link>
      </div>
    )
  }

  const climateLabel = project.climateCode
    ? M19_CLIMATE_DEFINITIONS[project.climateCode] ?? project.climateCode
    : t("noClimate")

  const num = (n: number | string | null | undefined) =>
    fmt(locale, n == null ? n : Number(n))

  type SpecRow = { label: string; value: string; icon: FieldIcon }

  // Textual facts grouped the way an engineer reads a project header.
  const groups: Array<{ title: string; rows: SpecRow[] }> = [
    {
      title: t("groupIdentity"),
      rows: [
        { label: t("client"), value: project.client || "-", icon: "client" },
        { label: t("usage"), value: project.usage || "-", icon: "usage" },
      ],
    },
    {
      title: t("groupLocation"),
      rows: [
        { label: t("city"), value: project.city || "-", icon: "city" },
        { label: t("address"), value: project.address || "-", icon: "address" },
        { label: t("climateCode"), value: climateLabel, icon: "climate" },
      ],
    },
  ]

  // Numeric facts promoted into prominent metric tiles.
  const metrics: SpecRow[] = [
    { label: t("totalArea"), value: num(project.totalArea), icon: "area" },
    { label: t("floorCount"), value: num(project.floorCount), icon: "floors" },
    { label: t("unitCount"), value: num(project.unitCount), icon: "units" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 18 6-6-6-6" />
              </svg>
              {tc("back")}
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-slate-900">{project.title}</h1>
          {project.buildingGroupLabel ? (
            <Badge tone="brand">{project.buildingGroupLabel}</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${id}/assessment`}>
            <Button variant="outline">{t("assessment")}</Button>
          </Link>
          <Button onClick={handleReport} disabled={generateReport.isPending}>
            {generateReport.isPending ? <Spinner /> : null}
            {generateReport.isPending ? t("generatingReport") : t("report")}
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            {tc("edit")}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending ? <Spinner /> : null}
            {tc("delete")}
          </Button>
        </div>
      </div>

      {updateProject.isError || deleteProject.isError ? (
        <Alert variant="error">{tc("error")}</Alert>
      ) : null}
      {generateReport.isError ? (
        <Alert variant="error">{tc("error")}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-bold text-card-foreground">{t("detail")}</h2>
        </CardHeader>
        <CardBody className="p-0">
          {groups.map((group, gi) => (
            <section
              key={group.title}
              className={gi > 0 ? "border-t border-border" : undefined}
            >
              <h3 className="bg-muted/40 px-6 py-2.5 text-[11px] font-semibold text-muted-foreground">
                {group.title}
              </h3>
              <dl className="divide-y divide-border">
                {group.rows.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-start justify-between gap-4 px-6 py-3.5"
                  >
                    <dt className="flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <FieldGlyph icon={r.icon} />
                      </span>
                      <span className="truncate">{r.label}</span>
                    </dt>
                    <dd className="min-w-0 break-words text-end text-sm font-semibold text-card-foreground">
                      {r.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="border-t border-border">
            <h3 className="bg-muted/40 px-6 py-2.5 text-[11px] font-semibold text-muted-foreground">
              {t("groupGeometry")}
            </h3>
            <dl className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-3">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4"
                >
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="text-primary" aria-hidden>
                      <FieldGlyph icon={m.icon} />
                    </span>
                    {m.label}
                  </dt>
                  <dd className="text-xl font-bold leading-none text-foreground tabular-nums sm:text-2xl">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {project.hasAssessment ? (
            <div className="flex items-center justify-between gap-4 border-t border-border bg-primary/5 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                  aria-hidden
                >
                  <FieldGlyph icon="gauge" />
                </span>
                <span className="text-sm font-medium text-foreground">
                  {t("assessment")}
                </span>
              </div>
              <span dir="ltr" className="tabular-nums">
                <Badge tone="green">
                  {fmt(locale, project.totalScore == null ? project.totalScore : Number(project.totalScore))} / {fmt(locale, project.maxScore == null ? project.maxScore : Number(project.maxScore))}
                </Badge>
              </span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-bold text-card-foreground">{t("sectionReports")}</h2>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {ASSESSMENT_SECTIONS.map((section) => {
              const report = SECTION_REPORTS[section.key]
              const done = section.tools.every((tool) => completedTools.has(tool.toolKey))
              const canExport = report
                ? report.requiredTools.every((tk) => completedTools.has(tk))
                : false
              return (
                <li
                  key={section.key}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: section.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-card-foreground">
                        {section.title}
                      </div>
                      <div className="mt-0.5 text-xs">
                        {done ? (
                          <span className="text-primary">{t("sectionDone")}</span>
                        ) : (
                          <span className="text-muted-foreground">{t("sectionPending")}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {report && canExport ? (
                    <Link href={report.href(id)} target="_blank">
                      <Button variant="outline" size="sm">
                        <svg
                          className="me-1 h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
                        </svg>
                        {t("exportPdf")}
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      {report ? t("sectionIncomplete") : t("sectionComingSoon")}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      <Modal
        title={tc("edit")}
        open={editOpen}
        onClose={() => (updateProject.isPending ? undefined : setEditOpen(false))}
      >
        <ProjectForm
          initial={{
            title: project.title,
            client: project.client ?? undefined,
            address: project.address ?? undefined,
            city: project.city,
            climateCode: project.climateCode,
            totalArea: project.totalArea,
            floorCount: project.floorCount,
            unitCount: project.unitCount,
            usage: project.usage ?? undefined,
          }}
          submitting={updateProject.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  )
}
