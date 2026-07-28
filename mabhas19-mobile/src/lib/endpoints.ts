import { apiFetch } from "./api"
import type {
  Assessment,
  CreateProjectInput,
  CurrentUser,
  Project,
  Subscription,
} from "./types"

export const authApi = {
  me: () => apiFetch<CurrentUser>("/api/Users/me"),
}

export const subscriptionApi = {
  me: () => apiFetch<Subscription>("/api/Subscriptions/me"),
}

export const projectsApi = {
  list: () => apiFetch<Project[]>("/api/Projects"),
  get: (id: string) => apiFetch<Project>(`/api/Projects/${id}`),
  create: (input: CreateProjectInput) =>
    apiFetch<{ id: string }>("/api/Projects", { method: "POST", body: input }),
  update: (id: string, input: Partial<CreateProjectInput>) =>
    apiFetch(`/api/Projects/${id}`, { method: "PUT", body: input }),
  remove: (id: string) => apiFetch(`/api/Projects/${id}`, { method: "DELETE" }),
  getAssessment: (id: string) => apiFetch<Assessment>(`/api/Projects/${id}/assessment`),
  saveAssessment: (id: string, assessment: Assessment) =>
    apiFetch(`/api/Projects/${id}/assessment`, { method: "PUT", body: assessment }),
  report: (id: string) =>
    apiFetch<{ downloadUrl: string }>(`/api/Projects/${id}/report`, { method: "POST" }),
  importProject: (source: string, externalId: string) =>
    apiFetch<{ id: string }>("/api/Projects/import", {
      method: "POST",
      body: { source, externalId },
    }),
}
