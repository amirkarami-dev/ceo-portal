import { describe, it, expect } from "vitest";
import { echartsTheme } from "./echarts-theme";
import { chartColors } from "./tokens";

/** WCAG relative luminance, then the contrast ratio between two hex colours. */
function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The surface each mode's charts are drawn on. */
const PANEL = { light: "#ffffff", dark: "#15211d" } as const;
const MODES = ["light", "dark"] as const;
const AXIS_KEYS = ["categoryAxis", "valueAxis", "logAxis", "timeAxis"] as const;

type Axis = {
  axisLine?: { lineStyle?: { color?: string } };
  axisLabel?: { color?: string };
  splitLine?: { lineStyle?: { color?: string } };
};

describe("echartsTheme", () => {
  it.each(MODES)("%s carries the same palette recharts draws with", (mode) => {
    expect(echartsTheme(mode).color).toEqual(chartColors(mode).series);
  });

  // ECharts' own default is #333 body text, which measures 1.31:1 on our dark panel — the reason
  // the two admin charts were unreadable in dark mode for as long as they called init() bare.
  it.each(MODES)("%s sets a text colour that is readable on that panel", (mode) => {
    const t = echartsTheme(mode) as { textStyle: { color: string } };
    expect(contrast(t.textStyle.color, PANEL[mode])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(MODES)("%s keeps the chart background transparent so the card shows through", (mode) => {
    expect(echartsTheme(mode).backgroundColor).toBe("transparent");
  });

  // ECharts keeps four separate axis-type keys. A chart that switches from a category axis to a
  // time axis silently loses its colours if only one of them is themed — no error, just grey.
  it.each(MODES)("%s themes all four axis types identically", (mode) => {
    const t = echartsTheme(mode) as unknown as Record<string, Axis>;
    const c = chartColors(mode);
    for (const key of AXIS_KEYS) {
      const a = t[key];
      expect(a, key).toBeDefined();
      expect(a.axisLine?.lineStyle?.color, `${key}.axisLine`).toBe(c.axis);
      expect(a.axisLabel?.color, `${key}.axisLabel`).toBe(c.axis);
      expect(a.splitLine?.lineStyle?.color, `${key}.splitLine`).toBe(c.grid);
    }
  });

  it.each(MODES)("%s gives the tooltip its own surface, not ECharts' white box", (mode) => {
    const t = echartsTheme(mode) as unknown as {
      tooltip: { backgroundColor: string; borderColor: string; textStyle: { color: string } };
    };
    const c = chartColors(mode);
    expect(t.tooltip.backgroundColor).toBe(c.tooltipBg);
    expect(t.tooltip.borderColor).toBe(c.tooltipBorder);
    // The pairing is the point: a light text colour on ECharts' default white box is invisible.
    expect(contrast(t.tooltip.textStyle.color, t.tooltip.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  describe("the heatmap ramp", () => {
    const ramp = (mode: "light" | "dark") =>
      (echartsTheme(mode) as unknown as { visualMap: { inRange: { color: string[] } } })
        .visualMap.inRange.color;

    it.each(MODES)("%s replaces ECharts' default blue-to-red with one hue", (mode) => {
      expect(ramp(mode).length).toBeGreaterThanOrEqual(3);
    });

    // A magnitude ramp that is not monotonic in luminance is unreadable: two different values look
    // equally strong. Direction differs by mode — darker means "more" on white, lighter on dark.
    it.each(MODES)("%s runs monotonically from faint to strong", (mode) => {
      const lums = ramp(mode).map(lum);
      for (let i = 1; i < lums.length; i++) {
        if (mode === "light") expect(lums[i], `stop ${i}`).toBeLessThan(lums[i - 1]);
        else expect(lums[i], `stop ${i}`).toBeGreaterThan(lums[i - 1]);
      }
    });

    // The top of the ramp is where the numbers people care about live, so it has to read clearly.
    // The bottom is deliberately near the panel — "almost nothing" should look like almost nothing,
    // and the visualMap bar beside it carries the scale.
    it.each(MODES)("%s makes the high end clearly visible", (mode) => {
      const stops = ramp(mode);
      expect(contrast(stops[stops.length - 1], PANEL[mode])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
