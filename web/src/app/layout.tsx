import type { ReactNode } from "react"

// The real <html>/<body> live in [locale]/layout.tsx so we can set lang & dir
// per locale. This root layout is a required pass-through for the App Router.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
