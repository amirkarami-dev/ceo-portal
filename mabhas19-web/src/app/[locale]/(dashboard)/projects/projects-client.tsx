"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import { useCreateProject, useDeleteProject, useProjects } from "@/lib/queries"
import { ApiError } from "@/lib/api"
import type { CreateProjectInput } from "@/lib/types"
import type { ProjectDto } from "@/components/projects/project-types"
import { ProjectForm } from "@/components/projects/project-form"
import { Modal } from "@/components/projects/modal"
import { ProjectCard } from "@/components/projects/project-card"
import { ProjectsHero } from "@/components/projects/projects-hero"
import { Alert, Button } from "@/components/ui"

// Stable empty-array reference so an empty `projects` doesn't change identity each render
// (which would otherwise re-run the stats useMemo on every render).
const NO_PROJECTS: ProjectDto[] = []

// Pull a Subscription-limit message out of an ApiError body (400 with errors.Subscription)
function extractSubscriptionError(err: unknown): string | null {
  if (err instanceof ApiError && err.status === 400) {
    const body = err.body as { errors?: { Subscription?: string[] } } | null
    const msgs = body?.errors?.Subscription
    if (Array.isArray(msgs) && msgs.length) return msgs.join(" ")
  }
  return null
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {["a", "b", "c", "d", "e", "f"].map((k) => (
        <div key={k} className="animate-pulse overflow-hidden rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
          </div>
          <div className="mt-4 h-8 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  const t = useTranslations("projects")
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4v18" />
          <path d="M19 21V11l-7-4" />
          <path d="M9 9h.01M9 13h.01M9 17h.01" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{t("empty")}</p>
      <Button className="mt-5" onClick={onNew}>
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("newProject")}
      </Button>
    </div>
  )
}

export default function ProjectsClient() {
  const t = useTranslations("projects")
  const tc = useTranslations("common")
  const reduce = useReducedMotion()

  const projectsQuery = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const projects = (projectsQuery.data ?? NO_PROJECTS) as ProjectDto[]
  // Single delete is in flight at a time; derive the busy row from the mutation.
  const deletingId = deleteProject.isPending ? String(deleteProject.variables) : null

  const stats = useMemo(() => {
    const assessed = projects.filter((p) => p.hasAssessment).length
    const area = projects.reduce((sum, p) => sum + (Number(p.totalArea) || 0), 0)
    return { total: projects.length, assessed, area }
  }, [projects])

  const openCreate = () => {
    setCreateError(null)
    setCreateOpen(true)
  }

  const handleCreate = (input: CreateProjectInput) => {
    setCreateError(null)
    createProject.mutate(input, {
      onSuccess: () => setCreateOpen(false),
      onError: (err) => setCreateError(extractSubscriptionError(err) ?? tc("error")),
    })
  }

  const handleDelete = (id: string | number) => {
    if (!window.confirm(t("deleteConfirm"))) return
    deleteProject.mutate(String(id))
  }

  const gridContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.04 } },
  }

  return (
    <div className="space-y-6">
      <ProjectsHero total={stats.total} assessed={stats.assessed} totalArea={stats.area} onNew={openCreate} />

      {projectsQuery.isError || deleteProject.isError ? <Alert variant="error">{tc("error")}</Alert> : null}

      {projectsQuery.isLoading ? (
        <SkeletonGrid />
      ) : projects.length === 0 ? (
        <EmptyState onNew={openCreate} />
      ) : (
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              deleting={deletingId === String(p.id)}
              onDelete={() => handleDelete(p.id!)}
            />
          ))}
        </motion.div>
      )}

      <Modal
        title={t("createTitle")}
        open={createOpen}
        onClose={() => (createProject.isPending ? undefined : setCreateOpen(false))}
      >
        {createError ? (
          <Alert variant="error" className="mb-4">
            {createError}
          </Alert>
        ) : null}
        <ProjectForm submitting={createProject.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>
    </div>
  )
}
