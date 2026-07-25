import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthValue } from "./useAuth";
import { getUserManager, sessionUserFromOidc, type SessionUser } from "./oidc";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const mgr = getUserManager();

    const apply = (u: User | null) => {
      if (!alive) return;
      const valid = u && !u.expired ? u : null;
      setUser(valid ? sessionUserFromOidc(valid) : null);
      setAccessToken(valid?.access_token ?? null);
    };

    // Initial read — covers a session already sitting in localStorage.
    void (async () => {
      const u = await mgr.getUser();
      if (!alive) return;
      apply(u);
      setReady(true);
    })();

    // React to the user the redirect/silent callback stores. Without this the FIRST login
    // completes the code exchange AFTER the initial getUser() already resolved null, and the
    // guard bounces back to the login screen ("works on the second click").
    const onLoaded = (u: User) => apply(u);
    const onUnloaded = () => {
      if (!alive) return;
      setUser(null);
      setAccessToken(null);
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
    () => ({
      user,
      isAdmin: user?.isAdmin ?? false,
      ready,
      accessToken,
      login,
      logout,
    }),
    [user, ready, accessToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
