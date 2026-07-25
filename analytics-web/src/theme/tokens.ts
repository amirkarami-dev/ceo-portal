import { theme as antdTheme, type ThemeConfig } from "antd";

const radius = { borderRadius: 8, borderRadiusLG: 12 } as const;
const typography = { fontFamily: "Vazirmatn, -apple-system, Segoe UI, sans-serif", fontSize: 14 } as const;

export const sharedToken = { ...radius, ...typography, wireframe: false } as const;

export const lightTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#0f6e56",
  colorBgLayout: "#f7f8f8",
  colorBgContainer: "#ffffff",
  colorBorderSecondary: "#ebece9",
};

export const darkTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#1d9e75",
  colorBgLayout: "#0e1513",
  colorBgContainer: "#15211d",
  colorBorderSecondary: "#1d2a26",
};

export function buildTheme(mode: "light" | "dark"): ThemeConfig {
  return {
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: mode === "dark" ? darkTokens : lightTokens,
    cssVar: true,
  };
}

const SERIES = ["#0f6e56", "#1d9e75", "#5dcaa5", "#185fa5", "#ef9f27", "#d4537e", "#7f77dd"];

export function chartColors(mode: "light" | "dark") {
  // tooltipBg/tooltipBorder exist because both chart libraries default the hover
  // tooltip to a WHITE box — pairing that with our light `text` colour made dark-mode
  // tooltips white-on-white. The tooltip must carry its own themed surface.
  return mode === "dark"
    ? {
        text: "#e6efe9", axis: "#8aa39a", grid: "#1d2a26", series: SERIES,
        tooltipBg: "#1a2420", tooltipBorder: "#2c3a34",
      }
    : {
        text: "#1c1c1a", axis: "#6b6b66", grid: "#ebece9", series: SERIES,
        tooltipBg: "#ffffff", tooltipBorder: "#ebece9",
      };
}
