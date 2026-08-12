import { Button, ConfigProvider, Space, Switch, Tabs, message } from "antd";
import { EditOutlined, SaveOutlined, SettingOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDashboards, useSaveDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { DashboardCanvas } from "@/dashboard/DashboardCanvas";
import type { GridLayoutItem } from "@/dashboard/widget";
import { EmptyState, PageContainer, Loading } from "@/components/ui";
import { primaryInk as INK } from "@/theme/tokens";
import { WidgetFrame } from "./WidgetFrame";
import { canManageDashboards } from "./can-manage";
import "./dashboards.css";


/**
 * Reading a dashboard, and nothing else. One tab per dashboard, then the widgets.
 * Making and deleting them lives on /manage-dashboards, because it is a rare job
 * and it used to push the widgets — the thing people come here for — below the fold.
 */
export function DashboardsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { data, isLoading } = useDashboards();
  const save = useSaveDashboard();
  const [params, setParams] = useSearchParams();

  // Off by default: this page is for looking. Editing is a deliberate act.
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<GridLayoutItem[]>([]);

  const canManage = canManageDashboards(roles);

  const boards = useMemo(() => data ?? [], [data]);

  // The tab lives in the URL, so a dashboard can be linked, bookmarked and survives
  // a reload. An id that no longer exists falls back to the first tab.
  const wanted = params.get("d");
  const active = boards.find((b) => b.id === wanted) ?? boards[0];

  useEffect(() => {
    setLayout(active?.layout ?? []);
  }, [active?.id, active?.layout]);

  const selectTab = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("d", id);
    setParams(next, { replace: true });
    setEditing(false);
  };

  const saveLayout = async () => {
    if (!active) return;
    try {
      await save.mutateAsync({ ...active, layout });
      void message.success(t("dash.saved"));
    } catch {
      void message.error(t("dash.saveError"));
    }
  };

  if (isLoading) return <Loading rows={6} />;

  if (boards.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          description={t(canManage ? "dash.empty.all" : "dash.noneForYou")}
          action={
            canManage ? (
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => void navigate("/manage-dashboards")}
              >
                {t("dash.manageTitle")}
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  const toolbar = canManage ? (
    <Space wrap size={8}>
      {/* Not size="small": that draws a 28×16 control, and this row also holds «ذخیره». */}
      <Space size={6}>
        <span className="dash-preview__edit-label">{t("dash.editMode")}</span>
        <Switch checked={editing} onChange={setEditing} aria-label={t("dash.editMode")} />
      </Space>
      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={save.isPending}
        disabled={!editing}
        onClick={() => void saveLayout()}
      >
        {t("common.save")}
      </Button>
      <Button
        icon={<EditOutlined />}
        onClick={() => void navigate(`/dashboards/${active.id}/edit`)}
      >
        {t("common.edit")}
      </Button>
    </Space>
  ) : null;

  const board = (
    <section data-testid="dashboard-preview" aria-labelledby="dash-title">
      {/* The tab already carries the name in large type; repeating it as a visible
          heading only pushed the widgets down. The document still needs one. */}
      <h1 id="dash-title" className="sr-only">
        {active.name}
      </h1>

      {active.widgets.length === 0 ? (
        <div data-testid="dashboard-preview-empty">
          <EmptyState description={t("dash.emptyDashboard")} />
        </div>
      ) : (
        <DashboardCanvas layout={layout} editing={editing && canManage} onLayoutChange={setLayout}>
          {active.widgets.map((widget) => (
            <div key={widget.i} data-testid="dashboard-preview-widget">
              <WidgetFrame widget={widget} editing={false} />
            </div>
          ))}
        </DashboardCanvas>
      )}
    </section>
  );

  return (
    <PageContainer>
      {/* The brand green is 2.54:1 at 14px — unreadable for the label that says which
          dashboard you are on. antd owns this colour through a component token and
          ignores CSS overrides, so it is set the way antd expects. Scoped here rather
          than globally: every other tab strip in the app has the same problem, and
          that is a decision about the whole product, not about this page. */}
      <ConfigProvider
        theme={{ components: { Tabs: { itemSelectedColor: INK, itemHoverColor: INK } } }}
      >
        <Tabs
          activeKey={active.id}
          onChange={selectTab}
          className="dash-tabs"
          tabBarExtraContent={toolbar}
          items={boards.map((b) => ({
            key: b.id,
            label: b.name,
            children: b.id === active.id ? board : null,
          }))}
        />
      </ConfigProvider>
    </PageContainer>
  );
}
