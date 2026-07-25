import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "antd";
import { useTranslation } from "react-i18next";
import { useAuditCostByTenant } from "../../api/queries";
import { SectionCard } from "../../components/ui";

export function AuditCostChart() {
  const { t } = useTranslation();
  const { data, isLoading } = useAuditCostByTenant();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !data || data.length === 0) return;
    const periods = Array.from(
      new Set(data.flatMap((d) => d.series.map((s) => s.period))),
    ).sort();
    const chart = echarts.init(ref.current);
    chart.setOption({
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
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data, t]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  return (
    <SectionCard title={t("admin.audit.costPerTenant")}>
      <div ref={ref} style={{ height: 300 }} data-testid="audit-cost-chart" />
    </SectionCard>
  );
}
