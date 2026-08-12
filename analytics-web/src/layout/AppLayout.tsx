import { useState } from "react";
import { Drawer, Grid, Layout, theme } from "antd";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { AmbientBackground } from "./AmbientBackground";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useUiStore } from "../store/ui-store";

const { Sider, Content } = Layout;
const { useToken } = theme;

export function AppLayout() {
  const { t } = useTranslation();
  const { sidebarCollapsed, dir, themeMode } = useUiStore();
  const { token } = useToken();
  // A 240px sider leaves dashboard cards unusably narrow on phones, so mobile navigation
  // is removed from the flex row entirely and rendered in a drawer instead.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // In RTL layouts (fa), the sider should appear on the right.
  // antd Layout renders Sider before the inner Layout for LTR (left),
  // so for RTL we reverse the order using CSS flex direction.
  const isRtl = dir === "rtl";

  const sider = (
    <Sider
      collapsible
      collapsed={sidebarCollapsed}
      trigger={null}
      theme={themeMode === "dark" ? "dark" : "light"}
      style={{
        background: token.colorBgContainer,
        borderInlineStart: isRtl ? `1px solid ${token.colorBorderSecondary}` : undefined,
        borderInlineEnd: !isRtl ? `1px solid ${token.colorBorderSecondary}` : undefined,
      }}
      width={240}
      collapsedWidth={80}
    >
      <Sidebar collapsed={sidebarCollapsed} />
    </Sider>
  );

  const main = (
    // Transparent so the ambient backdrop shows through the gutters; the Content card
    // itself stays solid (colorBgContainer) and readable.
    <Layout style={{ background: "transparent", minWidth: 0, maxWidth: "100%" }}>
      <Topbar isMobile={isMobile} onMenuClick={() => setDrawerOpen(true)} />
      <Content
        style={{
          margin: isMobile ? 8 : 16,
          padding: isMobile ? 12 : 16,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          minHeight: 280,
          minWidth: 0,
          maxWidth: isMobile ? "calc(100vw - 16px)" : undefined,
          overflowX: "auto",
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: token.colorBgLayout,
        flexDirection: isRtl ? "row-reverse" : "row",
      }}
    >
      {/* Fixed + pointer-events:none → out of the flex flow, so antd's Sider detection is
          untouched; later siblings paint above it in DOM order. */}
      <AmbientBackground />
      {isMobile ? (
        <>
          {main}
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            placement={isRtl ? "right" : "left"}
            width={260}
            title={t("common.appName")}
            styles={{ body: { padding: 0 } }}
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      ) : isRtl ? (
        <>
          {main}
          {sider}
        </>
      ) : (
        <>
          {sider}
          {main}
        </>
      )}
    </Layout>
  );
}
