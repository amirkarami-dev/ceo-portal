import { useState } from "react";
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Space,
  Tooltip,
  Typography,
  theme,
} from "antd";
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
  const { user, logout } = useAuth();
  const { themeMode, toggleTheme, sidebarCollapsed, toggleSidebar } = useUiStore();

  const selected = selectedNavKey(location.pathname);
  const themeLabel = themeMode === "dark" ? "حالت روشن" : "حالت تیره";

  // A 232px sider left in the flex row at 375px pushed the whole app shell sideways: the page
  // scrolled horizontally and the far edge of every table was unreachable. Collapsing it is not
  // enough — an auto-collapsed Sider is still a flex child. Below `md` it leaves the row entirely
  // and the same menu is served from a Drawer. See GOTCHAS.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

  /** One menu, rendered in two places, so the drawer can never drift from the sider. */
  const menu = (onNavigate?: () => void) => (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={NAV_ITEMS.map((i) => ({ key: i.key, label: i.label, icon: i.icon }))}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
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
          ک
        </div>
        {!sidebarCollapsed ? (
          <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
            پنل مدیریت
          </Typography.Text>
        ) : null}
      </div>
      {menu()}
    </Sider>
  );

  const main = (
    // minWidth 0 is load-bearing, not tidiness. This is a flex child of the row-reverse Layout
    // below, and a flex child defaults to min-width:auto — so CrudTable's 900px scroll floor
    // stretched this column and the whole PAGE scrolled sideways on a phone, instead of the table
    // scrolling inside its own box. See GOTCHAS, "a desktop sider must leave the flex row".
    <Layout style={{ minWidth: 0 }}>
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
          aria-label={isMobile || sidebarCollapsed ? "باز کردن منو" : "بستن منو"}
          aria-expanded={isMobile ? drawerOpen : !sidebarCollapsed}
          // 44px on a phone: the platform minimum for a touch target, and this is the control every
          // other page depends on.
          style={isMobile ? { width: 44, height: 44 } : undefined}
          icon={isMobile || sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => (isMobile ? setDrawerOpen(true) : toggleSidebar())}
        />
        {/* The app name lives in the sider; on a phone the sider is gone, so the header carries it. */}
        {isMobile ? (
          <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
            پنل مدیریت
          </Typography.Text>
        ) : null}
        <div style={{ flex: 1 }} />
        <AppSwitcher currentKey="landing-panel" />
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
            {/* Dropped first on a narrow header: the avatar already says who is signed in, and the
                space is needed by the controls. */}
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
          margin: isMobile ? 8 : 16,
          padding: isMobile ? 12 : 20,
          minWidth: 0,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          minHeight: 280,
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
      {isMobile ? null : sider}

      {/* Right, because the whole panel is RTL — a drawer sliding in from the left would come from
          the side the back gesture lives on and read as backwards. */}
      <Drawer
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="right"
        width={260}
        title="پنل مدیریت"
        styles={{ body: { padding: 0 } }}
      >
        {menu(() => setDrawerOpen(false))}
      </Drawer>
    </Layout>
  );
}
