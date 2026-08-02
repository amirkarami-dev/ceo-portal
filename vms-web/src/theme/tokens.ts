import { theme, type ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark";

/**
 * Brand palette. Primary is a deliberate indigo/blue (NOT the emerald of the
 * citizen-facing mabhas19 app): this dashboard is dense with green=success /
 * red=failed status indicators, so a green brand color would muddy that signal.
 * Blue reads as "system/infrastructure", which fits a background-job monitor.
 */
const BRAND = {
  primary: "#2563EB",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
} as const;

/** AntD theme config for the given mode (light/dark), shared across the app. */
export function buildTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === "dark";
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND.primary,
      colorSuccess: BRAND.success,
      colorWarning: BRAND.warning,
      colorError: BRAND.error,
      colorInfo: BRAND.primary,
      borderRadius: 10,
      fontFamily:
        "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      colorBgLayout: isDark ? "#0b1220" : "#f4f6fb",
    },
    components: {
      Layout: {
        headerBg: isDark ? "#0f172a" : "#ffffff",
        siderBg: isDark ? "#0f172a" : "#ffffff",
        bodyBg: isDark ? "#0b1220" : "#f4f6fb",
        headerHeight: 64,
        headerPadding: "0 16px",
      },
      Card: { borderRadiusLG: 14 },
      Menu: { itemBorderRadius: 8 },
      Table: { borderRadiusLG: 12 },
    },
  };
}

/** Tone accent that adapts to the theme (brighter variants on dark for contrast). */
export function toneColor(
  mode: ThemeMode,
  tone: "success" | "error" | "warning" | "primary" | "muted",
): string {
  const isDark = mode === "dark";
  switch (tone) {
    case "success":
      return isDark ? "#4ADE80" : "#16A34A";
    case "error":
      return isDark ? "#F87171" : "#DC2626";
    case "warning":
      return isDark ? "#FBBF24" : "#D97706";
    case "primary":
      return isDark ? "#60A5FA" : "#2563EB";
    case "muted":
      return isDark ? "#94A3B8" : "#64748B";
  }
}

/** Soft tinted background for a KPI tile of the given tone. */
export function toneSurface(mode: ThemeMode, tone: "success" | "error" | "muted"): string {
  const isDark = mode === "dark";
  switch (tone) {
    case "success":
      return isDark ? "rgba(74,222,128,0.12)" : "rgba(22,163,74,0.08)";
    case "error":
      return isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.07)";
    case "muted":
      return isDark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.07)";
  }
}

/** ECharts palette that adapts to the theme. */
export function chartColors(mode: ThemeMode) {
  const isDark = mode === "dark";
  return {
    success: isDark ? "#4ADE80" : "#16A34A",
    error: isDark ? "#F87171" : "#DC2626",
    axis: isDark ? "#94a3b8" : "#64748b",
    split: isDark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.14)",
    text: isDark ? "#e2e8f0" : "#1e293b",
    tooltipBg: isDark ? "#1e293b" : "#ffffff",
    tooltipText: isDark ? "#e2e8f0" : "#1e293b",
  };
}
