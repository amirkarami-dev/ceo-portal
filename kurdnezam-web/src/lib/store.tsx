"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import type { Content } from "@/data/content";

interface ContentStore {
  content: Content;
  /**
   * Always `true` — the content is seeded from the server, so it is
   * available on the very first render. Kept for call-site compatibility.
   */
  hydrated: true;
}

const ContentContext = createContext<ContentStore | null>(null);

/**
 * SSR-seeded content provider. The root layout fetches the whole payload
 * on the server and passes it in; there is no localStorage, no client
 * refetch, and no mutation API (the admin lives in a separate app).
 */
export function ContentProvider({
  initialContent,
  children,
}: {
  initialContent: Content;
  children: ReactNode;
}) {
  return (
    <ContentContext.Provider value={{ content: initialContent, hydrated: true }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ContentContext.Provider>
  );
}

export function useContent(): ContentStore {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error("useContent() must be used inside <ContentProvider>");
  }
  return ctx;
}
