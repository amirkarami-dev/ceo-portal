"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui"
import { ThemeToggle } from "@/components/theme-provider"
import { LangSwitcher } from "@/components/lang-switcher"
import { Logo } from "./logo"

export function Navbar() {
  const locale = useLocale()
  const fa = locale === "fa"
  const [open, setOpen] = useState(false)

  const anchors: Array<{ href: string; label: string }> = [
    { href: "#features", label: fa ? "امکانات" : "Features" },
    { href: "#how", label: fa ? "نحوه کار" : "How it works" },
    { href: "#faq", label: fa ? "سوالات متداول" : "FAQ" },
    { href: "/help.html", label: fa ? "راهنما" : "Help" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LangSwitcher />
          </div>
          <ThemeToggle />
          <Link href="/login" className="hidden sm:inline-flex">
            <Button variant="outline" size="sm">
              {fa ? "ورود" : "Login"}
            </Button>
          </Link>
          <Link href="/login" className="hidden sm:inline-flex">
            <Button size="sm">{fa ? "شروع کنید" : "Get started"}</Button>
          </Link>

          <button
            type="button"
            aria-label={fa ? "منو" : "Menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              {open ? (
                <path d="M6 6l12 12M18 6 6 18" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {a.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <Link href="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  {fa ? "ورود" : "Login"}
                </Button>
              </Link>
              <Link href="/login" className="flex-1">
                <Button size="sm" className="w-full">
                  {fa ? "شروع کنید" : "Get started"}
                </Button>
              </Link>
            </div>
            <div className="mt-2 sm:hidden">
              <LangSwitcher />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
