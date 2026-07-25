import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthValue } from "./useAuth";
import { getUserManager, sessionUserFromOidc, type SessionUser } from "./oidc";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const mgr = getUserManager();
    const apply = (u: User | null) => {
      if (alive) setUser(u && !u.expired ? sessionUserFromOidc(u) : null);
    };

    void (async () => {
      const u = await mgr.getUser();
      if (!alive) return;
      apply(u);
      setReady(true);
    })();

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

  const login = useCallback(() => {
    void getUserManager().signinRedirect();
  }, []);

  const logout = useCallback(() => {
    void getUserManager().signoutRedirect();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, isAdmin: user?.isAdmin ?? false, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
