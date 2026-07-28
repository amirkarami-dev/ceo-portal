"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Badge, Button, Spinner } from "@/components/ui"
import type { ProjectDto } from "@/components/projects/project-types"

const SVG = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

// One coherent hand-rolled stroke-icon family (this repo has no icon dependency).
const Icons = {
  city: (
    <svg {...SVG}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4v18" />
      <path d="M19 21V11l-7-4" />
      <path d="M9 9h.01M9 13h.01M9 17h.01" />
    </svg>
  ),
  climate: (
    <svg {...SVG}>
      <path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M5.6 17a5 5 0 1 1 9.8-1.5" />
      <path d="M13 22H7a4 4 0 0 1 0-8 5 5 0 0 1 9.7-1.3A3.5 3.5 0 0 1 19 22Z" />
    </svg>
  ),
  area: (
    <svg {...SVG}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 3v3M16 3v3M3 8h3M3 16h3M21 8h-3M21 16h-3M8 21v-3M16 21v-3" />
    </svg>
  ),
  floors: (
    <svg {...SVG}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  ),
  units: (
    <svg {...SVG}>
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
      <path d="M2 21h20" />
      <path d="M14 12h.01" />
    </svg>
  ),
  imported: (
    <svg {...SVG}>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  trash: (
    <svg {...SVG}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
}

function fmt(locale: string, n: number | string | null | undefined): string {
  if (n == null || n === "") return "—"
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(v)
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
        <span className="text-primary [&>svg]:size-3.5">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[15px] font-bold leading-none text-foreground tabular-nums">{value}</span>
    </div>
  )
}

// Assessment score as a token-themed progress ring (works in light + dark via CSS vars).
function ScoreRing({ pct }: { pct: number }) {
  const r = 16
  const c = 2 * Math.PI * r
  const dash = c * Math.max(0, Math.min(1, pct))
  return (
    <svg viewBox="0 0 40 40" className="size-10 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--muted)" strokeWidth="3.5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
      />
    </svg>
  )
}

export function ProjectCard({
  project,
  deleting,
  onDelete,
}: {
  project: ProjectDto
  deleting: boolean
  onDelete: () => void
}) {
  const t = useTranslations("projects")
  const tc = useTranslations("common")
  const locale = useLocale()
  const reduce = useReducedMotion()

  const isImported = (project.source ?? "").toLowerCase().includes("fars")
  const score = project.totalScore == null ? null : Number(project.totalScore)
  const max = project.maxScore == null ? null : Number(project.maxScore)
  const pct = score != null && max != null && max > 0 ? score / max : 0

  // initial/animate VALUES stay constant (SSR-safe); only the transition timing and the
  // client-only hover are gated on reduced-motion — neither affects the hydrated DOM.
  const variants: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.4, ease: "easeOut" } },
  }

  return (
    <motion.article
      variants={variants}
      whileHover={reduce ? undefined : { y: -4 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-primary/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-ring/60"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary to-primary/30" />

      <div className="flex flex-1 flex-col gap-3.5 p-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-snug">
              <Link
                href={`/projects/${project.id}`}
                className="line-clamp-2 rounded-sm outline-none after:absolute after:inset-0 hover:text-primary"
              >
                {project.title}
              </Link>
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/80 [&>svg]:size-3.5">{Icons.city}</span>
                {project.city || "—"}
              </span>
              {project.climateCode ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground/80 [&>svg]:size-3.5">{Icons.climate}</span>
                  {project.climateCode}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {project.buildingGroupLabel ? <Badge tone="brand">{project.buildingGroupLabel}</Badge> : null}
            {isImported ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                <span className="[&>svg]:size-3">{Icons.imported}</span>
                {t("sourceFars")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={Icons.area} label={t("areaShort")} value={fmt(locale, project.totalArea)} />
          <Metric icon={Icons.floors} label={t("floorsShort")} value={fmt(locale, project.floorCount)} />
          <Metric icon={Icons.units} label={t("unitsShort")} value={fmt(locale, project.unitCount)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3">
        {project.hasAssessment && score != null ? (
          <div className="flex items-center gap-2.5">
            <div className="relative grid place-items-center">
              <ScoreRing pct={pct} />
              <span className="absolute text-[10px] font-bold text-foreground tabular-nums">
                {fmt(locale, Math.round(pct * 100))}
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-[10.5px] text-muted-foreground">{t("assessment")}</div>
              <div dir="ltr" className="text-end text-sm font-bold text-foreground tabular-nums">
                {fmt(locale, score)} / {fmt(locale, max)}
              </div>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/40" />
            {t("notAssessed")}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={tc("delete")}
          className="relative z-10 size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? <Spinner /> : Icons.trash}
        </Button>
      </div>
    </motion.article>
  )
}
