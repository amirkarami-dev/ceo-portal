import { describe, it, expect } from "vitest";
import { buildTheme, chartColors, primary, primaryInk, primaryInkFor, primarySolid } from "./tokens";
import { tokens as brandTokens } from "./theme";
import { echartsTheme } from "./echarts-theme";

/** WCAG relative luminance, then the contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const WHITE = "#ffffff";

/**
 * Every dark ground the app actually paints, not one representative shade. --rw-* come from
 * applyCssVars in theme.ts; the other two are antd's own layout tokens in this file. #1f2937 is the
 * lightest — it is the Table header — so it is the one a colour has to survive.
 *
 * Testing a single shade is how #5a88fd shipped at 4.46:1 on the table header while passing a check
 * written against #15211d, where it read 5.03.
 */
const DARK_GROUNDS = ["#0b0f14", "#111827", "#1f2937", "#15211d", "#0e1513", "#152922"] as const;

describe("theme tokens", () => {
  it("light theme uses the brand blue", () => {
    const t = buildTheme("light");
    expect(t.token?.colorPrimary).toBe(primary);
  });
  it("dark theme sets a dark base background and the lifted brand", () => {
    const t = buildTheme("dark");
    expect(t.algorithm).toBeDefined();
    expect(t.token?.colorPrimary).toBe(primaryInkFor("dark"));
  });

  it("primaryInk is readable as text on a light surface", () => {
    expect(contrast(primaryInk, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  // Two primaries live in this app and the brand one wins: providers.tsx passes theme.ts's
  // `tokens.primary` as the brand, and ThemeProvider merges the brand-built token OVER the one in
  // this file. So it is the brand value, not lightTokens.colorPrimary, that reaches the screen —
  // which is exactly why it has to clear AA on its own. Under the old emerald brand it did not
  // (2.54:1) and this test asserted the failure; the blue removed the gap rather than papering
  // over it. If someone repoints the brand at a colour that cannot be read, this fails here.
  it("the colour that actually renders clears AA as text", () => {
    expect(brandTokens.primary).toBe(primary);
    expect(contrast(brandTokens.primary, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  // Whichever way round, the answer has to clear AA against the surface it is actually drawn on.
  it("primaryInkFor(light) is readable on the white panel", () => {
    expect(contrast(primaryInkFor("light"), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(DARK_GROUNDS)("primaryInkFor(dark) is readable on %s", (surface) => {
    expect(contrast(primaryInkFor("dark"), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not hand the same value to both modes", () => {
    expect(primaryInkFor("light")).not.toBe(primaryInkFor("dark"));
  });

  // primarySolid is the brand as a FILL with white text on it — the head mark, the active chip.
  // Different question from primaryInk, and the old green failed it at 2.54:1.
  it("white is readable on primarySolid", () => {
    expect(contrast(WHITE, primarySolid)).toBeGreaterThanOrEqual(4.5);
  });

  it("chartColors differ between modes", () => {
    expect(chartColors("light").text).not.toBe(chartColors("dark").text);
    expect(chartColors("dark").series.length).toBeGreaterThan(3);
  });

  // The palette rule, and the reason light and dark carry different lists. A data mark is
  // non-text content: WCAG asks 3:1, not 4.5. Four of the six brand hues clear that on the dark
  // panel and fail on white — yellow reads 1.71:1 there — so light mode carries deepened twins.
  // Ship the raw brand list into light mode and this fails four times over.
  it("every light series colour is visible on the white panel", () => {
    for (const c of chartColors("light").series) {
      expect(contrast(c, WHITE), `${c} on ${WHITE}`).toBeGreaterThanOrEqual(3);
    }
  });

  // Same reasoning as the ink: a chart can land on any of the dark grounds. It does — the dashboard
  // widget draws on #15211d and the report viewer on #0b0f14.
  it.each(DARK_GROUNDS)("every dark series colour is visible on %s", (surface) => {
    for (const c of chartColors("dark").series) {
      expect(contrast(c, surface), `${c} on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("light and dark series line up, so one dataset keeps its colour across themes", () => {
    expect(chartColors("light").series).toHaveLength(chartColors("dark").series.length);
  });

  // ECharts draws the heatmap and the grouped bars; recharts draws everything else. They have to
  // agree, or one dashboard shows two palettes.
  it.each(["light", "dark"] as const)("the %s echarts theme carries the palette recharts uses", (mode) => {
    const t = echartsTheme(mode);
    expect(t.color).toEqual(chartColors(mode).series);
  });
});
