import { M19_CLIMATE_DEFINITIONS } from "@/features/assessment/data/climate"
import { faInt } from "./format"
import type { EnvReportHeader } from "./ReportHeader"

// The subset of ProjectDto the report header needs.
export interface ReportProject {
  title?: string
  client?: string | null
  usage?: string | null
  city?: string
  climateCode?: string
  totalArea?: number | string | null
  floorCount?: number | string | null
  unitCount?: number | string | null
  deed?: string | null
  parcel?: string | null
  systemId?: string | null
  buildingGroupLabel?: string
  buildingGroupCode?: string
}

/** Compose the shared report header (identity grid) from a project. */
export function buildReportHeader(project: ReportProject): EnvReportHeader {
  const climateCode = project.climateCode || "3B"
  const num = (n: number | string | null | undefined) => (n == null ? "-" : faInt(Number(n)))
  return {
    projectTitle: project.title || "-",
    climateCode,
    climateLabel: M19_CLIMATE_DEFINITIONS[climateCode] ?? "",
    client: project.client || "-",
    usage: project.usage || "-",
    totalArea: num(project.totalArea),
    floorCount: num(project.floorCount),
    unitCount: num(project.unitCount),
    deed: project.deed || "-",
    parcel: project.parcel || "-",
    systemId: project.systemId || "-",
    buildingGroup: project.buildingGroupLabel || project.buildingGroupCode || "-",
  }
}
