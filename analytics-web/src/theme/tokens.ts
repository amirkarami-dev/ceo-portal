import { theme as antdTheme, type ThemeConfig } from "antd";

const radius = { borderRadius: 8, borderRadiusLG: 12 } as const;
const typography = { fontFamily: "Vazirmatn, -apple-system, Segoe UI, sans-serif", fontSize: 14 } as const;

export const sharedToken = { ...radius, ...typography, wireframe: false } as const;

/**
 * The brand blue, #326BFC.
 *
 * It carries three jobs, and the reason they are three constants is that the old brand green needed
 * a different value for each: as a fill it was fine, as words it measured 2.54:1, and white on it
 * measured 2.54:1 again. Blue is kinder — but the roles stay separate so the next brand change is a
 * measurement rather than a guess.
 */
export const primary = "#326BFC";

/**
 * The brand as *text* on a light surface. #326BFC reads 4.52:1 on white, so it clears AA at 14px
 * without deepening — unlike the green it replaces, which needed two steps down.
 *
 * Mirrors `--rw-primary-ink` in global.css, which does the same job for CSS. Change both together.
 */
export const primaryInk = "#326BFC";

/**
 * On the dark panel #326BFC falls to 3.67:1, under AA for text. Same hue, lifted until it clears
 * AA on *every* dark ground the app paints — not just one. Dark mode has six of them: --rw-bg
 * #0b0f14, --rw-surface-1 #111827, --rw-surface-2 #1f2937 (the table header), antd's
 * colorBgContainer #15211d and colorBgLayout #0e1513. A token cannot know which one a component
 * sits on, so it has to satisfy the lightest: 4.61:1 on #1f2937, 6.03:1 on #0b0f14.
 *
 * Solved against that whole set on purpose. Picking the value against #15211d alone gives #5a88fd,
 * which then measures 4.46:1 on the table header — passing the check you happened to write and
 * failing the reader.
 */
export const primaryInkDark = "#5e8bfd";

/**
 * The brand as a fill that WHITE text sits on: the sidebar mark, a primary button, the active chip.
 * White on #326BFC is 4.52:1, so the brand itself can do this job — the green could not, which is
 * why `--rw-primary-solid` had to differ from the brand at all.
 */
export const primarySolid = "#326BFC";

/** Whichever of the two is legible against the surface in front of you. */
export function primaryInkFor(mode: "light" | "dark"): string {
  return mode === "dark" ? primaryInkDark : primaryInk;
}

export const lightTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: primary,
  colorBgLayout: "#f7f8f8",
  colorBgContainer: "#ffffff",
  colorBorderSecondary: "#ebece9",
};

export const darkTokens: ThemeConfig["token"] = {
  ...sharedToken,
  // The lifted blue, not the raw brand: antd paints primary text and borders straight from this
  // token on the dark panel, where #326BFC is 3.67:1.
  colorPrimary: primaryInkDark,
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

/**
 * The chart palette: blue, orange, yellow, red, green, cyan.
 *
 * Two lists, one palette. The brand hues are exact on the dark panel, where every one of them clears
 * the 3:1 a data mark needs (3.67 to 9.68). On white four of them do not — yellow reads 1.71:1,
 * cyan 2.34, orange 2.51, green 2.80 — so light mode holds the hue and the saturation and carries
 * the lightness down just past 3:1. Side by side you can see it; on their own you cannot.
 *
 * The light values are solved to ~3.15 rather than exactly 3.0. Landing on 3.005 passes a test and
 * still fails a reader: rounding to the nearest hex, an anti-aliased edge or a 1px stroke all eat
 * that margin.
 *
 * Measured against every surface a mark actually sits on — #ffffff in light, and in dark all five
 * grounds the app paints (see primaryInkDark above). One panel is not enough: the dashboard widget
 * draws on #15211d and the report viewer on #0b0f14. `DARK_GROUNDS` in tokens.test.ts holds the list.
 */
const SERIES_DARK = ["#326BFC", "#FE8113", "#FCBB21", "#FD411E", "#24AF7E", "#06B5F8"];
const SERIES_LIGHT = ["#326BFC", "#e96d01", "#be8703", "#FD411E", "#22a476", "#059bd5"];

export function chartColors(mode: "light" | "dark") {
  // tooltipBg/tooltipBorder exist because both chart libraries default the hover
  // tooltip to a WHITE box — pairing that with our light `text` colour made dark-mode
  // tooltips white-on-white. The tooltip must carry its own themed surface.
  return mode === "dark"
    ? {
        text: "#e6efe9", axis: "#8aa39a", grid: "#1d2a26", series: SERIES_DARK,
        tooltipBg: "#1a2420", tooltipBorder: "#2c3a34",
      }
    : {
        text: "#1c1c1a", axis: "#6b6b66", grid: "#ebece9", series: SERIES_LIGHT,
        tooltipBg: "#ffffff", tooltipBorder: "#ebece9",
      };
}
