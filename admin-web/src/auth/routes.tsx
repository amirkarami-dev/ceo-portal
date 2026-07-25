import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Button, Card, Result, Space, Spin, Tooltip, Typography, theme } from "antd";
import { BulbFilled, BulbOutlined, LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import { useAuth } from "./useAuth";
import { getUserManager } from "./oidc";
import { useUiStore } from "@/store/ui";

/** Full-height wrapper that paints the themed layout background behind standalone screens. */
function ScreenShell({ children }: { children: ReactNode }) {
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

export function LoginScreen() {
  const { login, user, ready } = useAuth();
  const { themeMode, toggleTheme } = useUiStore();
  const { token } = theme.useToken();

  if (ready && user) return <Navigate to="/" replace />;

  return (
    <ScreenShell>
      <Tooltip title={themeMode === "dark" ? "حالت روشن" : "حالت تیره"}>
        <Button
          type="text"
          aria-label="تغییر پوسته روشن و تیره"
          icon={themeMode === "dark" ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggleTheme}
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
          پنل مدیریت کاربران
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          برای مدیریت کاربران سکو وارد شوید
        </Typography.Text>
        <Button type="primary" size="large" block icon={<LoginOutlined />} onClick={login}>
          ورود
        </Button>
      </Card>
    </ScreenShell>
  );
}

export function OidcCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Exactly once: the PKCE state is consumed by the first call, so a second run throws
    // "No matching state" and flashes a bogus error.
    if (ran.current) return;
    ran.current = true;
    getUserManager()
      .signinRedirectCallback()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("ورود ناموفق بود"));
  }, [navigate]);

  if (error) {
    return (
      <ScreenShell>
        <Result
          status="error"
          title={error}
          extra={
            <Button type="primary" onClick={() => navigate("/login", { replace: true })}>
              تلاش دوباره
            </Button>
          }
        />
      </ScreenShell>
    );
  }
  return <Spin tip="در حال ورود…" fullscreen />;
}

/** Rendered inside the hidden silent-renew iframe. Renders nothing; failures are non-fatal. */
export function OidcSilentCallback() {
  useEffect(() => {
    getUserManager()
      .signinSilentCallback()
      .catch(() => {
        /* silent renew failed — the next interactive navigation re-auths */
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
      <Result title="از حساب خود خارج شدید" />
    </ScreenShell>
  );
}

/** Signed in, but without the Administrator role the admin API requires. */
export function AdminRequiredScreen() {
  const { user, logout } = useAuth();
  return (
    <ScreenShell>
      <Result
        status="403"
        title="دسترسی مدیریتی لازم است"
        subTitle={
          <>
            حساب {user?.email || user?.name || "شما"} نقش «مدیر» را ندارد. برای ورود به پنل مدیریت
            کاربران، با حسابی وارد شوید که نقش Administrator داشته باشد.
          </>
        }
        extra={
          <Space>
            <Button type="primary" icon={<LogoutOutlined />} onClick={logout}>
              خروج از حساب
            </Button>
          </Space>
        }
      />
    </ScreenShell>
  );
}

/**
 * The single gate in front of the whole panel: authenticated **and** `Administrator`.
 * Anonymous visitors go to /login; signed-in non-admins get the "admin access required" screen
 * (rendered in place, so they keep a working logout button instead of a redirect loop).
 */
export function RequireAdmin() {
  const { ready, user, isAdmin } = useAuth();
  if (!ready) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <AdminRequiredScreen />;
  return <Outlet />;
}

export function NotFoundScreen() {
  const navigate = useNavigate();
  return (
    <ScreenShell>
      <Result
        status="404"
        title="۴۰۴"
        subTitle="صفحه‌ای که دنبالش بودید پیدا نشد."
        extra={
          <Button type="primary" onClick={() => navigate("/", { replace: true })}>
            بازگشت به کاربران
          </Button>
        }
      />
    </ScreenShell>
  );
}
