import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsCoreOption } from "echarts";
import { Row, Col, Skeleton } from "antd";
import { useTranslation } from "react-i18next";
import { useAIUsageSeries } from "../../../api/queries";
import { PageHeader, KpiTile, SectionCard } from "../../../components/ui";

function useEChart(option: EChartsCoreOption | null) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !option) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);
  return ref;
}

export function AIUsageCost() {
  const { t } = useTranslation();
  const { data, isLoading } = useAIUsageSeries();
  const totalTokens = (data?.perDay ?? []).reduce((s, d) => s + d.tokens, 0);
  const totalCost = (data?.perModel ?? []).reduce((s, m) => s + m.costUsd, 0);

  const tokensOption = useMemo<EChartsCoreOption | null>(
    () =>
      data
        ? {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: data.perDay.map((d) => d.date) },
            yAxis: { type: "value" },
            series: [
              {
                type: "line",
                smooth: true,
                data: data.perDay.map((d) => d.tokens),
                name: t("admin.ai.tokens"),
              },
            ],
          }
        : null,
    [data, t],
  );

  const costOption = useMemo<EChartsCoreOption | null>(
    () =>
      data
        ? {
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: data.perModel.map((m) => m.model) },
            yAxis: { type: "value" },
            series: [
              {
                type: "bar",
                data: data.perModel.map((m) => m.costUsd),
                name: t("admin.ai.costUsd"),
              },
            ],
          }
        : null,
    [data, t],
  );

  const tokensRef = useEChart(tokensOption);
  const costRef = useEChart(costOption);

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div>
      <PageHeader title={t("admin.ai.usageTitle")} />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <KpiTile label={t("admin.ai.totalTokens")} value={totalTokens.toLocaleString()} tone="blue" />
        </Col>
        <Col span={12}>
          <KpiTile label={t("admin.ai.totalCost")} value={`$${totalCost.toFixed(2)}`} tone="amber" />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <SectionCard title={t("admin.ai.tokensOverTime")}>
            <div data-testid="tokens-chart" ref={tokensRef} style={{ height: 280 }} />
          </SectionCard>
        </Col>
        <Col span={12}>
          <SectionCard title={t("admin.ai.costByModel")}>
            <div data-testid="cost-chart" ref={costRef} style={{ height: 280 }} />
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
}
