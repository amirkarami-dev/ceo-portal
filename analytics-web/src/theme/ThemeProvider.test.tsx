import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { applyLocale, i18n } from "@/i18n";
import { tokens, applyCssVars, buildAntdTheme } from "./theme";
import { theme as antdTheme } from "antd";

const defaultBrand = { primary: tokens.primary };

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider mode="light" brand={defaultBrand} dir="rtl" locale="fa">
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("accepts dark mode without error", () => {
    render(
      <ThemeProvider mode="dark" brand={defaultBrand} dir="ltr" locale="en">
        <span data-testid="dark-child">dark</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("dark-child")).toBeInTheDocument();
  });
});

describe("ThemeProvider — single source of truth wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("applyCssVars sets data-theme=dark when mode is dark", () => {
    applyCssVars("dark", defaultBrand);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applyCssVars sets data-theme=light when mode is light", () => {
    applyCssVars("light", defaultBrand);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("buildAntdTheme uses darkAlgorithm for dark mode", () => {
    const { algorithm } = buildAntdTheme("dark", defaultBrand, "ltr");
    expect(algorithm).toBe(antdTheme.darkAlgorithm);
  });

  it("buildAntdTheme uses defaultAlgorithm for light mode", () => {
    const { algorithm } = buildAntdTheme("light", defaultBrand, "ltr");
    expect(algorithm).toBe(antdTheme.defaultAlgorithm);
  });

  it("ThemeProvider calls applyCssVars with the mode passed in (dark)", () => {
    const spy = vi.spyOn({ applyCssVars }, "applyCssVars");
    // Render with dark — DOM data-theme attribute is the observable side effect
    render(
      <ThemeProvider mode="dark" brand={defaultBrand} dir="ltr" locale="en">
        <span data-testid="dark-wired">wired</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("dark-wired")).toBeInTheDocument();
    // The useEffect in ThemeProvider calls applyCssVars(mode, brand); verify via DOM side-effect
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    spy.mockRestore();
  });

  it("ThemeProvider leaves data-theme=light when mode is light", () => {
    render(
      <ThemeProvider mode="light" brand={defaultBrand} dir="rtl" locale="fa">
        <span data-testid="light-wired">wired</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("light-wired")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("applyLocale", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
  });

  it("sets dir=rtl and lang=fa for fa locale", () => {
    applyLocale("fa");
    expect(document.documentElement.lang).toBe("fa");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("sets dir=ltr and lang=en for en locale", () => {
    applyLocale("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
});

describe("i18n key resolution", () => {
  it("resolves common.appName in fa", async () => {
    await i18n.changeLanguage("fa");
    expect(i18n.t("common.appName")).toBe("گزارش‌ساز هوشمند");
  });

  it("resolves common.appName in en", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.appName")).toBe("AI Reporting");
  });

  it("resolves nav.ask in fa", async () => {
    await i18n.changeLanguage("fa");
    expect(i18n.t("nav.ask")).toBe("سامانه هوشمند گزارشات");
  });

  it("resolves nav.ask in en", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("nav.ask")).toBe("Ask AI");
  });
});
