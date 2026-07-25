import { useMemo } from "react";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import type { Permission } from "../contracts/rbac";

type Item = { key: string; labelKey: string; need?: Permission; adminAny?: boolean };
type Group = { titleKey?: string; items: Item[] };

const USER_GROUPS: Group[] = [
  { items: [{ key: "/ask", labelKey: "nav.ask" }] },
  {
    titleKey: "nav.groupContent",
    items: [
      { key: "/reports", labelKey: "nav.reports" },
      { key: "/dashboards", labelKey: "nav.dashboards" },
      { key: "/favorites", labelKey: "nav.favorites" },
    ],
  },
  { titleKey: "nav.groupData", items: [{ key: "/data", labelKey: "nav.data" }] },
  {
    titleKey: "nav.groupOutput",
    items: [{ key: "/exports", labelKey: "nav.exports", need: "data:export" }],
  },
  {
    items: [
      { key: "/profile", labelKey: "nav.profile" },
      { key: "/settings", labelKey: "nav.settings" },
      { key: "/admin", labelKey: "nav.admin", adminAny: true },
    ],
  },
];

const ADMIN_GROUPS: Group[] = [
  { items: [{ key: "/admin", labelKey: "nav.adminOverview" }] },
  {
    titleKey: "nav.groupAccess",
    items: [
      { key: "/admin/users", labelKey: "nav.users", need: "users:manage" },
      { key: "/admin/roles", labelKey: "nav.roles" },
    ],
  },
  {
    titleKey: "nav.groupDataSemantics",
    items: [
      { key: "/admin/data-sources", labelKey: "nav.dataSources", need: "datasources:manage" },
      { key: "/admin/semantic-models", labelKey: "nav.semanticModels", need: "datasources:manage" },
    ],
  },
  {
    titleKey: "nav.groupAi",
    items: [
      { key: "/admin/ai/providers", labelKey: "nav.aiProviders", need: "ai:manage" },
      { key: "/admin/ai/routing", labelKey: "nav.aiRouting", need: "ai:manage" },
      { key: "/admin/ai/prompts", labelKey: "nav.aiPrompts", need: "ai:manage" },
      { key: "/admin/ai/usage", labelKey: "nav.aiUsage", need: "ai:manage" },
    ],
  },
  {
    titleKey: "nav.groupTenant",
    items: [
      { key: "/admin/tenant", labelKey: "nav.tenantSettings" },
      { key: "/admin/tenant/quota", labelKey: "nav.quota" },
    ],
  },
  {
    titleKey: "nav.groupGovernance",
    items: [{ key: "/admin/audit", labelKey: "nav.audit", need: "audit:read" }],
  },
  { titleKey: "nav.groupPlatform", items: [{ key: "/admin/tenants", labelKey: "nav.tenants" }] },
  { items: [{ key: "/", labelKey: "nav.backToWorkspace" }] },
];

export function Sidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { can, isAdmin, roles } = useAuth();
  const isAdminZone = loc.pathname.startsWith("/admin");

  const { items, defaultOpenKeys } = useMemo(() => {
    const groups = isAdminZone ? ADMIN_GROUPS : USER_GROUPS;
    const visible = (it: Item) => {
      if (it.adminAny) return isAdmin;
      if (it.key === "/admin/tenants") return roles.includes("SuperAdmin");
      if (it.need) return can(it.need);
      return true;
    };

    const menuItems: MenuProps["items"] = [];
    const openKeys: string[] = [];

    groups.forEach((g) => {
      const visibleItems = g.items.filter(visible);
      if (visibleItems.length === 0) return;

      const leafItems = visibleItems.map((it) => ({
        key: it.key,
        label: t(it.labelKey),
      }));

      if (g.titleKey) {
        // Groups with a title become collapsible sub-menus
        const groupKey = `group:${g.titleKey}`;
        openKeys.push(groupKey);
        menuItems.push({
          key: groupKey,
          label: t(g.titleKey),
          children: leafItems,
        });
      } else {
        // Groups without a title are flat items
        menuItems.push(...leafItems);
      }
    });

    return { items: menuItems, defaultOpenKeys: openKeys };
  }, [isAdminZone, can, isAdmin, roles, t]);

  return (
    <Menu
      mode="inline"
      selectedKeys={[loc.pathname]}
      defaultOpenKeys={defaultOpenKeys}
      items={items}
      onClick={({ key }) => nav(key)}
      style={{ height: "100%", borderInlineEnd: "none" }}
    />
  );
}
