import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageHeader, PageContainer } from "../../components/ui";

const TABS = ["providers", "routing", "prompts", "usage"] as const;

export default function AIAdminShell() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const active = TABS.find((k) => loc.pathname.includes(`/admin/ai/${k}`)) ?? "providers";

  return (
    <PageContainer>
      <PageHeader title={t("admin.ai.title")} />
      <Tabs
        activeKey={active}
        onChange={(k) => nav(`/admin/ai/${k}`)}
        items={TABS.map((k) => ({ key: k, label: t(`admin.ai.tab.${k}`) }))}
      />
      <Outlet />
    </PageContainer>
  );
}
