"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { subscribeLoading } from "@/lib/loading"

/**
 * Modern NProgress-style top loading bar. Shows whenever:
 *  - a route navigation happens (brief pulse on pathname change), or
 *  - the API client has in-flight requests (driven by lib/loading via api.ts).
 * Dependency-free; uses the emerald --primary token so it adapts to light/dark.
 */
export function TopLoadingBar() {
  const [apiActive, setApiActive] = useState(false)
  const [navActive, setNavActive] = useState(false)
  const pathname = usePathname()

  // Reflect in-flight API requests.
  useEffect(() => subscribeLoading(setApiActive), [])

  // Brief pulse on every route change (covers navigations with no data fetch).
  // setState is intentional here: pathname IS the external event driving the animation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNavActive(true)
    const id = setTimeout(() => setNavActive(false), 500)
    return () => clearTimeout(id)
  }, [pathname])

  const loading = apiActive || navActive

  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // setState calls here are intentional: `loading` is an external signal (API in-flight
  // + nav pulse) that drives the progress-bar animation imperatively.
  useEffect(() => {
    if (loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
      setProgress((p) => (p < 10 ? 10 : p))
      intervalRef.current = setInterval(() => {
        // ease toward 90% and wait there until the work finishes
        setProgress((p) => (p >= 90 ? 90 : p + Math.max(0.5, (90 - p) * 0.12)))
      }, 200)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
    // finished: jump to 100%, fade out, then reset
    setProgress(100)
    const hide = setTimeout(() => setVisible(false), 250)
    const reset = setTimeout(() => setProgress(0), 500)
    return () => {
      clearTimeout(hide)
      clearTimeout(reset)
    }
  }, [loading])

  if (!visible && progress === 0) return null

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        insetInlineStart: 0,
        insetInlineEnd: 0,
        top: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--primary)",
          boxShadow: "0 0 8px var(--primary), 0 0 4px var(--primary)",
          opacity: visible ? 1 : 0,
          transition: "width 200ms ease, opacity 300ms ease",
        }}
      />
    </div>
  )
}
