import { Layout, Select, Button, Dropdown, Space, Avatar, Tooltip } from "antd";
import { SunOutlined, MoonOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { useUiStore } from "../store/ui-store";
import { useTenantStore } from "../store/tenant-store";
import { useTenants } from "../api/queries";
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

export function Topbar() {
  const { t } = useTranslation();
  const { user, roles, logout, setMockRole } = useAuth();
  const { locale, setLocale, themeMode, toggleTheme } = useUiStore();
  const { currentTenantId, setCurrentTenant } = useTenantStore();
  const { data: tenants = [] } = useTenants();

  const toggleLocale = () => {
    const next = locale === "fa" ? "en" : "fa";
    setLocale(next);
    applyLocale(next);
  };

  const themeLabel =
    themeMode === "dark" ? t("common.theme.light") : t("common.theme.dark");

  return (
    <Header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--rw-surface-1)",
        paddingInline: 16,
      }}
    >
      <Select
        aria-label={t("tenant.switcher")}
        value={currentTenantId ?? undefined}
        placeholder={t("tenant.switcher")}
        style={{ minWidth: 180 }}
        onChange={(v) => setCurrentTenant(v)}
        options={tenants.map((tn) => ({ value: tn.id, label: tn.displayName }))}
      />
      <div style={{ flex: 1 }} />
      <AppSwitcher currentKey="analytics" locale={locale} />
      {useMock && (
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
