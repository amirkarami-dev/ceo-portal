"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/components/ui"

interface NavItem {
  href: string
  labelKey: string
  icon: ReactNode
}

const iconClass = "h-[18px] w-[18px] shrink-0"

const NAV_GROUPS: { groupKey: string; items: NavItem[] }[] = [
  {
    groupKey: "main",
    items: [
      {
        href: "/dashboard",
        labelKey: "dashboard",
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        ),
      },
      {
        href: "/projects",
        labelKey: "projects",
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    groupKey: "group",
    items: [
      {
        href: "/import",
        labelKey: "import",
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12" />
            <path d="m8 11 4 4 4-4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        ),
      },
    ],
  },
]

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const tNav = useTranslations("nav")
  const tApp = useTranslations("app")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const fa = locale === "fa"
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.replace("/login")
  }

  return (
    <div className="relative flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Edge collapse chevron (desktop only — rendered when a toggle is provided) */}
      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? tCommon("expandSidebar") : tCommon("collapseSidebar")}
          title={collapsed ? tCommon("expandSidebar") : tCommon("collapseSidebar")}
          className="absolute -end-3 top-5 z-40 hidden size-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:inline-flex"
        >
          <svg className="size-3.5 flip-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
          </svg>
        </button>
      ) : null}

      {/* Brand */}
      <div className={cn("flex items-center gap-3 border-b border-sidebar-border py-[18px]", collapsed ? "justify-center px-2" : "px-5")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
            <path d="M9 21v-6h6v6" />
          </svg>
        </span>
        {!collapsed ? (
          <div className="flex min-w-0 flex-col text-start leading-tight">
            <span className="truncate text-sm font-bold">{tApp("name")}</span>
            <span className="truncate text-[11px] text-muted-foreground">{tApp("tagline")}</span>
          </div>
        ) : null}
      </div>

      {/* Nav groups */}
      <nav className={cn("flex-1 space-y-4 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tNav(group.groupKey)}
              </p>
            ) : (
              <div className="mx-2 mb-2 border-t border-sidebar-border" />
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/")
                const label = tNav(item.labelKey)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <span className={active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"}>
                        {item.icon}
                      </span>
                      {!collapsed ? label : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/*
          In-app user & subscription management was removed. User management now lives
          in the separate admin app at admin.myceo.ir; the API's /api/Admin/* endpoints
          were deleted. (Role-based gating stays available via useAuth().isAdmin for any
          future in-app admin feature.)
        */}

        {/* Help — static page at /help.html (outside locale routing → plain anchor, new tab) */}
        <div>
          {!collapsed ? (
            <div className="mx-3 mb-2 border-t border-sidebar-border" />
          ) : (
            <div className="mx-2 mb-2 border-t border-sidebar-border" />
          )}
          <ul className="space-y-1">
            <li>
              <a
                href="/help.html"
                target="_blank"
                rel="noopener noreferrer"
                title={collapsed ? (fa ? "راهنما" : "Help") : undefined}
                className={cn(
                  "group flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                )}
              >
                <span className="text-muted-foreground group-hover:text-sidebar-foreground">
                  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
                {!collapsed ? (fa ? "راهنما" : "Help") : null}
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </span>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium" dir="ltr">{user?.email ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">Admin</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label={tCommon("logout")}
                title={tCommon("logout")}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
