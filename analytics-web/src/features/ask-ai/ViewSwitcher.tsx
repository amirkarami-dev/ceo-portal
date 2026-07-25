// report-web/src/features/ask-ai/ViewSwitcher.tsx
import { Segmented } from "antd";
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  TableOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { QueryResult, ReportView, ViewType } from "@/contracts";

export type SwitchTarget = ViewType | "bar" | "line" | "pie";

interface Props {
  views: ReportView[];
  active: ReportView | undefined;
  result: QueryResult;
  onSwitch: (t: SwitchTarget) => void;
}

export function ViewSwitcher({ active, result, onSwitch }: Props) {
  const { t } = useTranslation();
  const metricCount = result.columns.filter((c) => c.isMetric).length;

  const options = [
    { label: t("view.table"), value: "table" as SwitchTarget, icon: <TableOutlined /> },
    { label: t("view.kpi"), value: "kpi" as SwitchTarget, icon: <DashboardOutlined /> },
    { label: t("view.bar"), value: "bar" as SwitchTarget, icon: <BarChartOutlined /> },
    { label: t("view.line"), value: "line" as SwitchTarget, icon: <LineChartOutlined /> },
    {
      label: t("view.pie"),
      value: "pie" as SwitchTarget,
      icon: <PieChartOutlined />,
      disabled: metricCount > 1,
    },
  ];

  const current: SwitchTarget = !active
    ? "table"
    : active.type === "table" || active.type === "kpi"
      ? active.type
      : active.component.toLowerCase().includes("bar")
        ? "bar"
        : active.component.toLowerCase().includes("pie")
          ? "pie"
          : "line";

  return (
    <div data-testid="view-switcher">
      <Segmented
        options={options}
        value={current}
        onChange={(v) => onSwitch(v as SwitchTarget)}
      />
    </div>
  );
}
