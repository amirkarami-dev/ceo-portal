import type { Project } from "@/lib/types"

/**
 * The shared Project type already mirrors the .NET ProjectDto. This alias keeps
 * dashboard pages decoupled in case extra view-model fields are added later.
 */
export type ProjectDto = Project
