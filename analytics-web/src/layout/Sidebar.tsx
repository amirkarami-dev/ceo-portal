import type { ReactNode } from "react";
import { useMemo } from "react";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
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
import { SidebarHead } from "./SidebarHead";
import { SidebarPrimary } from "./SidebarPrimary";
import "./sidebar.css";

type Item = {
  key: string;
  labelKey: string;
  icon: ReactNode;
  need?: Permission;
  adminAny?: boolean;
  /** Hidden unless the routes would actually let this person through — see can-manage.ts. */
  dashboardManager?: boolean;
};
type Group = { titleKey?: string; items: Item[] };

// /dashboards, /manage-dashboards and /ask are deliberately absent: they are rendered
// as tiles by SidebarPrimary above this menu. Listing them here too would show each of
// them twice.
const USER_GROUPS: Group[] = [
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
  head = true,
}: {
  onNavigate?: () => void;
  /** Icon-only rail. antd supplies the per-item tooltips; the group titles are ours to drop. */
  collapsed?: boolean;
  /** Off in the mobile drawer, which already has a title bar of its own. */
  head?: boolean;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { can, isAdmin, roles } = useAuth();
  const isAdminZone = loc.pathname.startsWith("/admin");
  // /dashboards and /ask used to be folded onto their own menu entries here. They are
  // tiles now, and SidebarPrimary marks its own active one, so this only has to answer
  // for what the menu still contains.
  const selectedKey = loc.pathname;

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
    // A column so the head keeps its height and the menu takes the rest — the menu used
    // to be height:100% on its own, which leaves no room for anything above it.
    <div className="app-sidebar__shell">
      {head && <SidebarHead collapsed={collapsed} />}
      {/* Only in the workspace: the admin zone has its own destinations and none of
          these three appear in it. */}
      {!isAdminZone && <SidebarPrimary collapsed={collapsed} onNavigate={onNavigate} />}
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
        style={{ flex: 1, minHeight: 0, overflowY: "auto", borderInlineEnd: "none" }}
      />
    </div>
  );
}
