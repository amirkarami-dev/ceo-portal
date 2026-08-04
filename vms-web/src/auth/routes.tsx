import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Button, Card, Result, Spin, Tooltip, Typography, theme } from "antd";
import { BulbFilled, BulbOutlined, LoginOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { useAuth } from "./useAuth";
import { getUserManager, readCallbackError, signOutAndRestart, type CallbackFailure } from "./oidc";
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
            fontSize: 26,
            margin: "0 auto 20px",
          }}
        >
          <VideoCameraOutlined />
        </div>
        <Typography.Title level={3} style={{ marginBottom: 6 }}>
          ورود به دوربین‌های نظارتی
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          {/* Staff, not engineers: this panel is Administrator-only, so it goes to the ordinary
              account login rather than the کد ملی + یک‌بار‌مصرف door the welfare and election
              panels use. Saying the wrong one here sends people to a form they cannot satisfy. */}
          با حساب کاربری سازمانی خود وارد شوید
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
  const [failure, setFailure] = useState<CallbackFailure | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Read before signinRedirectCallback() — it consumes the URL, and the only useful sentence
    // («شما به این سرویس دسترسی ندارید.») is in its query string.
    const search = window.location.search;
    getUserManager()
      .signinRedirectCallback()
      .then(() => {
        // Where they were headed before the redirect. A private meeting link sends people through
        // the IdP, and dropping them on the home page afterwards would lose the meeting they were
        // invited to — they would have to find the link again in whatever chat it arrived in.
        const back = sessionStorage.getItem(RETURN_KEY);
        sessionStorage.removeItem(RETURN_KEY);
        navigate(back ?? "/", { replace: true });
      })
      .catch(() => setFailure(readCallbackError(search)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failure) {
    return (
      <Result
        status={failure.isAccessDenied ? "403" : "error"}
        title={failure.isAccessDenied ? "به این سرویس دسترسی ندارید" : "ورود ناموفق بود"}
        subTitle={failure.message ?? undefined}
        extra={
          <Button type="primary" onClick={() => void signOutAndRestart()}>
            {failure.isAccessDenied ? "ورود با حساب دیگر" : "تلاش دوباره"}
          </Button>
        }
      />
    );
  }
  return <Spin tip="در حال ورود…" fullscreen />;
}

/** Where to come back to after the IdP round trip. Set before calling `login()`. */
export const RETURN_KEY = "room-web.return-to";

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
