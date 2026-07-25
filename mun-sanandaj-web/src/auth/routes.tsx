import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Button, Card, Result, Spin, Tooltip, Typography, theme } from "antd";
import { BulbFilled, BulbOutlined, LoginOutlined } from "@ant-design/icons";
import { useAuth } from "./useAuth";
import { getUserManager } from "./oidc";
import { useThemeMode } from "../theme/useThemeMode";

export function LoginScreen() {
  const { login, user, ready } = useAuth();
  const { mode, toggle } = useThemeMode();
  const { token } = theme.useToken();
  if (ready && user) return <Navigate to="/" replace />;

  const bg =
    mode === "dark"
      ? "radial-gradient(1200px 600px at 80% -10%, rgba(37,99,235,0.28), transparent 60%), #0b1220"
      : "radial-gradient(1200px 600px at 80% -10%, rgba(37,99,235,0.14), transparent 60%), #f4f6fb";

  return (
    <div style={{ minHeight: "100vh", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: bg }}>
      <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
        <Button
          type="text"
          aria-label="تغییر پوسته روشن و تیره"
          icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggle}
          style={{ position: "absolute", top: 20, insetInlineStart: 20 }}
        />
      </Tooltip>
      <Card
        variant="borderless"
        style={{ width: 380, boxShadow: token.boxShadowSecondary }}
        styles={{ body: { padding: 40, textAlign: "center" } }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: token.colorPrimary,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 24,
            margin: "0 auto 20px",
          }}
        >
          م
        </div>
        <Typography.Title level={3} style={{ marginBottom: 6 }}>
          ورود به وب سرویس شهرداری سنندج
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          برای ورود به حساب خود ادامه دهید
        </Typography.Text>
        <Button type="primary" size="large" block icon={<LoginOutlined />} onClick={login}>
          ورود
        </Button>
      </Card>
    </div>
  );
}

/** Full-height wrapper that paints the themed layout background behind standalone screens. */
function ScreenShell({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: token.colorBgLayout,
      }}
    >
      {children}
    </div>
  );
}

export function OidcCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    getUserManager()
      .signinRedirectCallback()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("ورود ناموفق بود"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Result status="error" title={error} />;
  return <Spin tip="در حال ورود…" fullscreen />;
}

export function OidcSilentCallback() {
  useEffect(() => {
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
  useEffect(() => {
    logout();
  }, [logout]);
  return (
    <ScreenShell>
      <Result title="خارج شدید" />
    </ScreenShell>
  );
}

export function ForbiddenScreen() {
  return (
    <ScreenShell>
      <Result status="403" title="403" subTitle="دسترسی محدود به مدیران سیستم است" />
    </ScreenShell>
  );
}

export function RequireAuth() {
  const { ready, user } = useAuth();
  if (!ready) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { ready, isAdmin } = useAuth();
  if (!ready) return <Spin fullscreen />;
  return isAdmin ? <Outlet /> : <Navigate to="/403" replace />;
}
