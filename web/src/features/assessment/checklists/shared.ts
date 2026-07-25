// Shared types/helpers for the ported Mabhas19 checklist components.

import type { ToolResult } from "../data/sections"

export interface BuildingMeta {
  totalArea: number
  floorCount: number
  unitCount: number
  city?: string
  usage?: string
}

export interface ChecklistProps {
  meta: BuildingMeta
  climateCode: string
  initial?: Record<string, unknown>
  onResult: (r: ToolResult) => void
}

export const toNum = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Stable-ish id generator (legacy used Date.now()+random).
export const genId = (): string => `${Date.now()}_${Math.random().toString(36).slice(2)}`

// Small status pill used across checklists.
export const passPillClass = (pass: boolean): string =>
  pass
    ? "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
    : "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
