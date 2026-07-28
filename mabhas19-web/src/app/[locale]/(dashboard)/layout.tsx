import type { ReactNode } from "react"
import { auth } from "@/auth"
import { AuthProvider } from "@/lib/auth-context"
import { DashboardShell } from "./dashboard-shell"
import type { CurrentUser } from "@/lib/types"

// Server component: route protection is enforced by middleware, so by the time this runs
// the session exists. Resolve identity from the session JWT and seed the client context —
// no client auth fetch, no gating flicker.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  const user: CurrentUser = {
    id: session?.user?.id ?? "",
    email: session?.user?.email ?? null,
    phoneNumber: null,
    roles: session?.user?.roles ?? [],
    isAdmin: session?.user?.isAdmin ?? false,
  }

  return (
    <AuthProvider initialUser={user} initialServices={session?.user?.services ?? []}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
