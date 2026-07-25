import { theme as antdTheme, type ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark";

/** localStorage key the light/dark choice is persisted under. */
export const THEME_STORAGE_KEY = "landing-panel-theme";

const radius = { borderRadius: 8, borderRadiusLG: 12 } as const;
const typography = {
  fontFamily: "Vazirmatn, -apple-system, Segoe UI, sans-serif",
  fontSize: 14,
} as const;

export const sharedToken = { ...radius, ...typography, wireframe: false } as const;

export const lightTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#0f6e56",
  colorInfo: "#0f6e56",
  colorBgLayout: "#f6f8f7",
  colorBgContainer: "#ffffff",
  colorBorderSecondary: "#ebece9",
};

export const darkTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#1d9e75",
  colorInfo: "#1d9e75",
  colorBgLayout: "#0e1513",
  colorBgContainer: "#15211d",
  colorBorderSecondary: "#1d2a26",
};

/** The single source of truth for the AntD theme. Mirrors analytics-web/src/theme/tokens.ts. */
export function buildTheme(mode: ThemeMode): ThemeConfig {
  return {
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: mode === "dark" ? darkTokens : lightTokens,
    components: {
      Layout: {
        headerBg: mode === "dark" ? "#15211d" : "#ffffff",
        siderBg: mode === "dark" ? "#15211d" : "#ffffff",
        headerPadding: "0 16px",
        headerHeight: 56,
      },
      Menu: { itemBg: "transparent" },
    },
    cssVar: true,
  };
}

/** Reads the persisted mode; falls back to light when storage is unavailable. */
export function loadThemeMode(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private browsing — the choice just won't survive a reload */
  }
}
