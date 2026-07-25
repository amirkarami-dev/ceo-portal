import { createContext, useContext } from "react";
import type { SessionUser } from "./oidc";

export type { SessionUser } from "./oidc";

export interface AuthValue {
  user: SessionUser | null;
  /** True only when the signed-in user holds the `Administrator` role. */
  isAdmin: boolean;
  /** False until the first token read resolves — render a spinner, do not redirect. */
  ready: boolean;
  /** Current bearer token (null when signed out). Requests re-read it via getAccessToken(). */
  accessToken: string | null;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
