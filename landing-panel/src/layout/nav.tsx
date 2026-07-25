import type { ReactNode } from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  LinkOutlined,
  MailOutlined,
  PictureOutlined,
  ProfileOutlined,
  SettingOutlined,
  SolutionOutlined,
  TagsOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

export interface NavItem {
  /** Route path — also the Menu key. */
  key: string;
  label: string;
  icon: ReactNode;
}

/** The Sider menu, in order. Every entry has a route in app/router.tsx. */
export const NAV_ITEMS: NavItem[] = [
  { key: "/", label: "داشبورد", icon: <DashboardOutlined /> },
  { key: "/news", label: "اخبار", icon: <FileTextOutlined /> },
  { key: "/categories", label: "دسته‌بندی‌ها", icon: <TagsOutlined /> },
  { key: "/slides", label: "اسلایدر", icon: <PictureOutlined /> },
  { key: "/quick-links", label: "پیوندهای سریع", icon: <ThunderboltOutlined /> },
  { key: "/footer-links", label: "پیوندهای فوتر", icon: <LinkOutlined /> },
  { key: "/people", label: "اعضا", icon: <TeamOutlined /> },
  { key: "/units", label: "واحدها", icon: <ApartmentOutlined /> },
  { key: "/tab-groups", label: "گروه‌های تب", icon: <AppstoreOutlined /> },
  { key: "/org-pages", label: "صفحات سازمان", icon: <ProfileOutlined /> },
  { key: "/forms", label: "فرم‌ها", icon: <FormOutlined /> },
  { key: "/submissions", label: "ثبت‌نام‌ها", icon: <SolutionOutlined /> },
  { key: "/messages", label: "پیام‌ها", icon: <MailOutlined /> },
  { key: "/settings", label: "تنظیمات", icon: <SettingOutlined /> },
];

/** Longest-prefix match so /news/5 still highlights /news (and "/" only matches exactly). */
export function selectedNavKey(pathname: string): string {
  const match = NAV_ITEMS.filter((i) => i.key !== "/")
    .filter((i) => pathname === i.key || pathname.startsWith(`${i.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return match?.key ?? "/";
}
