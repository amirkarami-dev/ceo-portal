import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar, Button, Layout, Space, Tooltip, Typography, theme } from "antd";
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbFilled,
  BulbOutlined,
  SettingOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useThemeMode } from "../theme/useThemeMode";
import { MOTION, useEnter } from "../theme/motion";
import { AppSwitcher } from "./AppSwitcher";

const { Header, Sider, Content } = Layout;

/** AntD's `lg` breakpoint, the same one the Sider collapses at. */
const MOBILE_QUERY = "(max-width: 991.98px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

interface NavEntry {
  key: string;
  icon: ReactNode;
  label: string;
}

/**
 * One nav row.
 *
 * The highlight is a single element shared by every row (`layoutId`), so moving
 * between pages slides one pill instead of fading one out and another in. It is
 * the one piece of motion in the shell; everything else here stays still.
 *
 * Under "reduce motion" the same pill renders without `layoutId` — framer-motion
 * does not disable layout animations on its own, and a plain element simply
 * appears where it belongs.
 */
function NavItem({
  entry,
  active,
  collapsed,
  reduced,
  onSelect,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  reduced: boolean;
  onSelect: (key: string) => void;
}) {
  const button = (
    <button
      type="button"
      className="room-nav-item"
      aria-current={active ? "page" : undefined}
      aria-label={entry.label}
      onClick={() => onSelect(entry.key)}
      style={{ justifyContent: collapsed ? "center" : "flex-start" }}
    >
      {active &&
        (reduced ? (
          <span className="room-nav-pill" />
        ) : (
          <motion.span
            layoutId="room-nav-pill"
            className="room-nav-pill"
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
          />
        ))}
      <span className="room-nav-icon">{entry.icon}</span>
      {!collapsed && <span className="room-nav-label">{entry.label}</span>}
    </button>
  );

  // Collapsed to an icon rail, a tooltip is the only thing naming the destination.
  return collapsed ? (
    <Tooltip title={entry.label} placement="left">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const reduced = useReducedMotion() === true;
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();
  const pageEnter = useEnter();

  // Attending first — that is what almost everyone opening this app is here to do. The admin item is
  // hidden for non-admins; the route is guarded too, so this is presentation only.
  const items: NavEntry[] = [
    { key: "/", icon: <VideoCameraOutlined />, label: "جلسات من" },
    ...(isAdmin ? [{ key: "/admin", icon: <SettingOutlined />, label: "مدیریت جلسات" }] : []),
  ];

  // /admin/new and /admin/12 must still light up «مدیریت جلسات»; an exact pathname match would leave
  // the menu with nothing selected on every child route. "/" is matched exactly, or it would stay lit
  // on every page.
  const isActive = (key: string) =>
    key === "/"
      ? location.pathname === "/"
      : location.pathname === key || location.pathname.startsWith(`${key}/`);

  // On a phone the sider is an overlay, so choosing a destination also closes it.
  const onSelect = useCallback(
    (key: string) => {
      navigate(key);
      if (isMobile) setCollapsed(true);
    },
    [navigate, isMobile],
  );

  const drawerOpen = isMobile && !collapsed;

  // A panel covering the screen needs a way out that is not the button behind it.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  /**
   * Two different siders.
   *
   * Desktop: in flow, and collapsing leaves a 76px icon rail rather than nothing.
   * Phone: taken out of flow and slid off the inline-start edge, which is the
   * right in RTL. It used to stay in flow, so opening the menu on a 375px screen
   * squeezed the page itself into the remaining 135px.
   */
  const siderStyle: CSSProperties = isMobile
    ? {
        position: "fixed",
        insetBlock: 0,
        insetInlineStart: 0,
        zIndex: 30,
        // Transform, not width: nothing reflows while the panel moves.
        transform: collapsed ? "translateX(100%)" : "none",
        transition: reduced ? "none" : `transform ${MOTION.base}s cubic-bezier(0.2, 0.8, 0.2, 1)`,
        boxShadow: collapsed ? "none" : "var(--shadow-3)",
      }
    : { borderInlineEnd: "1px solid var(--line)" };

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      <Sider
        collapsible
        // On a phone the width never changes — the transform hides it — so AntD's
        // own collapse is only asked to do anything on desktop.
        collapsed={isMobile ? false : collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 76}
        trigger={null}
        width={240}
        style={siderStyle}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: !isMobile && collapsed ? "center" : "flex-start",
            gap: 10,
            padding: !isMobile && collapsed ? 0 : "0 20px",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: token.colorPrimary,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              flex: "0 0 auto",
            }}
          >
            <VideoCameraOutlined />
          </div>
          {(isMobile || !collapsed) && (
            <Typography.Text
              strong
              style={{ fontSize: 15, whiteSpace: "nowrap", letterSpacing: "-0.2px" }}
            >
              جلسات آنلاین
            </Typography.Text>
          )}
        </div>

        <nav className="room-nav" aria-label="بخش‌های برنامه">
          {items.map((entry) => (
            <NavItem
              key={entry.key}
              entry={entry}
              active={isActive(entry.key)}
              collapsed={!isMobile && collapsed}
              reduced={reduced}
              onSelect={onSelect}
            />
          ))}
        </nav>
      </Sider>

      {drawerOpen && (
        <div
          role="presentation"
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(7, 11, 20, 0.55)",
          }}
        />
      )}

      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid var(--line)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            // Translucent, so content scrolling under it stays faintly visible
            // instead of disappearing behind a solid bar.
            background: "var(--glass)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
          }}
        >
          <Button
            type="text"
            className="room-tap"
            aria-label="باز و بسته کردن منو"
            aria-expanded={!collapsed}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
          <div style={{ flex: 1 }} />
          {/* AppSwitcher.tsx is byte-identical across the SPAs, so the `room` entry lands in all of
              them together at deploy time (step 10). Until then this key simply matches nothing in the
              other six and no tile is highlighted — the switcher still works. */}
          <AppSwitcher currentKey="room" />
          <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
            <Button
              type="text"
              className="room-tap"
              aria-label="تغییر پوسته روشن و تیره"
              icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggle}
            />
          </Tooltip>
          <Space size={8} style={{ marginInlineStart: 4 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
            {/* The name is the first thing to go on a narrow header: the avatar
                already says who is signed in, and logout must stay reachable. */}
            {user && !isMobile && (
              <Typography.Text
                style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {user.name}
              </Typography.Text>
            )}
          </Space>
          <Tooltip title="خروج">
            <Button type="text" danger className="room-tap" aria-label="خروج" icon={<LogoutOutlined />} onClick={logout} />
          </Tooltip>
        </Header>

        <Content style={{ padding: isMobile ? 16 : 24 }}>
          <motion.div
            key={location.pathname}
            {...pageEnter}
            style={{ maxWidth: 1200, margin: "0 auto" }}
          >
            <Outlet />
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
}
