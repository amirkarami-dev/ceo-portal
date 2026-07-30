import { useState } from "react";
import { Avatar, Button, Layout, Menu, Space, Tooltip, Typography, theme } from "antd";
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbFilled,
  BulbOutlined,
  FormOutlined,
  SettingOutlined,
  UserOutlined,
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
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  // Voting first — that is what almost everyone opening this app is here to do. The admin item is
  // hidden for non-admins; the route is guarded too, so this is presentation only.
  const items = [
    { key: "/", icon: <FormOutlined />, label: "رأی‌گیری" },
    ...(isAdmin ? [{ key: "/admin", icon: <SettingOutlined />, label: "مدیریت انتخابات" }] : []),
  ];

  // /admin/new and /admin/12 must still light up «مدیریت انتخابات»; an exact pathname match would
  // leave the menu with nothing selected on every child route. "/" is matched exactly, or it would
  // stay lit on every page.
  const selected = items
    .map((i) => i.key)
    .filter((k) =>
      k === "/" ? location.pathname === "/" : location.pathname === k || location.pathname.startsWith(`${k}/`),
    );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        width={240}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
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
              fontWeight: 700,
              flex: "0 0 auto",
            }}
          >
            ا
          </div>
          {!collapsed && (
            <Typography.Text strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>
              سامانه انتخابات
            </Typography.Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selected}
          items={items}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0, paddingInline: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            aria-label="باز و بسته کردن منو"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
          <div style={{ flex: 1 }} />
          {/* AppSwitcher.tsx is byte-identical across the SPAs, so the `election` entry lands in all of
              them together at deploy time. Until then this key simply matches nothing and no tile is
              highlighted — the switcher still works. */}
          <AppSwitcher currentKey="election" />
          <Tooltip title={mode === "dark" ? "حالت روشن" : "حالت تیره"}>
            <Button
              type="text"
              aria-label="تغییر پوسته روشن و تیره"
              icon={mode === "dark" ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggle}
            />
          </Tooltip>
          <Space size={8} style={{ marginInlineStart: 4 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
            {user && (
              <Typography.Text
                style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {user.name}
              </Typography.Text>
            )}
          </Space>
          <Tooltip title="خروج">
            <Button type="text" danger aria-label="خروج" icon={<LogoutOutlined />} onClick={logout} />
          </Tooltip>
        </Header>

        <Content style={{ padding: 24 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
