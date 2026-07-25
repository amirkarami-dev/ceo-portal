import { createContext, useContext } from "react";
import type { SessionUser } from "./oidc";

export interface AuthValue {
  user: SessionUser | null;
  isAdmin: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue | undefined>(undefined);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
