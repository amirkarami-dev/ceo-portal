"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { getQueryClient } from "@/lib/query-client"

export function QueryProvider({ children }: { children: ReactNode }) {
  // getQueryClient() returns the browser singleton on the client and a fresh
  // per-request client on the server.
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
