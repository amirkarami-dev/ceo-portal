import { Button, Dropdown, Input, Space, Tag } from "antd";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  MoreOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCreateDashboard, useDashboards, useDeleteDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { formatCategory, toPersianDigits } from "@/presentation/format";
import { EmptyState, PageContainer, Loading } from "@/components/ui";
import "./dashboards.css";

export function DashboardList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { data, isLoading } = useDashboards();
  const create = useCreateDashboard();
  const del = useDeleteDashboard();
  const [q, setQ] = useState("");

  const rtl = i18n.dir() === "rtl";
  const num = (n: number) => (rtl ? toPersianDigits(n) : String(n));

  const canCreate =
    roles.includes("DashboardDesigner") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

  const boards = useMemo(
    () =>
      (data ?? []).filter((d) =>
        d.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [data, q],
  );

  const widgetTotal = useMemo(
    () => (data ?? []).reduce((a, d) => a + d.widgets.length, 0),
    [data],
  );

  const onNew = async () => {
    const d = await create.mutateAsync({ name: t("dash.untitled") });
    void navigate(`/dashboards/${d.id}/edit`);
  };

  if (isLoading) return <Loading rows={6} />;

  return (
    <PageContainer>
      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero__glow" aria-hidden />
        <div className="dash-hero__text">
          <h1 className="dash-hero__title">
            <DashboardOutlined /> {t("dashboards.title")}
          </h1>
          <p className="dash-hero__subtitle">{t("dash.heroSubtitle")}</p>
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
          <Input.Search
            placeholder={t("dash.search")}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          {canCreate && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              loading={create.isPending}
              onClick={() => void onNew()}
            >
              {t("dash.new")}
            </Button>
          )}
        </div>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          description={t("dash.emptyList")}
          action={
            canCreate ? (
              <Button type="primary" onClick={() => void onNew()}>
                {t("dash.create")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="dash-list__grid">
          {boards.map((d) => (
            <div
              key={d.id}
              data-testid="dashboard-card"
              className="dash-card"
              role="button"
              tabIndex={0}
              onClick={() => void navigate(`/dashboards/${d.id}/edit`)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void navigate(`/dashboards/${d.id}/edit`);
              }}
            >
              <div className="dash-card__accent" aria-hidden />
              <div className="dash-card__head">
                <span className="dash-card__name">{d.name}</span>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      {
                        key: "open",
                        label: t("dash.open"),
                        onClick: () => void navigate(`/dashboards/${d.id}/edit`),
                      },
                      { type: "divider" as const },
                      {
                        key: "del",
                        danger: true,
                        label: t("dash.delete"),
                        onClick: () => void del.mutate(d.id),
                      },
                    ],
                  }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    aria-label={t("dash.cardMenu")}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </div>
              <Space size={6} wrap className="dash-card__meta">
                <Tag bordered={false} icon={<AppstoreOutlined />}>
                  {num(d.widgets.length)} {t("dash.widget")}
                </Tag>
                {d.ownerName && (
                  <Tag bordered={false} icon={<UserOutlined />}>
                    {d.ownerName}
                  </Tag>
                )}
                <Tag bordered={false} icon={<ClockCircleOutlined />}>
                  {formatCategory(d.updatedAt.slice(0, 10), rtl ? "rtl" : "ltr")}
                </Tag>
              </Space>
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
