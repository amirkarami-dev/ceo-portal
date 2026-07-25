import { Progress, Row, Col, Alert } from "antd";
import { useTranslation } from "react-i18next";
import type { TenantQuotas, TenantUsage } from "../../contracts";
import { SectionCard } from "../../components/ui";

const METRICS: { used: keyof TenantUsage; cap: keyof TenantQuotas; key: string }[] = [
  { used: "users", cap: "maxUsers", key: "users" },
  { used: "reports", cap: "maxReports", key: "reports" },
  { used: "dashboards", cap: "maxDashboards", key: "dashboards" },
  { used: "dataSources", cap: "maxDataSources", key: "dataSources" },
  { used: "aiTokens", cap: "monthlyAiTokens", key: "aiTokens" },
  { used: "aiCost", cap: "monthlyAiCost", key: "aiCost" },
  { used: "exports", cap: "monthlyExports", key: "exports" },
  { used: "storageMb", cap: "storageMb", key: "storageMb" },
];

export function QuotaPanel({ quotas, usage }: { quotas: TenantQuotas; usage: TenantUsage }) {
  const { t } = useTranslation();
  const near = METRICS.some(({ used, cap }) => {
    const c = Number(quotas[cap]) || 0;
    return c > 0 && Number(usage[used]) / c >= 0.8;
  });
  return (
    <SectionCard title={t("admin.tenant.quotaUsage")}>
      {near && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("admin.tenant.quotaNearLimit")}
        />
      )}
      <Row gutter={[16, 16]}>
        {METRICS.map(({ used, cap, key }) => {
          const u = Number(usage[used]) || 0;
          const c = Number(quotas[cap]) || 0;
          const pct = c > 0 ? Math.min(100, Math.round((u / c) * 100)) : 0;
          return (
            <Col span={12} key={key}>
              <div style={{ marginBottom: 4 }}>
                {t(`admin.tenant.metric.${key}`)}: {u} / {c}
              </div>
              <Progress
                percent={pct}
                status={pct >= 100 ? "exception" : pct >= 80 ? "active" : "normal"}
              />
            </Col>
          );
        })}
      </Row>
    </SectionCard>
  );
}
