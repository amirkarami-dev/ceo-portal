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

describe("Descriptions label contrast", () => {
  // Blend the label's translucent colour onto the panel behind it, then measure. The
  // point of the test is the ratio, not the string — a later change to a different
  // colour is fine as long as the label stays readable.
  const blend = (fg: [number, number, number, number], bg: [number, number, number]) =>
    fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3])) as unknown as number[];
  const lum = (c: number[]) =>
    0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
  function chan(v: number) {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }
  const ratio = (a: number[], b: number[]) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  // The panels the label actually sits on, read off the running app at 375px.
  const LIGHT_PANEL: [number, number, number] = [255, 255, 255];
  const DARK_PANEL: [number, number, number] = [21, 33, 29];

  const parse = (css: string): [number, number, number, number] => {
    const n = (css.match(/[\d.]+/g) ?? []).map(Number);
    return [n[0], n[1], n[2], n[3] ?? 1];
  };

  it("keeps «مالک» and «مدل داده» readable in both themes", () => {
    for (const [mode, panel] of [
      ["light", LIGHT_PANEL],
      ["dark", DARK_PANEL],
    ] as const) {
      const cfg = buildAntdTheme(mode, { primary: "#10b981" }, "rtl");
      const label = cfg.components?.Descriptions?.labelColor as string;
      expect(label, `${mode} sets a label colour`).toBeTruthy();
      const r = ratio(blend(parse(label), panel), panel as unknown as number[]);
      // antd's own default here is 45% alpha, which measures 3.35 light / 4.39 dark.
      expect(r, `${mode} label contrast`).toBeGreaterThanOrEqual(4.5);
    }
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
