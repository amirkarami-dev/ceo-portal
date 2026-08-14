import { Button, Result, Space, Switch, message } from "antd";
import { PlusOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useDashboard, useCreateDashboard, useSaveDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { DashboardCanvas } from "@/dashboard/DashboardCanvas";
import { newWidget, type DashboardWidget, type GridLayoutItem } from "@/dashboard/widget";
import { AddWidgetDrawer } from "./AddWidgetDrawer";
import { canManageDashboards } from "./can-manage";
import { WidgetFrame } from "./WidgetFrame";
import { EmptyState, Loading, PageContainer, PageHeader } from "@/components/ui";
import { SaveButton } from "@/components/ui/SaveButton";

export function DashboardBuilder() {
  const { t } = useTranslation();
  const { dashId = "" } = useParams<{ dashId: string }>();
  const isNew = dashId === "";
  const navigate = useNavigate();
  const { roles } = useAuth();

  // "new" case: create an empty dashboard once, then redirect into the edit route.
  const createDash = useCreateDashboard();
  const creatingRef = useRef(false);
  const [creationAttempt, setCreationAttempt] = useState(0);
  useEffect(() => {
    if (!isNew || creatingRef.current) return;
    creatingRef.current = true;
    createDash
      .mutateAsync({ name: t("dash.new", "داشبورد جدید") })
      .then((created) => {
        navigate(`/dashboards/${created.id}/edit`, { replace: true });
      })
      .catch(() => {
        /* error handled via createDash.isError below */
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, creationAttempt]);

  const { data, isLoading, isError } = useDashboard(dashId);
  const save = useSaveDashboard();

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [layout, setLayout] = useState<GridLayoutItem[]>([]);
  const [editing, setEditing] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (data) {
      setWidgets(data.widgets);
      setLayout(data.layout);
    }
  }, [data]);

  const canEdit = canManageDashboards(roles);

  // While creating a new dashboard (or loading an existing one), show a skeleton.
  if (isNew && createDash.isError) {
    return (
      <Result
        status="error"
        title={t("dash.createError")}
        extra={
          <Button
            type="primary"
            onClick={() => {
              creatingRef.current = false;
              createDash.reset();
              setCreationAttempt((attempt) => attempt + 1);
            }}
          >
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  if (isNew || isLoading) return <Loading rows={8} />;
  if (isError || !data) return <Result status="404" title={t("dash.notFound")} />;
  if (!canEdit) return <Result status="403" title={t("dash.forbidden")} />;

  const addWidget = (reportId: string, title: string) => {
    const { widget, layout: li } = newWidget(reportId, title, widgets.length);
    setWidgets((w) => [...w, widget]);
    setLayout((l) => [...l, li]);
  };

  const removeWidget = (i: string) => {
    setWidgets((w) => w.filter((x) => x.i !== i));
    setLayout((l) => l.filter((x) => x.i !== i));
  };

  const changeWidget = (next: DashboardWidget) => {
    setWidgets((w) => w.map((x) => (x.i === next.i ? next : x)));
  };

  const onSave = async () => {
    try {
      await save.mutateAsync({ ...data, widgets, layout });
      void message.success(t("dash.saved"));
    } catch (err) {
      void message.error(t("dash.saveError"));
      // Re-thrown on purpose: swallowing it here would hand SaveButton a resolved promise, and it
      // would show a success tick over the failure message.
      throw err;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={data.name}
        breadcrumbs={[
          { title: t("dashboards.title"), href: "/dashboards" },
          { title: data.name },
        ]}
        actions={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => void navigate("/dashboards")}
            >
              {t("common.back")}
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setDrawer(true)}>
              {t("dash.addWidget")}
            </Button>
            <Space>
              <span style={{ fontSize: 13, color: "var(--ant-color-text-secondary)" }}>
                {t("dash.editMode")}
              </span>
              <Switch checked={editing} onChange={setEditing} size="small" />
            </Space>
            <SaveButton onSave={onSave} />
          </Space>
        }
      />

      {widgets.length === 0 ? (
        <div data-testid="dashboard-empty">
          <EmptyState
            description={t("dash.dropHere")}
            action={
              <Button type="primary" onClick={() => setDrawer(true)}>
                {t("dash.addWidget")}
              </Button>
            }
          />
        </div>
      ) : (
        <DashboardCanvas layout={layout} editing={editing} onLayoutChange={setLayout}>
          {widgets.map((wd) => (
            <div key={wd.i} data-testid="dashboard-widget">
              <WidgetFrame
                widget={wd}
                editing={editing}
                onRemove={() => removeWidget(wd.i)}
                onChange={changeWidget}
              />
            </div>
          ))}
        </DashboardCanvas>
      )}

      <AddWidgetDrawer open={drawer} onClose={() => setDrawer(false)} onPick={addWidget} />
    </PageContainer>
  );
}
