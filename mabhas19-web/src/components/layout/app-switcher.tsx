"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLocale } from "next-intl"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/components/ui"

// One product service the user can switch to. `key` matches the IdP `svc` grant key
// (see src/Auth/Data/ServiceKeys.cs); `href` is the live subdomain. `accent` holds STATIC
// Tailwind classes (never build them dynamically or they get purged). `adminOnly` services
// are gated by the Administrator role instead of a `svc` grant.
type AppService = {
  key: string
  nameFa: string
  nameEn: string
  href: string
  accent: string
  ring: string
  icon: ReactNode
  adminOnly?: boolean
}

const SERVICES: AppService[] = [
  {
    key: "mabhas19",
    nameFa: "مبحث ۱۹",
    nameEn: "Mabhas 19",
    href: "https://mabhas19.myceo.ir",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 21h18" />
        <path d="M6 21V7l6-4 6 4v14" />
        <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" />
      </svg>
    ),
  },
  {
    key: "analytics",
    nameFa: "تحلیل داده",
    nameEn: "Analytics",
    href: "https://analytic.myceo.ir",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3v18h18" />
        <path d="M7 15v3M12 10v8M17 6v12" />
      </svg>
    ),
  },
  {
    key: "mun-sanandaj",
    nameFa: "شهرداری سنندج",
    nameEn: "Sanandaj Municipality",
    href: "https://mun-sanandaj.myceo.ir",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 4 8h16z" />
        <path d="M4 10h16" />
        <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    key: "landing-panel",
    nameFa: "پنل لندینگ",
    nameEn: "Landing Panel",
    href: "https://landing-panel.myceo.ir",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 9v11" />
      </svg>
    ),
  },
  {
    key: "plan",
    nameFa: "پلن",
    nameEn: "Plan",
    href: "https://plan.myceo.ir",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "admin",
    nameFa: "مدیریت کاربران",
    nameEn: "User Admin",
    href: "https://admin.myceo.ir",
    adminOnly: true,
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/40",
    icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 6.6a3 3 0 0 1 0 5.8M18.5 20a5.5 5.5 0 0 0-3-4.9" />
      </svg>
    ),
  },
]

function hostOf(href: string): string {
  try {
    return new URL(href).hostname
  } catch {
    return ""
  }
}

export function AppSwitcher() {
  const { canAccess, isAdmin } = useAuth()
  const locale = useLocale()
  const isFa = locale.startsWith("fa")
  const [open, setOpen] = useState(false)
  // Only read inside the popover (closed on first render), so there is no hydration mismatch.
  const [host] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.location.hostname : null,
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const visible = SERVICES.filter((s) => (s.adminOnly ? isAdmin : canAccess(s.key)))

  // With only the current app available there is nothing to switch to.
  if (visible.length < 2) return null

  const label = isFa ? "سرویس‌ها" : "Apps"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none",
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40",
          open ? "border-ring bg-accent text-accent-foreground" : "border-border bg-background",
        )}
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="5" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute end-0 mt-2 w-72 origin-top overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            {isFa ? "سرویس‌های شما" : "Your apps"}
          </div>
          <ul className="grid grid-cols-3 gap-1 p-2">
            {visible.map((s) => {
              const current = host != null && hostOf(s.href) === host
              return (
                <li key={s.key}>
                  <a
                    href={s.href}
                    role="menuitem"
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "group relative flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2.5 text-center outline-none transition-colors",
                      "hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 group-active:scale-95",
                        s.accent,
                        current && cn("ring-2", s.ring),
                      )}
                    >
                      {s.icon}
                    </span>
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                      {isFa ? s.nameFa : s.nameEn}
                    </span>
                    {current ? (
                      <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
