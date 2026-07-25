import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

describe("ui-store", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ themeMode: "light", locale: "fa", dir: "rtl", sidebarCollapsed: false });
  });

  it("setLocale switches dir to ltr for en", () => {
    useUiStore.getState().setLocale("en");
    expect(useUiStore.getState().locale).toBe("en");
    expect(useUiStore.getState().dir).toBe("ltr");
  });

  it("toggleTheme switches themeMode light→dark and persists to localStorage", () => {
    expect(useUiStore.getState().themeMode).toBe("light");
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().themeMode).toBe("dark");
    expect(localStorage.getItem("analytics-theme")).toBe("dark");
  });

  it("toggleTheme switches themeMode dark→light", () => {
    useUiStore.setState({ themeMode: "dark" });
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().themeMode).toBe("light");
  });

  it("toggleSidebar flips collapse", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });
});
