import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark";
export interface BrandTokens {
  primary: string;
  accent?: string;
}

/** Extends ThemeConfig with the direction hint consumed by ThemeProvider / ConfigProvider */
export type AntdThemeConfig = ThemeConfig & { direction: "rtl" | "ltr" };

export const tokens = {
  primary: "#10b981", // emerald brand
  accent: "#0ea5e9",
  radius: 10,
  fontFa: "'Vazirmatn', system-ui, sans-serif",
  fontEn: "'Inter', system-ui, sans-serif",
} as const;

const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

export function buildAntdTheme(mode: ThemeMode, brand: BrandTokens, dir: "rtl" | "ltr"): AntdThemeConfig {
  const primary = brand.primary || tokens.primary;
  return {
    direction: dir,
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorInfo: primary,
      borderRadius: tokens.radius,
      fontFamily: dir === "rtl" ? tokens.fontFa : tokens.fontEn,
    },
    components: {
      Table: { headerBg: "var(--rw-surface-2)" },
      Card: { paddingLG: 20 },
      Layout: { headerBg: "var(--rw-surface-1)", siderBg: "var(--rw-surface-1)" },
      Menu: { itemBg: "transparent" },
    },
  };
}

export function buildEChartsTheme(mode: ThemeMode, brand: BrandTokens): Record<string, unknown> {
  const p = brand.primary || tokens.primary;
  const a = brand.accent || tokens.accent;
  return {
    color: [p, a, lighten(p, 40), lighten(a, 40), "#f59e0b", "#ef4444"],
    backgroundColor: "transparent",
    textStyle: { fontFamily: tokens.fontFa, color: mode === "dark" ? "#e5e7eb" : "#1f2937" },
    legend: { textStyle: { color: mode === "dark" ? "#e5e7eb" : "#1f2937" } },
  };
}

export function applyCssVars(mode: ThemeMode, brand: BrandTokens): void {
  const el = document.documentElement;
  const primary = brand.primary || tokens.primary;
  el.setAttribute("data-theme", mode);
  el.style.setProperty("--rw-primary", primary);
  el.style.setProperty("--rw-accent", brand.accent ?? tokens.accent);
  if (mode === "dark") {
    el.style.setProperty("--rw-bg", "#0b0f14");
    el.style.setProperty("--rw-surface-1", "#111827");
    el.style.setProperty("--rw-surface-2", "#1f2937");
    el.style.setProperty("--rw-text", "#e5e7eb");
    el.style.setProperty("--rw-border", "#27303a");
  } else {
    el.style.setProperty("--rw-bg", "#f8fafc");
    el.style.setProperty("--rw-surface-1", "#ffffff");
    el.style.setProperty("--rw-surface-2", "#f1f5f9");
    el.style.setProperty("--rw-text", "#1f2937");
    el.style.setProperty("--rw-border", "#e2e8f0");
  }
}
