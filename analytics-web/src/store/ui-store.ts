import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppLocale } from "../i18n";

interface UiState {
  /** Single source of truth for dark/light mode. Toggled by toggleTheme().
   *  Persisted to localStorage key `analytics-theme`.
   *  Consumed by: providers.tsx → ThemeProvider (antd + CSS vars),
   *  EChartsRenderer, RechartsRenderer (chart colours), AppLayout Sider. */
  themeMode: "light" | "dark";
  locale: AppLocale;
  dir: "rtl" | "ltr";
  sidebarCollapsed: boolean;
  previewPrimaryColor: string | null;
  toggleTheme: () => void;
  setLocale: (l: AppLocale) => void;
  toggleSidebar: () => void;
  setPreviewPrimaryColor: (color: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: ((): "light" | "dark" => {
        try {
          const stored = localStorage.getItem("analytics-theme");
          return stored === "dark" ? "dark" : "light";
        } catch {
          return "light";
        }
      })(),
      locale: "fa",
      dir: "rtl",
      sidebarCollapsed: false,
      previewPrimaryColor: null,
      toggleTheme: () =>
        set((s) => {
          const next = s.themeMode === "light" ? "dark" : "light";
          try {
            localStorage.setItem("analytics-theme", next);
          } catch {
            /* SSR / private browsing — ignore */
          }
          return { themeMode: next };
        }),
      setLocale: (locale) => set({ locale, dir: locale === "fa" ? "rtl" : "ltr" }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPreviewPrimaryColor: (previewPrimaryColor) => set({ previewPrimaryColor }),
    }),
    {
      name: "report.ui",
      storage: createJSONStorage(() => localStorage),
      // Only persist the fields that belong to the report.ui key; themeMode
      // has its own key ("analytics-theme") managed manually in toggleTheme.
      partialize: (s) => ({
        locale: s.locale,
        dir: s.dir,
        sidebarCollapsed: s.sidebarCollapsed,
        previewPrimaryColor: s.previewPrimaryColor,
      }),
    },
  ),
);
