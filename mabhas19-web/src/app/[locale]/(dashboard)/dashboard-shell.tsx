"use client"

import { useState, type ReactNode } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { cn } from "@/components/ui"

const COLLAPSE_KEY = "m19_sidebar_collapsed"

// Client chrome for the dashboard (sidebar collapse + mobile drawer). Auth/identity is
// handled server-side by the layout; this component only owns presentation state.
export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  // Lazy initializer reads localStorage synchronously on first render (client-only).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1"
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed sidebar — sits on the right in RTL via logical inset-inline-start:0 */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-30 hidden border-e border-sidebar-border transition-[width] duration-200 ease-in-out lg:block",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile drawer (always full width) */}
      {mobileOpen ? (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 start-0 z-50 w-64 border-e border-sidebar-border shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Content area, offset by sidebar width on desktop */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin] duration-200 ease-in-out",
          collapsed ? "lg:ms-[72px]" : "lg:ms-64"
        )}
      >
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
