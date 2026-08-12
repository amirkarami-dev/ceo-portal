import type { ReactNode } from "react";
import { useMemo } from "react";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  ControlOutlined,
  DatabaseOutlined,
  ExportOutlined,
  FileTextOutlined,
  HeartOutlined,
  HomeOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import type { Permission } from "../contracts/rbac";
import { canManageDashboards } from "../features/dashboards/can-manage";
import "./sidebar.css";

type Item = {
  key: string;
  labelKey: string;
  icon: ReactNode;
  need?: Permission;
  adminAny?: boolean;
  /** Hidden unless the routes would actually let this person through — see can-manage.ts. */
  dashboardManager?: boolean;
  featured?: boolean;
};
type Group = { titleKey?: string; items: Item[] };

const USER_GROUPS: Group[] = [
  {
    items: [
      { key: "/dashboards", labelKey: "nav.dashboards", icon: <AppstoreOutlined /> },
      {
        key: "/manage-dashboards",
        labelKey: "nav.manageDashboards",
        icon: <ControlOutlined />,
        dashboardManager: true,
      },
      { key: "/ask", labelKey: "nav.ask", icon: <RobotOutlined />, featured: true },
    ],
  },
  {
    titleKey: "nav.groupContent",
    items: [
      { key: "/reports", labelKey: "nav.reports", icon: <FileTextOutlined /> },
      { key: "/favorites", labelKey: "nav.favorites", icon: <HeartOutlined /> },
    ],
  },
  { titleKey: "nav.groupData", items: [{ key: "/data", labelKey: "nav.data", icon: <DatabaseOutlined /> }] },
  {
    titleKey: "nav.groupOutput",
    items: [{ key: "/exports", labelKey: "nav.exports", icon: <ExportOutlined />, need: "data:export" }],
  },
  {
    items: [
      { key: "/profile", labelKey: "nav.profile", icon: <UserOutlined /> },
      { key: "/settings", labelKey: "nav.settings", icon: <SettingOutlined /> },
      { key: "/admin", labelKey: "nav.admin", icon: <SafetyCertificateOutlined />, adminAny: true },
    ],
  },
];

const ADMIN_GROUPS: Group[] = [
  { items: [{ key: "/admin", labelKey: "nav.adminOverview", icon: <HomeOutlined /> }] },
  {
    titleKey: "nav.groupAccess",
    items: [
      { key: "/admin/users", labelKey: "nav.users", icon: <TeamOutlined />, need: "users:manage" },
      { key: "/admin/roles", labelKey: "nav.roles", icon: <SafetyCertificateOutlined /> },
    ],
  },
  {
    titleKey: "nav.groupDataSemantics",
    items: [
      { key: "/admin/data-sources", labelKey: "nav.dataSources", icon: <DatabaseOutlined />, need: "datasources:manage" },
      { key: "/admin/semantic-models", labelKey: "nav.semanticModels", icon: <ApartmentOutlined />, need: "datasources:manage" },
    ],
  },
  {
    titleKey: "nav.groupAi",
    items: [
      { key: "/admin/ai/providers", labelKey: "nav.aiProviders", icon: <RobotOutlined />, need: "ai:manage" },
      { key: "/admin/ai/routing", labelKey: "nav.aiRouting", icon: <ApartmentOutlined />, need: "ai:manage" },
      { key: "/admin/ai/prompts", labelKey: "nav.aiPrompts", icon: <FileTextOutlined />, need: "ai:manage" },
      { key: "/admin/ai/usage", labelKey: "nav.aiUsage", icon: <BarChartOutlined />, need: "ai:manage" },
    ],
  },
  {
    titleKey: "nav.groupTenant",
    items: [
      { key: "/admin/tenant", labelKey: "nav.tenantSettings", icon: <SettingOutlined /> },
      { key: "/admin/tenant/quota", labelKey: "nav.quota", icon: <BarChartOutlined /> },
    ],
  },
  {
    titleKey: "nav.groupGovernance",
    items: [{ key: "/admin/audit", labelKey: "nav.audit", icon: <AuditOutlined />, need: "audit:read" }],
  },
  { titleKey: "nav.groupPlatform", items: [{ key: "/admin/tenants", labelKey: "nav.tenants", icon: <ApartmentOutlined /> }] },
  { items: [{ key: "/", labelKey: "nav.backToWorkspace", icon: <AppstoreOutlined /> }] },
];

export function Sidebar({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  /** Icon-only rail. antd supplies the per-item tooltips; the group titles are ours to drop. */
  collapsed?: boolean;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { can, isAdmin, roles } = useAuth();
  const isAdminZone = loc.pathname.startsWith("/admin");
  const selectedKey = loc.pathname.startsWith("/dashboards")
    ? "/dashboards"
    : loc.pathname.startsWith("/ask")
      ? "/ask"
      : loc.pathname;

  const { items } = useMemo(() => {
    const groups = isAdminZone ? ADMIN_GROUPS : USER_GROUPS;
    const visible = (it: Item) => {
      if (it.adminAny) return isAdmin;
      if (it.dashboardManager) return canManageDashboards(roles);
      if (it.key === "/admin/tenants") return roles.includes("SuperAdmin");
      if (it.need) return can(it.need);
      return true;
    };

    const menuItems: MenuProps["items"] = [];
    groups.forEach((g) => {
      const visibleItems = g.items.filter(visible);
      if (visibleItems.length === 0) return;

      const leafItems = visibleItems.map((it) => ({
        key: it.key,
        label: t(it.labelKey),
        icon: it.icon,
        className: it.featured ? "app-sidebar__featured" : undefined,
      }));

      if (collapsed) {
        // «محتوا», «داده», «خروجی» have nowhere to go in an 80px rail — antd renders the title
        // squashed and clipped. Drop the words and let a rule carry the same grouping.
        if (menuItems.length > 0) {
          menuItems.push({ type: "divider", key: `divider:${g.titleKey ?? leafItems[0].key}` });
        }
        menuItems.push(...leafItems);
      } else if (g.titleKey) {
        const groupKey = `group:${g.titleKey}`;
        menuItems.push({
          key: groupKey,
          type: "group",
          label: t(g.titleKey),
          children: leafItems,
        });
      } else {
        // Groups without a title are flat items
        menuItems.push(...leafItems);
      }
    });

    return { items: menuItems };
  }, [isAdminZone, can, isAdmin, roles, t, collapsed]);

  return (
    <Menu
      id="app-sidebar-nav"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={items}
      onClick={({ key }) => {
        nav(key);
        onNavigate?.();
      }}
      className={`app-sidebar${collapsed ? " app-sidebar--rail" : ""}`}
      style={{ height: "100%", borderInlineEnd: "none" }}
    />
  );
}
