import { useState } from "react";
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Tooltip, Typography, theme } from "antd";
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
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useThemeMode } from "../theme/useThemeMode";
import { AppSwitcher } from "./AppSwitcher";

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // A 240px sider leaves a camera tile unusably narrow on a phone. Below `md` the sider leaves the
  // flex row entirely and navigation moves into a drawer — the same fix analytics-web and
  // walfare-web already carry, and the reason is recorded in GOTCHAS: an auto-collapsed Sider is
  // still a flex child, so opening it *pushes* the page sideways instead of overlaying it.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Watching first — that is what somebody opening this app is here to do; managing the list is the
  // occasional task. Everyone who can reach this layout is an administrator (see router.tsx), so the
  // isAdmin check is belt and braces rather than a real branch.
  const items = [
    { key: "/", icon: <VideoCameraOutlined />, label: "تصویر زنده" },
    ...(isAdmin ? [{ key: "/admin", icon: <SettingOutlined />, label: "مدیریت دوربین‌ها" }] : []),
  ];

  // /admin/new and /admin/12 must still light up «مدیریت دوربین‌ها»; an exact pathname match would leave
  // the menu with nothing selected on every child route. "/" is matched exactly, or it would stay lit
  // on every page.
  const selected = items
    .map((i) => i.key)
    .filter((k) =>
      k === "/" ? location.pathname === "/" : location.pathname === k || location.pathname.startsWith(`${k}/`),
    );

  const brand = (showName: boolean) => (
    <div
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: showName ? "flex-start" : "center",
        gap: 10,
        padding: "0 20px",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: token.colorPrimary,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          flex: "0 0 auto",
        }}
      >
        <VideoCameraOutlined />
      </div>
      {showName && (
        <Typography.Text strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>
          دوربین‌های نظارتی
        </Typography.Text>
      )}
    </div>
  );

  /** The same menu in both places, so the drawer can never drift from the sider. */
  const nav = (onNavigate?: () => void) => (
    <Menu
      mode="inline"
      selectedKeys={selected}
      items={items}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
      style={{ borderInlineEnd: 0, paddingInline: 8 }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null} width={240}>
          {brand(!collapsed)}
          {nav()}
        </Sider>
      )}

      {/* minWidth 0 is load-bearing, not tidiness: a flex child defaults to min-width auto, so the
          478px admin table would stretch this column and push the menu trigger off the screen —
          exactly the failure GOTCHAS records for analytics-web. */}
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingInline: isMobile ? 12 : 24,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            aria-label={isMobile ? "باز کردن منو" : "باز و بسته کردن منو"}
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            // 44px on a phone: the platform minimum for a touch target, and this is the control
            // every other page depends on.
            style={isMobile ? { width: 44, height: 44 } : undefined}
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed((c) => !c))}
          />

          {/* The app name is in the sider on desktop and in the drawer on mobile — but on a phone
              the drawer is shut, so without this the header says nothing about where you are. */}
          {isMobile && (
            <Typography.Text strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>
              دوربین‌های نظارتی
            </Typography.Text>
          )}

          <div style={{ flex: 1, minWidth: 0 }} />

          <AppSwitcher currentKey="vms" />
          <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
            <Button
              type="text"
              aria-label="تغییر پوسته روشن و تیره"
              style={isMobile ? { width: 44, height: 44 } : undefined}
              icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggle}
            />
          </Tooltip>

          <Space size={8} style={{ marginInlineStart: 4 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
            {/* The name is the first thing to go on a narrow header: the avatar already says who is
                signed in, and the space is needed by the controls. */}
            {user && !isMobile && (
              <Typography.Text
                style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {user.name}
              </Typography.Text>
            )}
          </Space>

          <Tooltip title="خروج">
            <Button
              type="text"
              danger
              aria-label="خروج"
              style={isMobile ? { width: 44, height: 44 } : undefined}
              icon={<LogoutOutlined />}
              onClick={logout}
            />
          </Tooltip>
        </Header>

        <Content style={{ padding: isMobile ? 12 : 24, minWidth: 0 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", minWidth: 0 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* Right, because the whole app is RTL — a drawer sliding in from the left would come from
          the side the back gesture lives on and read as backwards. */}
      <Drawer
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="right"
        width={260}
        title="دوربین‌های نظارتی"
        styles={{ body: { padding: 0 } }}
      >
        {nav(() => setDrawerOpen(false))}
      </Drawer>
    </Layout>
  );
}
