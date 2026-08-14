import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";
import { primaryInkFor, primary as brandPrimary } from "./tokens";

export type ThemeMode = "light" | "dark";
export interface BrandTokens {
  primary: string;
  accent?: string;
}

/** Extends ThemeConfig with the direction hint consumed by ThemeProvider / ConfigProvider */
export type AntdThemeConfig = ThemeConfig & { direction: "rtl" | "ltr" };

export const tokens = {
  // The brand blue. This is the value that actually reaches antd: ThemeProvider merges
  // buildAntdTheme's token ON TOP of tokens.ts, so colorPrimary here wins over lightTokens /
  // darkTokens. Keep it equal to `primary` in tokens.ts.
  primary: brandPrimary,
  accent: "#06B5F8", // the palette's cyan
  radius: 10,
  fontFa: "'Vazirmatn', system-ui, sans-serif",
  fontEn: "'Inter', system-ui, sans-serif",
} as const;

export function buildAntdTheme(mode: ThemeMode, brand: BrandTokens, dir: "rtl" | "ltr"): AntdThemeConfig {
  const primary = brand.primary || tokens.primary;
  // antd paints primary *text* and borders from this token, not only fills — a link, a selected
  // menu word, the focus ring. On the dark panel the brand blue is 3.67:1: fine for a fill, under
  // AA for a word. The default brand keeps a lifted twin for exactly that surface. A tenant's own
  // colour is used as given; we cannot guess how they want it adjusted.
  const primaryForMode = primary === tokens.primary ? primaryInkFor(mode) : primary;
  return {
    direction: dir,
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primaryForMode,
      colorInfo: primaryForMode,
      borderRadius: tokens.radius,
      fontFamily: dir === "rtl" ? tokens.fontFa : tokens.fontEn,
    },
    components: {
      Table: { headerBg: "var(--rw-surface-2)" },
      Card: { paddingLG: 20 },
      Layout: { headerBg: "var(--rw-surface-1)", siderBg: "var(--rw-surface-1)" },
      Menu: { itemBg: "transparent" },
      // Every tab strip in the app, not just the dashboards ones. The brand green is
      // 2.54:1 as a label on a light panel; the deeper green is 5.48. On the dark panel
      // the deeper green is the unreadable one, so the value follows the mode. antd owns
      // this colour through the token — CSS overrides of it lose, however specific.
      Tabs: {
        itemSelectedColor: primaryInkFor(mode),
        itemHoverColor: primaryInkFor(mode),
        inkBarColor: primaryInkFor(mode),
      },
      // antd labels a Descriptions row with the *tertiary* text colour, which is 45%
      // alpha in both themes: 3.35:1 on the white panel, 4.39 on the dark one. Both are
      // under the 4.5 a 14px label needs, and «مالک» / «مدل داده» are the words that say
      // what the value beside them means. The secondary colour is the same grey family
      // one step darker — 6.9:1 and 7.67:1. Same token that made the sidebar divider
      // vanish; 45% alpha is simply too little for text.
      Descriptions: {
        labelColor: mode === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)",
      },
    },
  };
}

/**
 * The ECharts theme lives in `theme/echarts-theme.ts` and is applied by the charts themselves.
 *
 * There used to be a `buildEChartsTheme` here that **nothing called** — only its own tests. It
 * invented series 3 and 4 by lightening the brand a fixed amount, so it looked like ECharts was
 * centrally themed while every real chart set its colours by hand or took ECharts' defaults.
 * A theme builder that no chart consumes is worse than none: it answers the question wrongly.
 */

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
