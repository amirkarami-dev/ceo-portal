import type { ReactNode } from "react";
import { SafetyCertificateOutlined, TeamOutlined } from "@ant-design/icons";

export interface NavItem {
  /** Route path — also the Menu key. */
  key: string;
  label: string;
  icon: ReactNode;
}

/** The Sider menu, in order. Every entry has a route in app/router.tsx. */
export const NAV_ITEMS: NavItem[] = [
  { key: "/", label: "کاربران", icon: <TeamOutlined /> },
  { key: "/reference", label: "نقش‌ها و سرویس‌ها", icon: <SafetyCertificateOutlined /> },
];

/** Longest-prefix match so /reference/x still highlights /reference (and "/" only matches exactly). */
export function selectedNavKey(pathname: string): string {
  const match = NAV_ITEMS.filter((i) => i.key !== "/")
    .filter((i) => pathname === i.key || pathname.startsWith(`${i.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return match?.key ?? "/";
}
