/**
 * Step 3 of the compliance-schedule design: what a *specific project* owes right now.
 *
 * Pure. It takes the two facts that decide the answer — the building group and the date the project
 * started — and returns a shape a panel can render without doing any of this reasoning itself.
 *
 * ## The band is frozen at the project's creation date
 *
 * Not recomputed against today. A building designed and permitted under year-one rules is judged by
 * year-one rules; obligations that grew while it was on site would mean an assessment could turn
 * non-compliant with nobody touching the project. The date is `project.created`, which the API
 * already returns.
 *
 * The other reading — always "what does the regulation demand today" — is a different product rule
 * and is deliberately not what this does. Both are one line apart, so switching is cheap if the
 * ruling body says otherwise.
 */
import {
  ASSESSMENT_SECTIONS,
  type AssessmentSection,
  type ToolKey,
} from "../data/sections"
import {
  BAND_LABELS,
  REQUIREMENTS,
  SCHEDULE_GROUP_LABELS,
  requirementsIn,
  requirementsNotYetIn,
  scheduleGroupOf,
  type ComplianceBand,
  type Requirement,
  type ScheduleGroup,
} from "../data/schedule19"
import { bandStartDate, complianceBandOf, type GregorianDate } from "../data/jalali"

/** Fully required, partly required, or nothing yet. */
export type RequirementState = "required" | "partial" | "not-yet"

export interface ToolRequirement {
  toolKey: ToolKey
  /** The checklist's own name, from the section catalog. */
  toolName: string
  sectionKey: string
  sectionTitle: string
  state: RequirementState
  required: Requirement[]
  notYet: Requirement[]
}

export interface SectionRequirement {
  sectionKey: string
  sectionTitle: string
  color: string
  state: RequirementState
  tools: ToolRequirement[]
}

export interface ProjectRequirements {
  group: ScheduleGroup
  groupLabel: string
  band: ComplianceBand
  bandLabel: string
  /** When this band began, and when the next one does — both Gregorian, for display. */
  bandStart: GregorianDate
  nextBandStart: GregorianDate | null
  sections: SectionRequirement[]
  /**
   * Requirements the app has no checklist for: the three بازرسی stages, the two air-leak figures and
   * انرژی تجدیدپذیر. Returned separately rather than dropped — they are duties too, and a panel that
   * hides them tells an engineer the project is finished when it is not.
   */
  unmapped: { required: Requirement[]; notYet: Requirement[] }
}

function stateOf(required: number, total: number): RequirementState {
  if (required === 0) return "not-yet"
  return required === total ? "required" : "partial"
}

const TOOL_INDEX: Map<ToolKey, { section: AssessmentSection; name: string }> = new Map(
  ASSESSMENT_SECTIONS.flatMap((section) =>
    section.tools.map((tool) => [tool.toolKey, { section, name: tool.name }] as const)
  )
)

/**
 * `null` when the project predates the fifth edition's start date — there is no band, and the caller
 * must say so rather than showing year-one duties for a building the edition never covered.
 */
export function requirementsForProject(input: {
  groupCode: string
  created: string | Date
}): ProjectRequirements | null {
  const created = input.created instanceof Date ? input.created : new Date(input.created)
  if (Number.isNaN(created.getTime())) return null

  const band = complianceBandOf(created)
  if (band === null) return null

  const group = scheduleGroupOf(input.groupCode)
  const required = requirementsIn(group, band)
  const notYet = requirementsNotYetIn(group, band)
  const requiredKeys = new Set(required.map((r) => r.key))

  const sections: SectionRequirement[] = ASSESSMENT_SECTIONS.map((section) => {
    const tools: ToolRequirement[] = section.tools.map((tool) => {
      const own = REQUIREMENTS.filter((r) => r.toolKey === tool.toolKey)
      const req = own.filter((r) => requiredKeys.has(r.key))
      return {
        toolKey: tool.toolKey,
        toolName: tool.name,
        sectionKey: section.key,
        sectionTitle: section.title,
        state: stateOf(req.length, own.length),
        required: req,
        notYet: own.filter((r) => !requiredKeys.has(r.key)),
      }
    })
    const owned = tools.flatMap((t) => t.required.length + t.notYet.length)
    const total = owned.reduce((sum, n) => sum + n, 0)
    const reqCount = tools.reduce((sum, t) => sum + t.required.length, 0)
    return {
      sectionKey: section.key,
      sectionTitle: section.title,
      color: section.color,
      state: stateOf(reqCount, total),
      tools,
    }
  })

  return {
    group,
    groupLabel: SCHEDULE_GROUP_LABELS[group],
    band,
    bandLabel: BAND_LABELS[band],
    bandStart: bandStartDate(band),
    nextBandStart: band < 5 ? bandStartDate((band + 1) as ComplianceBand) : null,
    sections,
    unmapped: {
      required: required.filter((r) => r.toolKey === null),
      notYet: notYet.filter((r) => r.toolKey === null),
    },
  }
}

/** Every checklist, flattened — handy for the assessment workspace, which lists tools not sections. */
export function toolRequirementsOf(model: ProjectRequirements): ToolRequirement[] {
  return model.sections.flatMap((s) => s.tools)
}

/** Whether a given checklist is required at all yet. Used to mark the workspace's section list. */
export function toolStateOf(model: ProjectRequirements, toolKey: ToolKey): RequirementState {
  return toolRequirementsOf(model).find((t) => t.toolKey === toolKey)?.state ?? "not-yet"
}

/** Exposed so a UI can label a tool without re-deriving the catalog. */
export function toolSectionOf(toolKey: ToolKey): AssessmentSection | undefined {
  return TOOL_INDEX.get(toolKey)?.section
}
