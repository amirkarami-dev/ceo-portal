"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

type Theme = "light" | "dark"

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)
const STORAGE_KEY = "m19_theme"

/** Inline script (run before paint) that applies the saved/system theme to avoid FOUC. */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`

function apply(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage synchronously on first render (client only,
  // "use client" guarantees this runs in the browser). The inline themeNoFlashScript
  // already applies the class before paint so there is no hydration mismatch.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light"
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  })

  // Keep the DOM class in sync with the initial value on mount (the lazy initializer
  // cannot call apply() directly) and whenever the provider first renders.
  useEffect(() => {
    apply(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    apply(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}

export function ThemeToggle() {
  // Read only `toggle` (used in the click handler) — never branch the rendered
  // markup on `theme`, so the server and the first client render are byte-identical
  // (no hydration mismatch). Both icons are always in the DOM; CSS picks which is
  // visible via the `.dark` class, which is already on <html> before paint.
  const { toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {/* Sun — shown in dark mode (clicking switches to light) */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hidden size-4 dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {/* Moon — shown in light mode (clicking switches to dark) */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="block size-4 dark:hidden">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}
