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

  // Same shell as the guest landing, and for the same reason: both are one card on an
  // empty page with no app chrome. This screen carried its own copy of the wash in the
  // OLD brand blue over the old grounds, so it kept the pre-redesign palette after
  // every other surface had moved on.
  return (
    <div className="room-join-shell">
      <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
        <Button
          type="text"
          aria-label="تغییر پوسته روشن و تیره"
          className="room-tap"
          icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggle}
          style={{ position: "absolute", top: 20, insetInlineStart: 20 }}
        />
      </Tooltip>
      <Card
        className="room-join-card"
        variant="borderless"
        // Inline: a borderless AntD card sets its own box-shadow from a rule that
        // outranks a single class, and AntD injects after our stylesheet.
        style={{ width: "100%", maxWidth: 380, boxShadow: "var(--shadow-3)" }}
        styles={{ body: { padding: "clamp(24px, 8vw, 40px)", textAlign: "center" } }}
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
        {/* The page has no other heading, so this is its h1. */}
        <Typography.Title level={1} style={{ marginBottom: 6, fontSize: 24, fontWeight: 700 }}>
          ورود به جلسات آنلاین
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          {/* The IdP routes this client to the engineer login (کد ملی + یک‌بار‌مصرف), so say so here —
              otherwise the button looks like it wants a username and password. */}
          با کد ملی و کد یک‌بار‌مصرف پیامکی وارد شوید
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
        minHeight: "100dvh",
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
