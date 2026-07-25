// Shared, framework-agnostic types + helpers for the Mabhas19 scoring engine.
// Consumed by both the web (Next.js) and mobile (Expo/React Native) clients.
// (ToolKey/ToolResult/etc. are re-exported by the package barrel via ./data/sections.)

export interface BuildingMeta {
  totalArea: number
  floorCount: number
  unitCount: number
  city?: string
  usage?: string
}

// Ported verbatim from the legacy checklists/shared helper.
export const toNum = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface ToolScore {
  score: number
  maxScore: number
}
