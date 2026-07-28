import { Button, Result } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useDashboard } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import { DashboardCanvas } from "@/dashboard/DashboardCanvas";
import { EmptyState, Loading, PageContainer, PageHeader } from "@/components/ui";
import { WidgetFrame } from "./WidgetFrame";

export function DashboardViewer() {
  const { t } = useTranslation();
  const { dashId = "" } = useParams<{ dashId: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { data, isLoading, isError } = useDashboard(dashId);

  const canEdit =
    roles.includes("DashboardDesigner") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

  if (isLoading) return <Loading rows={8} />;
  if (isError || !data) return <Result status="404" title={t("dash.notFound")} />;

  return (
    <PageContainer>
      <PageHeader
        title={data.name}
        breadcrumbs={[
          { title: t("dashboards.title"), href: "/dashboards" },
          { title: data.name },
        ]}
        actions={
          canEdit ? (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => void navigate(`/dashboards/${data.id}/edit`)}
            >
              {t("common.edit")}
            </Button>
          ) : undefined
        }
      />

      {data.widgets.length === 0 ? (
        <div data-testid="dashboard-empty">
          <EmptyState description={t("dash.emptyDashboard")} />
        </div>
      ) : (
        <div className="dashboard-canvas--readonly">
          <DashboardCanvas layout={data.layout} editing={false} onLayoutChange={() => undefined}>
            {data.widgets.map((widget) => (
              <div key={widget.i} data-testid="dashboard-widget">
                <WidgetFrame widget={widget} editing={false} />
              </div>
            ))}
          </DashboardCanvas>
        </div>
      )}
    </PageContainer>
  );
}