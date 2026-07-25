"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import { Link } from "@/i18n/navigation"
import { useProjects } from "@/lib/queries"
import { useAuth } from "@/lib/auth-context"
import type { ProjectDto } from "@/components/projects/project-types"
import { DashboardHero } from "@/components/dashboard/dashboard-hero"
import { Alert, Badge } from "@/components/ui"

const NO_PROJECTS: ProjectDto[] = []

const SVG = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

const Icons = {
  building: (
    <svg {...SVG}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4v18" />
      <path d="M19 21V11l-7-4" />
      <path d="M9 9h.01M9 13h.01M9 17h.01" />
    </svg>
  ),
  gauge: (
    <svg {...SVG}>
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 9-9" />
      <path d="m13.4 10.6 2.6-2.6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M16 4.5 21 3l-1.5 5" />
    </svg>
  ),
  area: (
    <svg {...SVG}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 3v3M16 3v3M3 8h3M3 16h3M21 8h-3M21 16h-3M8 21v-3M16 21v-3" />
    </svg>
  ),
  trend: (
    <svg {...SVG}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M17 8h4v4" />
    </svg>
  ),
  chevron: (
    <svg {...SVG}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
}

function fmt(locale: string, n: number | string | null | undefined): string {
  if (n == null || n === "") return "—"
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(v)
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  variants,
}: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  variants: Variants
}) {
  return (
    <motion.div variants={variants} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:size-[18px]">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold leading-none text-foreground tabular-nums sm:text-[28px]">{value}</span>
        {suffix ? <span className="text-xs font-medium text-muted-foreground">{suffix}</span> : null}
      </div>
    </motion.div>
  )
}

function RecentRow({
  project,
  locale,
  variants,
}: {
  project: ProjectDto
  locale: string
  variants: Variants
}) {
  const tp = useTranslations("projects")
  const score = project.totalScore == null ? null : Number(project.totalScore)
  const max = project.maxScore == null ? null : Number(project.maxScore)
  return (
    <motion.li
      variants={variants}
      className="group relative flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-[18px]">
        {Icons.building}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${project.id}`}
          className="block truncate rounded-sm text-sm font-semibold text-card-foreground outline-none after:absolute after:inset-0 hover:text-primary"
        >
          {project.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {project.city ? <span className="truncate">{project.city}</span> : null}
          {project.buildingGroupLabel ? <Badge tone="brand">{project.buildingGroupLabel}</Badge> : null}
        </div>
      </div>
      {project.hasAssessment && score != null ? (
        <span dir="ltr" className="shrink-0 tabular-nums">
          <Badge tone="green">
            {fmt(locale, score)} / {fmt(locale, max)}
          </Badge>
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{tp("notAssessed")}</span>
      )}
      <span aria-hidden className="shrink-0 text-muted-foreground/50 flip-x [&>svg]:size-4">{Icons.chevron}</span>
    </motion.li>
  )
}

function RecentSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {["a", "b", "c", "d"].map((k) => (
        <li key={k} className="flex animate-pulse items-center gap-3 px-5 py-3.5">
          <div className="size-9 shrink-0 rounded-lg bg-muted" />
          <div className="flex-1">
            <div className="h-3.5 w-2/5 rounded bg-muted" />
            <div className="mt-2 h-3 w-1/5 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </li>
      ))}
    </ul>
  )
}

export default function DashboardClient() {
  const t = useTranslations("dashboard")
  const tc = useTranslations("common")
  const locale = useLocale()
  const reduce = useReducedMotion()
  const { user } = useAuth()

  const projectsQuery = useProjects()
  const projects = (projectsQuery.data ?? NO_PROJECTS) as ProjectDto[]

  const stats = useMemo(() => {
    const assessed = projects.filter((p) => p.hasAssessment)
    const area = projects.reduce((sum, p) => sum + (Number(p.totalArea) || 0), 0)
    const pcts = assessed
      .map((p) => {
        const mx = Number(p.maxScore) || 0
        return mx > 0 ? Number(p.totalScore) / mx : 0
      })
      .filter((x) => x > 0)
    const avg = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) : null
    return { total: projects.length, assessed: assessed.length, area, avg }
  }, [projects])

  const recent = useMemo(
    () => [...projects].sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")).slice(0, 5),
    [projects]
  )

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.05 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.4, ease: "easeOut" } },
  }

  return (
    <div className="space-y-6">
      <DashboardHero email={user?.email} />

      {projectsQuery.isError ? <Alert variant="error">{tc("error")}</Alert> : null}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard variants={item} icon={Icons.building} label={t("totalProjects")} value={fmt(locale, stats.total)} />
        <StatCard variants={item} icon={Icons.gauge} label={t("assessed")} value={fmt(locale, stats.assessed)} />
        <StatCard variants={item} icon={Icons.area} label={t("totalArea")} value={fmt(locale, stats.area)} suffix="m²" />
        <StatCard
          variants={item}
          icon={Icons.trend}
          label={t("avgScore")}
          value={stats.avg == null ? "—" : fmt(locale, stats.avg)}
          suffix={stats.avg == null ? undefined : "٪"}
        />
      </motion.div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold text-card-foreground">{t("recentProjects")}</h2>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t("viewAll")}
            <span aria-hidden className="flip-x [&>svg]:size-3.5">{Icons.chevron}</span>
          </Link>
        </div>

        {projectsQuery.isLoading ? (
          <RecentSkeleton />
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary [&>svg]:size-6">
              {Icons.building}
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">{t("noProjects")}</p>
            <Link
              href="/projects"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t("createFirst")}
            </Link>
          </div>
        ) : (
          <motion.ul variants={container} initial="hidden" animate="show" className="divide-y divide-border">
            {recent.map((p) => (
              <RecentRow key={p.id} project={p} locale={locale} variants={item} />
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  )
}
