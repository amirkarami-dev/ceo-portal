import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext } from "./useAuth";
import type { AuthValue } from "./useAuth";
import type { SessionUser } from "@/contracts";
import { permissionsFor, type AppRole, type Permission } from "@/contracts/rbac";
import { getMockUser, setMockUser } from "./mock-user";
import { getUserManager, sessionUserFromOidc } from "./oidc";

const ADMIN_ROLES: AppRole[] = ["SuperAdmin", "TenantAdmin", "AIManager"];
const ADMIN_PERMS: Permission[] = ["ai:manage", "datasources:manage", "users:manage", "audit:read"];

const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    if (useMock) {
      setUser(getMockUser());
      setReady(true);
      return;
    }

    const mgr = getUserManager();
    const apply = (u: User | null) => {
      if (alive) setUser(u && !u.expired ? sessionUserFromOidc(u) : null);
    };

    // Initial read (covers the case where a valid session is already in storage).
    void (async () => {
      const u = await mgr.getUser();
      if (!alive) return;
      apply(u);
      setReady(true);
    })();

    // CRITICAL: react to the user the redirect/silent callback stores. Without this, the FIRST
    // login completes the token exchange AFTER this provider's initial getUser() already resolved
    // null, so RequireAuth bounced to /login (the "works on the second click" bug).
    const onLoaded = (u: User) => apply(u);
    const onUnloaded = () => {
      if (alive) setUser(null);
    };
    mgr.events.addUserLoaded(onLoaded);
    mgr.events.addUserUnloaded(onUnloaded);

    return () => {
      alive = false;
      mgr.events.removeUserLoaded(onLoaded);
      mgr.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const setMockRole = useCallback((roles: AppRole[]) => {
    setUser(setMockUser(roles));
  }, []);

  const login = useCallback(() => {
    if (useMock) {
      setUser(getMockUser());
    } else {
      void getUserManager().signinRedirect();
    }
  }, []);

  const logout = useCallback(() => {
    if (useMock) {
      localStorage.removeItem("report.mockUser");
      setUser(null);
    } else {
      void getUserManager().signoutRedirect();
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    const roles = user?.roles ?? [];
    const permissions = permissionsFor(roles, user?.grants ?? []);
    const isAdmin =
      roles.some((r) => ADMIN_ROLES.includes(r)) ||
      ADMIN_PERMS.some((p) => permissions.has(p));
    return {
      user,
      roles,
      ready,
      isAdmin,
      permissions,
      can: (p: Permission) => permissions.has(p),
      login,
      logout,
      setMockRole,
    };
  }, [user, ready, login, logout, setMockRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
