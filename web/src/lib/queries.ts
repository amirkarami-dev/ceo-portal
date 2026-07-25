"use client"

// TanStack Query hooks over the existing endpoints.ts transport. Components use these
// instead of hand-rolling useState/useEffect fetches; mutations invalidate the relevant
// query keys so lists stay fresh automatically.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { projectsApi, subscriptionApi } from "./endpoints"
import { ApiError } from "./api"
import { queryKeys } from "./query-keys"
import type { Assessment, CreateProjectInput } from "./types"

// ---------------------------------------------------------------- Queries ----
// (Identity / currentUser is now resolved server-side from the session, not fetched here.)

export function useSubscription(enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => subscriptionApi.me(),
    enabled,
  })
}

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
    enabled,
  })
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => projectsApi.get(id),
    enabled: enabled && !!id,
  })
}

export function useAssessment(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.assessment(projectId),
    queryFn: async () => {
      try {
        return await projectsApi.getAssessment(projectId)
      } catch (err) {
        // A 404 means no assessment has been saved yet — start fresh, not an error.
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    enabled: enabled && !!projectId,
  })
}

// -------------------------------------------------------------- Mutations ----

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects })    },
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreateProjectInput>) =>
      projectsApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.project(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.projects })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects })    },
  })
}

export function useImportProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      source,
      externalId,
    }: {
      source: string
      externalId: string
    }) => projectsApi.importProject(source, externalId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects })    },
  })
}

export function useGenerateReport(id: string) {
  // No cached state changes — returns a fresh presigned download URL.
  return useMutation({
    mutationFn: () => projectsApi.report(id),
  })
}

export function useSaveAssessment(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assessment: Assessment) =>
      projectsApi.saveAssessment(projectId, assessment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.assessment(projectId) })
      void qc.invalidateQueries({ queryKey: queryKeys.project(projectId) })
    },
  })
}

// NOTE: Admin user/subscription hooks were removed — user management now lives in the
// separate admin app (admin.myceo.ir); the API's /api/Admin/* endpoints were deleted.
