import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { loadThemeMode, saveThemeMode, type ThemeMode } from "@/theme/tokens";

interface UiState {
  /** Single source of truth for dark/light. Persisted under `landing-panel-theme`
   *  (managed by theme/tokens.ts, NOT by the zustand persist key below). */
  themeMode: ThemeMode;
  sidebarCollapsed: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: loadThemeMode(),
      sidebarCollapsed: false,
      setThemeMode: (themeMode) => {
        saveThemeMode(themeMode);
        set({ themeMode });
      },
      toggleTheme: () =>
        set((s) => {
          const next: ThemeMode = s.themeMode === "light" ? "dark" : "light";
          saveThemeMode(next);
          return { themeMode: next };
        }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: "landing-panel-ui",
      storage: createJSONStorage(() => localStorage),
      // themeMode has its own key so the very first paint can read it synchronously.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
