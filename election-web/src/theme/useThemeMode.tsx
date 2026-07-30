import { createContext, useContext } from "react";
import type { ThemeMode } from "./tokens";

export interface ThemeModeValue {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

export const THEME_STORAGE_KEY = "mun-sanandaj.theme";

export const ThemeModeContext = createContext<ThemeModeValue | undefined>(undefined);

export function useThemeMode(): ThemeModeValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeModeProvider");
  return ctx;
}
