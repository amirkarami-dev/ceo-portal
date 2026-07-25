// ---------- Presentation (verbatim from spec §5.2) ----------
export interface Presentation {
  /** default active view (index or id) when multiple views exist. */
  defaultView?: number | string;
  views: ReportView[];
  /** export defaults — overridable per export call. */
  export?: ExportConfig;
}

export interface ReportView {
  id?: string;
  type: ViewType; // Table | KPI | Chart | DashboardWidget
  library: ViewLibrary; // antd | recharts | echarts | grid
  component: string; // concrete renderer, e.g. "LineChart"
  title?: string;
  mapping: ViewMapping; // how columns/metrics bind to the view
  options?: Record<string, unknown>; // renderer-specific opts (colors, etc.)
}

export type ViewType = "table" | "kpi" | "chart" | "dashboardWidget";

/** STRICT RULE encoded in types: charts NEVER use antd; dashboard layout
 *  NEVER uses antd; tables/KPI/forms use antd. */
export type ViewLibrary = "antd" | "recharts" | "echarts" | "grid";

export interface ViewMapping {
  /** Table: which columns to show (defaults to all visible columns). */
  columns?: string[];
  /** Chart axes. */
  x?: string; // category / time axis field
  y?: string | string[]; // one or more measure/metric aliases
  series?: string; // field to split into multiple series
  /** KPI cards: metric alias → card. */
  value?: string; // metric/calc alias shown big
  comparison?: string; // optional delta field
  /** Pie/donut. */
  category?: string;
  measure?: string;
}

export interface ExportConfig {
  formats?: ExportFormat[]; // which exports are offered
  fileName?: string; // base name (localized ok)
  pdf?: { orientation?: "portrait" | "landscape"; title?: string; logo?: boolean };
  excel?: { sheetName?: string; freezeHeader?: boolean };
}

export type ExportFormat = "pdf" | "excel" | "csv" | "json";
