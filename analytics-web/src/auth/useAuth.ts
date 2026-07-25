import { createContext, useContext } from "react";
import type { AppRole, Permission } from "@/contracts/rbac";

// SessionUser is defined ONCE in contracts/rbac.ts; re-export it here
// so existing `from "./useAuth"` imports keep working without a second copy.
export type { SessionUser } from "@/contracts";
import type { SessionUser } from "@/contracts";

export interface AuthValue {
  user: SessionUser | null;
  roles: AppRole[];
  isAdmin: boolean;
  ready: boolean;
  permissions: Set<Permission>;
  can(p: Permission): boolean;
  login(): void;
  logout(): void;
  setMockRole(roles: AppRole[]): void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
