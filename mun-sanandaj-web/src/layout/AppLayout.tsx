import { useState } from "react";
import { Avatar, Button, Layout, Menu, Space, Tooltip, Typography, theme } from "antd";
import {
  DashboardOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbFilled,
  BulbOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useThemeMode } from "../theme/useThemeMode";
import { AppSwitcher } from "./AppSwitcher";

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const items = [
    { key: "/", icon: <DashboardOutlined />, label: "داشبورد" },
    { key: "/logs", icon: <FileSearchOutlined />, label: "تاریخچه ارسال‌ها" },
  ];

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
            م
          </div>
          {!collapsed && (
            <Typography.Text strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>
               وب سرویس شهرداری
            </Typography.Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
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
          <AppSwitcher currentKey="mun-sanandaj" />
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
