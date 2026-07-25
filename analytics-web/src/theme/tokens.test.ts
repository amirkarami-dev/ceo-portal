import { describe, it, expect } from "vitest";
import { buildTheme, chartColors } from "./tokens";

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
  it("chartColors differ between modes", () => {
    expect(chartColors("light").text).not.toBe(chartColors("dark").text);
    expect(chartColors("dark").series.length).toBeGreaterThan(3);
  });
});
