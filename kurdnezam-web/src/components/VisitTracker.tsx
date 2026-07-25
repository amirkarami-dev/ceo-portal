"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/lib/api";

/** sessionStorage key holding the opaque per-tab-session id. */
const SESSION_KEY = "kurdnezam-session";

/**
 * Opaque id for one browser session — NOT a user identifier and never
 * persisted beyond the tab session.
 */
function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // `crypto.randomUUID()` requires a secure context; fall back to a random-enough id.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const id = newSessionId();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage blocked (private mode / storage partitioning) —
    // stay ephemeral rather than failing the ping.
    return newSessionId();
  }
}

/**
 * Fire-and-forget visit ping that feeds the footer counters.
 * Renders nothing; mounted once in the site layout so it survives
 * client-side navigations and re-fires on every route change.
 */
export default function VisitTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Never ping the same path twice in a row (also absorbs React's
    // double-invoked effects in dev StrictMode — the ref survives the remount).
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    // Not awaited and `trackVisit` never throws: analytics must not block
    // rendering, and a failed ping is simply dropped (no retry).
    void trackVisit(getSessionId(), pathname);
  }, [pathname]);

  return null;
}
