import { Button, Dropdown, Input, Space, Switch, Tabs, Tag, message } from "antd";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDashboards, useDeleteDashboard, useSaveDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { DashboardCanvas } from "@/dashboard/DashboardCanvas";
import type { GridLayoutItem } from "@/dashboard/widget";
import { formatCategory, toPersianDigits } from "@/presentation/format";
import { EmptyState, PageContainer, Loading } from "@/components/ui";
import { reportOwnerLabel } from "@/features/library/report-display";
import { WidgetFrame } from "./WidgetFrame";
import "./dashboards.css";

export function DashboardList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const { data, isLoading } = useDashboards();
  const del = useDeleteDashboard();
  const save = useSaveDashboard();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [previewEditing, setPreviewEditing] = useState(true);
  const [previewLayout, setPreviewLayout] = useState<GridLayoutItem[]>([]);

  const rtl = i18n.dir() === "rtl";
  const num = (n: number) => (rtl ? toPersianDigits(n) : String(n));

  const canManage =
    roles.includes("DashboardDesigner") ||
    roles.includes("ReportDesigner") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

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

  const activeId = boards.some((board) => board.id === selectedId) ? selectedId : boards[0]?.id;
  const selected = boards.find((board) => board.id === activeId);

  useEffect(() => {
    setPreviewLayout(selected?.layout ?? []);
  }, [selected?.id, selected?.layout]);

  const savePreviewLayout = async () => {
    if (!selected) return;
    try {
      await save.mutateAsync({ ...selected, layout: previewLayout });
      void message.success(t("dash.saved"));
    } catch {
      void message.error(t("dash.saveError"));
    }
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
            <div
              key={d.id}
              data-testid="dashboard-card"
              className={`dash-card${activeId === d.id ? " dash-card--selected" : ""}`}
            >
              <div className="dash-card__accent" aria-hidden />
              <button
                type="button"
                className="dash-card__select"
                aria-pressed={activeId === d.id}
                onClick={() => setSelectedId(d.id)}
              >
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
                    {
                      key: "open",
                      label: t("dash.open"),
                      onClick: () => setSelectedId(d.id),
                    },
                    ...(canManage
                      ? [
                          {
                            key: "edit",
                            label: t("common.edit"),
                            onClick: () => void navigate(`/dashboards/${d.id}/edit`),
                          },
                          { type: "divider" as const },
                          {
                            key: "del",
                            danger: true,
                            label: t("dash.delete"),
                            onClick: () => void del.mutate(d.id),
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

      {selected && (
        <section className="dash-preview" aria-labelledby="dash-preview-title">
          <div className="dash-preview__head">
            <div>
              <span className="dash-preview__eyebrow">{t("dash.previewLabel")}</span>
              <h2 id="dash-preview-title" className="dash-preview__title">
                {selected.name}
              </h2>
              <p className="dash-preview__meta">
                {t("dash.previewWidgets", { value: num(selected.widgets.length) })}
              </p>
            </div>
            {canManage && (
              <Space wrap>
                <Space size={6}>
                  <span className="dash-preview__edit-label">{t("dash.editMode")}</span>
                  <Switch
                    checked={previewEditing}
                    onChange={setPreviewEditing}
                    size="small"
                  />
                </Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={save.isPending}
                  disabled={!previewEditing}
                  onClick={() => void savePreviewLayout()}
                >
                  {t("common.save")}
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => void navigate(`/dashboards/${selected.id}/edit`)}
                >
                  {t("common.edit")}
                </Button>
              </Space>
            )}
          </div>

          {selected.widgets.length === 0 ? (
            <div data-testid="dashboard-preview-empty">
              <EmptyState description={t("dash.emptyDashboard")} />
            </div>
          ) : (
            <div
              className={previewEditing && canManage ? undefined : "dashboard-canvas--readonly"}
              data-testid="dashboard-preview"
            >
              <DashboardCanvas
                layout={previewLayout}
                editing={previewEditing && canManage}
                onLayoutChange={setPreviewLayout}
              >
                {selected.widgets.map((widget) => (
                  <div key={widget.i} data-testid="dashboard-preview-widget">
                    <WidgetFrame widget={widget} editing={false} />
                  </div>
                ))}
              </DashboardCanvas>
            </div>
          )}
        </section>
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
