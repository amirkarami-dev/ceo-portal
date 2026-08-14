import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts";
import { Skeleton } from "antd";
import { useTranslation } from "react-i18next";
import { useAuditCostByTenant } from "../../api/queries";
import { SectionCard } from "../../components/ui";
// Was a bare echarts.init(el) — no theme, so ECharts' own palette and its #333 text, which is
// 1.31:1 on the dark panel.
import { useEChart } from "../../components/charts/useEChart";

export function AuditCostChart() {
  const { t } = useTranslation();
  const { data, isLoading } = useAuditCostByTenant();

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!data || data.length === 0) return null;
    const periods = Array.from(
      new Set(data.flatMap((d) => d.series.map((s) => s.period))),
    ).sort();
    return {
      tooltip: { trigger: "axis" },
      legend: { data: data.map((d) => d.tenantId) },
      xAxis: { type: "category", data: periods },
      yAxis: { type: "value", name: t("admin.audit.costUsd") },
      series: data.map((d) => ({
        name: d.tenantId,
        type: "line",
        smooth: true,
        data: periods.map((p) => d.series.find((s) => s.period === p)?.costUsd ?? 0),
      })),
    };
  }, [data, t]);

  const ref = useEChart(option);

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  return (
    <SectionCard title={t("admin.audit.costPerTenant")}>
      <div ref={ref} style={{ height: 300 }} data-testid="audit-cost-chart" />
    </SectionCard>
  );
}
