import type { ReactNode } from "react";
import {
  BankOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  GiftOutlined,
  OrderedListOutlined,
  TagsOutlined,
} from "@ant-design/icons";

export interface NavItem {
  /** Route path — also the Menu key. */
  key: string;
  label: string;
  icon: ReactNode;
  /** Shown only to the Administrator role. */
  adminOnly?: boolean;
}

/** The Sider menu, in order. Admin entries are filtered out for engineers in AppLayout. */
export const NAV_ITEMS: NavItem[] = [
  { key: "/", label: "خدمات رفاهی", icon: <GiftOutlined /> },
  { key: "/reservations", label: "رزروهای من", icon: <CalendarOutlined /> },
  { key: "/admin", label: "مدیریت خدمات", icon: <TagsOutlined />, adminOnly: true },
  { key: "/admin/pools", label: "مدیریت استخرها", icon: <BankOutlined />, adminOnly: true },
  { key: "/admin/reservations", label: "همه رزروها", icon: <OrderedListOutlined />, adminOnly: true },
  { key: "/admin/payments", label: "پرداخت‌ها", icon: <CreditCardOutlined />, adminOnly: true },
];

/** Longest-prefix match so /admin/pools highlights itself, not /admin ("/" matches exactly). */
export function selectedNavKey(pathname: string): string {
  const match = NAV_ITEMS.filter((i) => i.key !== "/")
    .filter((i) => pathname === i.key || pathname.startsWith(`${i.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return match?.key ?? "/";
}
