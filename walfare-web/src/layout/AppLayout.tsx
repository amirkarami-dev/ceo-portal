import { useState } from "react";
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Tooltip, Typography, theme } from "antd";
import {
  BulbFilled,
  BulbOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { useUiStore } from "@/store/ui";
import { NAV_ITEMS, selectedNavKey } from "./nav";
import { AppSwitcher } from "./AppSwitcher";

const { Sider, Header, Content } = Layout;

export function AppLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { themeMode, toggleTheme, sidebarCollapsed, toggleSidebar } = useUiStore();

  // On phones/small tablets a 232px column would eat the screen, so the nav becomes a drawer.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selected = selectedNavKey(location.pathname);
  const themeLabel = themeMode === "dark" ? "حالت روشن" : "حالت تیره";

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => ({
        key: i.key,
        label: i.label,
        icon: i.icon,
      }))}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
      style={{ borderInlineEnd: "none", paddingBlock: 8 }}
    />
  );

  const sider = (
    <Sider
      collapsible
      collapsed={sidebarCollapsed}
      trigger={null}
      theme={themeMode === "dark" ? "dark" : "light"}
      width={232}
      style={{
        background: token.colorBgContainer,
        // RTL: the sider sits on the right, so its divider is on the inline-start edge.
        borderInlineStart: `1px solid ${token.colorBorderSecondary}`,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingInline: 16,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flex: "none",
            background: token.colorPrimary,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          ر
        </div>
        {!sidebarCollapsed ? (
          <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
            سامانه رفاهی مهندسین
          </Typography.Text>
        ) : null}
      </div>
      {menu}
    </Sider>
  );

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          flex: "none",
          background: token.colorPrimary,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
        }}
      >
        ر
      </div>
      <Typography.Text strong>سامانه رفاهی مهندسین</Typography.Text>
    </div>
  );

  const main = (
    <Layout>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Button
          type="text"
          aria-label={
            isMobile ? "منو" : sidebarCollapsed ? "باز کردن منو" : "بستن منو"
          }
          icon={
            isMobile || sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
          }
          onClick={() => (isMobile ? setDrawerOpen(true) : toggleSidebar())}
        />
        {/* The sider carries the brand on desktop; on mobile it lives in the header. */}
        {isMobile ? brand : null}
        <div style={{ flex: 1 }} />
        <AppSwitcher currentKey="walfare" />
        <Tooltip title={themeLabel}>
          <Button
            type="text"
            aria-label={themeLabel}
            icon={themeMode === "dark" ? <BulbFilled /> : <BulbOutlined />}
            onClick={toggleTheme}
          />
        </Tooltip>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "who",
                label: user?.email || user?.name || "—",
                disabled: true,
              },
              { type: "divider" },
              {
                key: "logout",
                label: "خروج",
                icon: <LogoutOutlined />,
                danger: true,
                onClick: logout,
              },
            ],
          }}
        >
          <Space style={{ cursor: "pointer", paddingInline: 8 }}>
            <Avatar size="small" icon={<UserOutlined />} />
            {/* The name is the first thing to drop on a narrow header. */}
            {isMobile ? null : (
              <Typography.Text style={{ maxWidth: 160 }} ellipsis>
                {user?.name ?? "کاربر"}
              </Typography.Text>
            )}
          </Space>
        </Dropdown>
      </Header>
      <Content
        style={{
          // Tighter frame on phones — 16+20 each side wastes a third of a 360px screen.
          margin: isMobile ? 8 : 16,
          padding: isMobile ? 12 : 20,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          minHeight: 280,
          // Long words / wide tables must not push the page sideways.
          overflowX: "auto",
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );

  // RTL: AntD renders the Sider first (left in LTR); reversing the flex row puts it on the right.
  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: token.colorBgLayout,
        flexDirection: "row-reverse",
      }}
    >
      {main}
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="right"
          width={260}
          title={brand}
          styles={{ body: { padding: 0 } }}
        >
          {menu}
        </Drawer>
      ) : (
        sider
      )}
    </Layout>
  );
}
