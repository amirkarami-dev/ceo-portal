import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { queryKeys } from "@/lib/query-keys"
import { serverApiFetch } from "@/lib/api-server"
import type { Project } from "@/lib/types"
import ProjectsClient from "./projects-client"

// Server Component: prefetch the projects list with the request's session token so the
// client list server-renders with a warm cache (auth is enforced in middleware).
export default async function ProjectsPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: queryKeys.projects,
    queryFn: () => serverApiFetch<Project[]>("/api/Projects"),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectsClient />
    </HydrationBoundary>
  )
}
