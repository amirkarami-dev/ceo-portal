// Central TanStack Query key registry — one source of truth so queries and the
// mutations that invalidate them can never drift apart.
export const queryKeys = {
  subscription: ["subscription"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  assessment: (id: string) => ["projects", id, "assessment"] as const,
}
