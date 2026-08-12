import { AppstoreOutlined, ControlOutlined, RobotOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { canManageDashboards } from "../features/dashboards/can-manage";
import "./sidebar-primary.css";

type Primary = { to: string; labelKey: string; icon: ReactNode; managerOnly?: boolean };

/**
 * The three destinations this app exists for. They used to be three more rows in the
 * same list as «تنظیمات» and «پروفایل», which gave a daily job and a rarely-touched one
 * identical weight — «گزارش‌ساز هوشمند» already fought that with a green pill, a patch
 * over the same problem.
 *
 * The pair comes first because they are one subject at two altitudes: look at
 * dashboards, and manage them. «گزارش‌ساز هوشمند» takes its own row because it is a
 * different act — it makes something new. The grid says that; no label has to.
 */
const PRIMARY: Primary[] = [
  { to: "/dashboards", labelKey: "nav.dashboards", icon: <AppstoreOutlined /> },
  { to: "/manage-dashboards", labelKey: "nav.manageDashboards", icon: <ControlOutlined />, managerOnly: true },
  { to: "/ask", labelKey: "nav.ask", icon: <RobotOutlined /> },
];

export function SidebarPrimary({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { roles } = useAuth();
  const reduceMotion = useReducedMotion();

  const items = PRIMARY.filter((p) => !p.managerOnly || canManageDashboards(roles));
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  // With «مدیریت داشبوردها» hidden the pair is a single tile, so it takes the whole
  // row rather than sitting next to a hole.
  const pairCount = items.filter((p) => p.to !== "/ask").length;

  return (
    <div
      className={`sidebar-primary${collapsed ? " sidebar-primary--rail" : ""}`}
      role="navigation"
      aria-label={t("nav.primary")}
    >
      {items.map((p) => {
        const active = isActive(p.to);
        const label = t(p.labelKey);
        const wide = p.to === "/ask" || (p.to !== "/ask" && pairCount === 1);

        const tile = (
          <Link
            key={p.to}
            to={p.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={`sidebar-primary__tile${wide ? " sidebar-primary__tile--wide" : ""}${
              active ? " is-active" : ""
            }`}
          >
            {/* One object moving between three places, rather than three separate
                repaints. layoutId is what makes it the same object to framer. */}
            {active && (
              <motion.span
                layoutId="sidebar-primary-active"
                className="sidebar-primary__chip"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
                }
              />
            )}
            <span className="sidebar-primary__icon">{p.icon}</span>
            {!collapsed && <span className="sidebar-primary__label">{label}</span>}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={p.to} title={label} placement="left">
            {tile}
          </Tooltip>
        ) : (
          tile
        );
      })}
    </div>
  );
}
