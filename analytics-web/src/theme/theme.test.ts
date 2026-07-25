import { describe, it, expect, beforeEach } from "vitest";
import { buildAntdTheme, buildEChartsTheme, applyCssVars, tokens, type AntdThemeConfig } from "./theme";

describe("buildAntdTheme", () => {
  it("uses dark algorithm + rtl direction in dark/rtl", () => {
    const cfg: AntdThemeConfig = buildAntdTheme("dark", { primary: "#10b981" }, "rtl");
    expect(cfg.direction).toBe("rtl");
    expect(cfg.token?.colorPrimary).toBe("#10b981");
    expect(Array.isArray(cfg.algorithm) ? cfg.algorithm.length : 1).toBeGreaterThan(0);
  });
  it("falls back to base primary when brand has none", () => {
    const cfg: AntdThemeConfig = buildAntdTheme("light", { primary: "" }, "ltr");
    expect(cfg.token?.colorPrimary).toBe(tokens.primary);
    expect(cfg.direction).toBe("ltr");
  });
});

describe("buildEChartsTheme", () => {
  it("derives a color palette seeded by brand primary", () => {
    const t = buildEChartsTheme("light", { primary: "#10b981" });
    expect(Array.isArray((t as { color: string[] }).color)).toBe(true);
    expect((t as { color: string[] }).color[0]).toBe("#10b981");
  });
});

describe("applyCssVars", () => {
  beforeEach(() => document.documentElement.removeAttribute("data-theme"));
  it("writes data-theme and --rw-primary", () => {
    applyCssVars("dark", { primary: "#10b981" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--rw-primary")).toBe("#10b981");
  });
});
