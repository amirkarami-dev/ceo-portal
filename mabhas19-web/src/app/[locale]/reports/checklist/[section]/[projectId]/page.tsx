"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import {
  buildMechReport,
  buildElecReport,
  buildMonitoringReport,
  buildIntegratedReport,
  type ChecklistReport,
} from "@mabhas19/assessment-core"
import { useAssessment, useProject } from "@/lib/queries"
import { Button, Spinner } from "@/components/ui"
import { ChecklistReportDocument } from "@/features/assessment/report/ChecklistReportDocument"
import { buildReportHeader } from "@/features/assessment/report/buildReportHeader"

// section key (matches ASSESSMENT_SECTIONS / SECTION_REPORTS) → saved tool + builder + title.
const SECTIONS: Record<
  string,
  { toolKey: string; title: string; build: (details: unknown) => ChecklistReport }
> = {
  mech: { toolKey: "mech_checklist.html", title: "تأسیسات مکانیکی", build: (d) => buildMechReport(d as never) },
  elec: { toolKey: "elec_checklist.html", title: "تأسیسات الکتریکی", build: (d) => buildElecReport(d as never) },
  mon: { toolKey: "monitoring_checklist.html", title: "سامانه پایش", build: (d) => buildMonitoringReport(d as never) },
  bms: { toolKey: "integrated_mgmt.html", title: "مدیریت یکپارچه", build: (d) => buildIntegratedReport(d as never) },
}

function parseInputJson(inputJson: string | null | undefined): Record<string, unknown> {
  if (!inputJson) return {}
  try {
    return JSON.parse(inputJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

export default function ChecklistReportPage() {
  const params = useParams<{ section: string; projectId: string }>()
  const sectionKey = params?.section ?? ""
  const projectId = params?.projectId ?? ""
  const t = useTranslations("report")
  const cfg = SECTIONS[sectionKey]

  const projectQuery = useProject(projectId, !!cfg)
  const assessmentQuery = useAssessment(projectId, !!cfg)

  const loading = projectQuery.isLoading || assessmentQuery.isLoading
  const project = projectQuery.data ?? null

  const Toolbar = (
    <div className="report-no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <Link href={`/projects/${projectId}`}>
        <Button variant="ghost" size="sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
          {t("back")}
        </Button>
      </Link>
      <span className="text-sm font-semibold text-foreground">{cfg ? cfg.title : t("title")}</span>
      <Button size="sm" onClick={() => window.print()}>
        <svg className="me-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
        </svg>
        {t("download")}
      </Button>
    </div>
  )

  let body: React.ReactNode

  if (!cfg) {
    body = (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  } else if (loading) {
    body = (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Spinner className="me-2" />
      </div>
    )
  } else if (!project) {
    body = (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    )
  } else {
    const details = parseInputJson(assessmentQuery.data?.inputJson)[cfg.toolKey] ?? null
    const report = cfg.build(details)

    if (report.empty) {
      body = (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <Link
            href={`/projects/${projectId}/assessment`}
            className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
          >
            {t("emptyAction")}
          </Link>
        </div>
      )
    } else {
      body = (
        <div className="px-4 py-6">
          <ChecklistReportDocument header={buildReportHeader(project)} title={cfg.title} report={report} />
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {Toolbar}
      {body}
    </div>
  )
}
