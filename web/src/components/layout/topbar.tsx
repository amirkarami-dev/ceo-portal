"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth-context"
import { LangSwitcher } from "@/components/lang-switcher"
import { ThemeToggle } from "@/components/theme-provider"
import { AppSwitcher } from "@/components/layout/app-switcher"
import { Button, cn } from "@/components/ui"

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const tCommon = useTranslations("common")
  const { user, logout } = useAuth()
  const router = useRouter()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Mobile: open drawer */}
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label="menu"
      >
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search */}
      <div className="relative max-w-md flex-1">
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          placeholder={tCommon("search") + "…"}
          className="h-9 w-full rounded-lg border border-input bg-muted/50 ps-9 pe-3 text-sm text-foreground outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </div>

      <div className="ms-auto flex items-center gap-2 sm:gap-3">
        <AppSwitcher />

        <ThemeToggle />

        {/* Notifications */}
        <button
          type="button"
          aria-label="notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="absolute end-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

        <LangSwitcher />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </span>
            <span className="hidden max-w-[10rem] truncate text-start md:inline" dir="ltr">
              {user?.email ?? ""}
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
              <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground" dir="ltr">
                {user?.email ?? ""}
              </div>
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("w-full justify-start text-destructive hover:bg-destructive/10")}
                  onClick={handleLogout}
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  {tCommon("logout")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
