import { describe, it, expect } from "vitest";
import { buildTheme, chartColors, primaryInk, primaryInkFor } from "./tokens";
import { tokens as brandTokens } from "./theme";

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

describe("theme tokens", () => {
  it("light theme uses emerald primary", () => {
    const t = buildTheme("light");
    expect(t.token?.colorPrimary).toBe("#0f6e56");
  });
  it("dark theme sets a dark base background", () => {
    const t = buildTheme("dark");
    expect(t.algorithm).toBeDefined();
    expect(t.token?.colorPrimary).toBe("#1d9e75");
  });
  // The brand green is 2.54:1 on white — it fails AA as text and is hard to read at
  // 14px. primaryInk exists so the brand colour can be *read*; if someone ever
  // "simplifies" it back to colorPrimary, this fails instead of the users.
  it("primaryInk is readable as text on a light surface", () => {
    expect(contrast(primaryInk, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  // Two primaries live in this app and the brand one wins: providers.tsx passes
  // theme.ts's `tokens.primary` (#10b981) as the brand, and ThemeProvider merges the
  // brand-built token OVER the one in this file (#0f6e56). So #0f6e56 is 6.2:1 and
  // never rendered, while the colour on screen is 2.54:1. That is why primaryInk
  // exists rather than simply reusing colorPrimary.
  it("the colour that actually renders is too light for text, which is why primaryInk exists", () => {
    expect(contrast(brandTokens.primary, "#ffffff")).toBeLessThan(4.5);
    expect(contrast(primaryInk, "#ffffff")).toBeGreaterThan(contrast(brandTokens.primary, "#ffffff"));
  });

  // The deep green is legible on white and nearly invisible on the dark panel, where
  // the brand itself is the readable one. Whichever way round, the answer has to clear
  // AA against the surface it is actually drawn on.
  it.each([
    ["light", "#ffffff"],
    ["dark", "#152922"],
  ] as const)("primaryInkFor(%s) is readable on that surface", (mode, surface) => {
    expect(contrast(primaryInkFor(mode), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not hand the same green to both modes", () => {
    expect(primaryInkFor("light")).not.toBe(primaryInkFor("dark"));
  });

  it("chartColors differ between modes", () => {
    expect(chartColors("light").text).not.toBe(chartColors("dark").text);
    expect(chartColors("dark").series.length).toBeGreaterThan(3);
  });
});
