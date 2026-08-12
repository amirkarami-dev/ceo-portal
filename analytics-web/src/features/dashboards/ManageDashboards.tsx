import { Button, Dropdown, Input, Space, Tabs, Tag, message } from "antd";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDashboards, useDeleteDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { formatCategory, toPersianDigits } from "@/presentation/format";
import { EmptyState, PageContainer, Loading } from "@/components/ui";
import { reportOwnerLabel } from "@/features/library/report-display";
import { canManageDashboards } from "./can-manage";
import "./dashboards.css";

/**
 * Making dashboards, not reading them. Looking at a dashboard is a daily job and
 * lives on /dashboards; renaming or deleting one is rare, so it was taking room
 * from the widgets on the page people actually use.
 */
export function ManageDashboards() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const { data, isLoading } = useDashboards();
  const del = useDeleteDashboard();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  const rtl = i18n.dir() === "rtl";
  const num = (n: number) => (rtl ? toPersianDigits(n) : String(n));
  const canManage = canManageDashboards(roles);

  const boards = useMemo(() => {
    const all = [...(data ?? [])];
    const scoped =
      tab === "mine"
        ? all.filter((d) => d.ownerName === user?.id)
        : tab === "recent"
          ? all.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8)
          : all;
    const query = q.trim().toLowerCase();
    return query ? scoped.filter((d) => d.name.toLowerCase().includes(query)) : scoped;
  }, [data, q, tab, user?.id]);

  const widgetTotal = useMemo(
    () => (data ?? []).reduce((a, d) => a + d.widgets.length, 0),
    [data],
  );

  const open = (id: string) => void navigate(`/dashboards?d=${encodeURIComponent(id)}`);

  const remove = (id: string, name: string) => {
    del.mutate(id, {
      onSuccess: () => void message.success(t("dash.deleted", { name })),
      onError: () => void message.error(t("dash.deleteError")),
    });
  };

  if (isLoading) return <Loading rows={6} />;

  return (
    <PageContainer>
      <div className="dash-hero">
        <div className="dash-hero__glow" aria-hidden />
        <div className="dash-hero__text">
          <h1 className="dash-hero__title">
            <SettingOutlined /> {t("dash.manageTitle")}
          </h1>
          <p className="dash-hero__subtitle">{t("dash.manageSubtitle")}</p>
          <div className="dash-hero__stats">
            <span className="dash-hero__stat">
              <AppstoreOutlined /> {t("dash.boardCount", { count: (data ?? []).length })}
            </span>
            <span className="dash-hero__stat">
              <BarStat /> {t("dash.widgetCount", { count: widgetTotal })}
            </span>
          </div>
        </div>
        <div className="dash-hero__actions">
          {/* size="large" is antd's own 16px input. Below 16px iOS zooms the page on
              tap and never zooms back; the CSS route loses to antd's injected rules,
              and this matches the «داشبورد جدید» button beside it anyway. */}
          <Input.Search
            size="large"
            placeholder={t("dash.search")}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          {canManage && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => void navigate("/dashboards/new")}
            >
              {t("dash.new")}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        className="dash-list__tabs"
        items={[
          { key: "all", label: t("dash.tabs.all") },
          { key: "mine", label: t("dash.tabs.mine") },
          { key: "recent", label: t("dash.tabs.recent") },
        ]}
      />

      {boards.length === 0 ? (
        <EmptyState
          description={t(`dash.empty.${tab}`)}
          action={
            canManage ? (
              <Button type="primary" onClick={() => void navigate("/dashboards/new")}>
                {t("dash.create")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="dash-list__grid">
          {boards.map((d) => (
            <div key={d.id} data-testid="dashboard-card" className="dash-card">
              <div className="dash-card__accent" aria-hidden />
              {/* On this page a card opens the dashboard; there is nothing here to preview. */}
              <button type="button" className="dash-card__select" onClick={() => open(d.id)}>
                <span className="dash-card__name">{d.name}</span>
                <Space size={6} wrap className="dash-card__meta">
                  <Tag bordered={false} icon={<AppstoreOutlined />}>
                    {num(d.widgets.length)} {t("dash.widget")}
                  </Tag>
                  {d.ownerName && (
                    <Tag bordered={false} icon={<UserOutlined />}>
                      {reportOwnerLabel(d.ownerName, user, t("library.organizationUser"))}
                    </Tag>
                  )}
                  <Tag bordered={false} icon={<ClockCircleOutlined />}>
                    {formatCategory(d.updatedAt.slice(0, 10), rtl ? "rtl" : "ltr")}
                  </Tag>
                </Space>
              </button>
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "open", label: t("dash.open"), onClick: () => open(d.id) },
                    ...(canManage
                      ? [
                          {
                            key: "edit",
                            icon: <EditOutlined />,
                            label: t("common.edit"),
                            onClick: () => void navigate(`/dashboards/${d.id}/edit`),
                          },
                          { type: "divider" as const },
                          {
                            key: "del",
                            danger: true,
                            label: t("dash.delete"),
                            onClick: () => remove(d.id, d.name),
                          },
                        ]
                      : []),
                  ],
                }}
              >
                <Button
                  type="text"
                  size="small"
                  className="dash-card__menu"
                  icon={<MoreOutlined />}
                  aria-label={t("dash.cardMenu")}
                />
              </Dropdown>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Tiny inline bar glyph for the hero stats (no extra icon dependency). */
function BarStat() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ verticalAlign: -2 }}>
      <rect x="1" y="7" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="5.5" y="4" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}
