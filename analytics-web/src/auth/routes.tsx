import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button, Card, Result, Spin, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import type { AppRole, Permission } from "@/contracts/rbac";
import { getUserManager } from "./oidc";

const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";

export function LoginScreen() {
  const { login, user, ready } = useAuth();
  const { t } = useTranslation();
  if (ready && user) return <Navigate to="/ask" replace />;
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ant-color-bg-layout)",
      }}
    >
      <Card
        variant="borderless"
        style={{
          width: 360,
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.10)",
          borderRadius: 16,
        }}
        styles={{ body: { padding: 40, textAlign: "center" } }}
      >
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          {t("common.appName")}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          {useMock ? t("auth.mockMode") : t("auth.signInPrompt")}
        </Typography.Text>
        <Button type="primary" size="large" block onClick={login}>
          {useMock ? t("auth.mockMode") : t("auth.login")}
        </Button>
      </Card>
    </div>
  );
}

export function OidcCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const ran = useRef(false);
  useEffect(() => {
    // Run the code exchange EXACTLY once. Deps are intentionally empty + ref-guarded: react-i18next
    // returns a NEW `t` when translations finish loading, which previously re-ran this effect and
    // called signinRedirectCallback() a second time. The PKCE state was already consumed by the
    // first (successful) call, so the second threw "No matching state" and flashed "ورود ناموفق بود".
    if (ran.current) return;
    ran.current = true;
    if (useMock) {
      navigate("/ask", { replace: true });
      return;
    }
    getUserManager()
      .signinRedirectCallback()
      .then(() => {
        // The stored user is picked up live by AuthProvider's addUserLoaded subscription.
        navigate("/ask", { replace: true });
      })
      .catch(() => setError(t("auth.callbackError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <Result status="error" title={error} />;
  return <Spin tip={t("auth.signingIn")} fullscreen />;
}

// Rendered inside the hidden silent-renew iframe (automaticSilentRenew). Completes the silent
// code exchange and renders nothing. Failures are non-fatal — the user re-auths on next navigation.
export function OidcSilentCallback() {
  useEffect(() => {
    if (useMock) return;
    getUserManager()
      .signinSilentCallback()
      .catch(() => {
        /* silent renew failed; ignore — interactive login still works */
      });
  }, []);
  return null;
}

export function LogoutScreen() {
  const { logout } = useAuth();
  const { t } = useTranslation();
  useEffect(() => {
    logout();
  }, [logout]);
  return <Result title={t("auth.loggedOut")} />;
}

export function ForbiddenScreen() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ant-color-bg-layout)",
      }}
    >
      <Result status="403" title="403" subTitle={t("rbac.forbiddenMsg")} />
    </div>
  );
}

export function RequireAuth() {
  const { ready, user } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export function RequireRole({ allow }: { allow: AppRole[] }) {
  const { ready, roles } = useAuth();
  if (!ready) return <Spin fullscreen />;
  const ok = roles.some((r) => allow.includes(r));
  return ok ? <Outlet /> : <Navigate to="/403" replace />;
}

// Wrapper component: renders `children` when the user holds `perm`, else redirects to /403.
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { ready, can } = useAuth();
  if (!ready) return <Spin fullscreen />;
  return can(perm) ? <>{children}</> : <Navigate to="/403" replace />;
}
