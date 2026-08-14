import { Layout, Select, Button, Dropdown, Space, Avatar, Tooltip } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { useUiStore } from "../store/ui-store";
import { applyLocale } from "../i18n";
import type { AppRole } from "../contracts/rbac";
import { AppSwitcher } from "./AppSwitcher";

const { Header } = Layout;
const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";
const ALL_ROLES: AppRole[] = [
  "SuperAdmin",
  "TenantAdmin",
  "AIManager",
  "ReportDesigner",
  "DashboardDesigner",
  "PowerUser",
  "Viewer",
];

export function Topbar({ isMobile = false, onMenuClick }: { isMobile?: boolean; onMenuClick?: () => void }) {
  const { t } = useTranslation();
  const { user, roles, logout, setMockRole } = useAuth();
  const { locale, setLocale, themeMode, toggleTheme, dir, sidebarCollapsed, toggleSidebar } =
    useUiStore();

  const toggleLocale = () => {
    const next = locale === "fa" ? "en" : "fa";
    setLocale(next);
    applyLocale(next);
  };

  const themeLabel =
    themeMode === "dark" ? t("common.theme.light") : t("common.theme.dark");

  // The chevron points at the edge the sidebar folds towards, and that edge flips with the
  // writing direction — in Persian the sidebar sits on the right, so the icons swap.
  const sidebarLabel = sidebarCollapsed ? t("nav.expandMenu") : t("nav.collapseMenu");
  const foldsAwayFromCentre = sidebarCollapsed === (dir === "rtl");
  const SidebarIcon = foldsAwayFromCentre ? MenuFoldOutlined : MenuUnfoldOutlined;

  return (
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 6 : 12,
        background: "var(--rw-surface-1)",
        paddingInline: isMobile ? 8 : 16,
      }}
    >
      {isMobile && (
        <Button
          type="text"
          aria-label={t("nav.openMenu")}
          icon={<MenuUnfoldOutlined />}
          onClick={onMenuClick}
        />
      )}
      {!isMobile && (
        <Tooltip title={sidebarLabel}>
          <Button
            type="text"
            aria-label={sidebarLabel}
            aria-expanded={!sidebarCollapsed}
            aria-controls="app-sidebar-nav"
            icon={<SidebarIcon />}
            onClick={toggleSidebar}
          />
        </Tooltip>
      )}
      {/* The organisation switcher is deliberately NOT here.
          In real mode the choice was never sent to the server — reportsHttpApi.list() takes no
          tenant and there is no tenant header, so the API scopes by the tenant claim in the token.
          The control therefore looked like it changed organisation and did not. Hiding it only when
          a single tenant existed was not enough: production returns more than one, so it kept
          showing while still changing nothing.
          The plumbing is untouched — useTenantStore still keys the react-query cache, filters the
          mock API and scopes the admin user list — so putting this back is re-adding the Select,
          once the API actually honours a chosen tenant. */}
      <div style={{ flex: 1 }} />
      <AppSwitcher currentKey="analytics" locale={locale} />
      {useMock && !isMobile && (
        <Select
          aria-label={t("auth.selectRole")}
          value={roles[0]}
          style={{ minWidth: 160 }}
          onChange={(r) => setMockRole([r as AppRole])}
          options={ALL_ROLES.map((r) => ({ value: r, label: t(`rbac.role.${r}`) }))}
        />
      )}
      <Button onClick={toggleLocale}>{locale === "fa" ? "EN" : "FA"}</Button>
      <Tooltip title={themeLabel}>
        <Button
          aria-label={themeLabel}
          icon={themeMode === "dark" ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
        />
      </Tooltip>
      <Dropdown
        menu={{ items: [{ key: "logout", label: t("auth.logout"), onClick: logout }] }}
      >
        <Space style={{ cursor: "pointer" }}>
          <Avatar>{user?.name?.[0] ?? "?"}</Avatar>
        </Space>
      </Dropdown>
    </Header>
  );
}
