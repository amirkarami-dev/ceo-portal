// Ported verbatim from legacy checklists/utils.js — calcBuildingGroup logic MUST stay exact.

export const GROUP_ORDER = ["A", "B", "Bp", "C", "Cp", "Cpp", "D"] as const

export type GroupCode = (typeof GROUP_ORDER)[number]

export const GROUP_LABELS: Record<GroupCode, string> = {
  A: "الف",
  B: "ب",
  Bp: "ب+",
  C: "ج",
  Cp: "ج+",
  Cpp: "ج++",
  D: "د",
}

export const calcBuildingGroup = ({
  area = 0,
  floors = 0,
  units = 0,
}: {
  area?: number | null
  floors?: number | null
  units?: number | null
}): { code: GroupCode; label: string } => {
  const areaNum = Number(area) || 0
  const floorNum = Number(floors) || 0
  const unitNum = Number(units) || 0

  if (floorNum > 10 || areaNum > 5000) {
    return { code: "D", label: GROUP_LABELS.D }
  }

  if ((floorNum >= 6 && floorNum <= 10) || (areaNum > 2000 && areaNum <= 5000)) {
    if (unitNum > 30) {
      if (areaNum < 3000) {
        return { code: "Cp", label: GROUP_LABELS.Cp }
      }
      return { code: "Cpp", label: GROUP_LABELS.Cpp }
    }
    return { code: "C", label: GROUP_LABELS.C }
  }

  if ((floorNum >= 3 && floorNum <= 5) || (areaNum > 600 && areaNum <= 2000)) {
    if (unitNum > 30) {
      return { code: "Bp", label: GROUP_LABELS.Bp }
    }
    return { code: "B", label: GROUP_LABELS.B }
  }

  if (floorNum <= 2 && areaNum <= 600) {
    return { code: "A", label: GROUP_LABELS.A }
  }

  return { code: "B", label: GROUP_LABELS.B }
}

export const getGroupIndex = (code: string): number =>
  GROUP_ORDER.indexOf(code as GroupCode)

export const toPersianDigits = (value: number | string): string =>
  new Intl.NumberFormat("fa-IR").format(Number(value))
