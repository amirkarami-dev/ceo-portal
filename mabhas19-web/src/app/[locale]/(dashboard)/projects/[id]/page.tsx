import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { queryKeys } from "@/lib/query-keys"
import { serverApiFetch } from "@/lib/api-server"
import type { Project } from "@/lib/types"
import ProjectDetailClient from "./project-detail-client"

// Server Component: prefetch this project with the request's session token so the detail
// view server-renders with data (auth enforced in middleware).
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => serverApiFetch<Project>(`/api/Projects/${id}`),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectDetailClient />
    </HydrationBoundary>
  )
}
