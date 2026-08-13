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
import type { QueryResult, ReportView } from "@/contracts";
import { canRenderTarget, type SwitchTarget } from "@/presentation/view-switching";

export type { SwitchTarget };

interface Props {
  views: ReportView[];
  active: ReportView | undefined;
  result: QueryResult;
  onSwitch: (t: SwitchTarget) => void;
}

export function ViewSwitcher({ active, result, onSwitch }: Props) {
  const { t } = useTranslation();

  // A view is offered when the result CAN be drawn that way. The pie used to be disabled whenever
  // a report had more than one metric, which ruled it out for «تعداد و درصد …» — a count and its
  // own percentage, the most natural pie there is. Two metrics are not an obstacle: a pie draws
  // one, exactly as the bar chart already draws one.
  const options = (
    [
      { label: t("view.table"), value: "table", icon: <TableOutlined /> },
      { label: t("view.kpi"), value: "kpi", icon: <DashboardOutlined /> },
      { label: t("view.bar"), value: "bar", icon: <BarChartOutlined /> },
      { label: t("view.line"), value: "line", icon: <LineChartOutlined /> },
      { label: t("view.pie"), value: "pie", icon: <PieChartOutlined /> },
    ] as { label: string; value: SwitchTarget; icon: React.ReactNode }[]
  ).map((o) => ({ ...o, disabled: !canRenderTarget(o.value, result) }));

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
