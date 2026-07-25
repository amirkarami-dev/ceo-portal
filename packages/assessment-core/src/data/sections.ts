// Section/tool catalog for the assessment workspace.
// Derived from legacy store/mabhas19/data.js (sections + tool maxScores).
// The 6 ported checklists map to the tool `file` keys used as toolKey.

export type ToolKey =
  | "env_opaque.html"
  | "env_trans.html"
  | "mech_checklist.html"
  | "elec_checklist.html"
  | "monitoring_checklist.html"
  | "integrated_mgmt.html"

export interface AssessmentTool {
  toolKey: ToolKey
  name: string
  code: string
  maxScore: number
  ported: boolean
}

export interface AssessmentSection {
  key: string
  title: string
  color: string
  reminder?: string
  tools: AssessmentTool[]
}

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    key: "env",
    title: "پوسته خارجی (معماری)",
    color: "#06b6d4",
    tools: [
      {
        toolKey: "env_opaque.html",
        code: "۱۰۵ امتیاز",
        name: "پوسته خارجی غیر نورگذر (دیوار/سقف)",
        maxScore: 105,
        ported: true,
      },
      {
        toolKey: "env_trans.html",
        code: "۹۳ امتیاز",
        name: "پوسته خارجی نورگذر (پنجره/نما)",
        maxScore: 93,
        ported: true,
      },
    ],
  },
  {
    key: "mech",
    title: "تأسیسات مکانیکی",
    color: "#f97316",
    reminder:
      "چک‌لیست‌های سامانه پایش و مدیریت هوشمند جهت کنترل توسط مهندسان برق و مکانیک ارسال گردند.",
    tools: [
      {
        toolKey: "mech_checklist.html",
        code: "۲۴۰ امتیاز",
        name: "چک‌لیست جامع تأسیسات مکانیکی",
        maxScore: 240,
        ported: true,
      },
    ],
  },
  {
    key: "elec",
    title: "تأسیسات الکتریکی",
    color: "#eab308",
    reminder:
      "چک‌لیست‌های سامانه پایش و مدیریت هوشمند جهت کنترل توسط مهندسان برق و مکانیک ارسال گردند.",
    tools: [
      {
        toolKey: "elec_checklist.html",
        code: "۱۹۶ امتیاز",
        name: "چک‌لیست جامع تأسیسات برقی",
        maxScore: 196,
        ported: true,
      },
    ],
  },
  {
    key: "mon",
    title: "سامانه پایش",
    color: "#8b5cf6",
    tools: [
      {
        toolKey: "monitoring_checklist.html",
        code: "۱۲۰ امتیاز",
        name: "چک‌لیست پایش و زیرپایش",
        maxScore: 120,
        ported: true,
      },
    ],
  },
  {
    key: "bms",
    title: "مدیریت یکپارچه",
    color: "#ec4899",
    tools: [
      {
        toolKey: "integrated_mgmt.html",
        code: "۷۷ امتیاز",
        name: "چک‌لیست مدیریت یکپارچه",
        maxScore: 77,
        ported: true,
      },
    ],
  },
]

export const ALL_TOOLS: AssessmentTool[] = ASSESSMENT_SECTIONS.flatMap((s) => s.tools)

export const TOTAL_MAX_SCORE = ALL_TOOLS.reduce((sum, t) => sum + t.maxScore, 0) // 831

// Shape bubbled up from each checklist via onResult callback.
export interface ToolResult {
  toolKey: ToolKey
  score: number
  maxScore: number
  details?: Record<string, unknown>
}
