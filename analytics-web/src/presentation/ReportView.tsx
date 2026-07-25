import React from "react";
import type { ReportView } from "../contracts/presentation";
import type { ReportDefinition } from "../contracts/report-definition";
import type { QueryResult, GroupNode } from "../contracts/dataset";
import TableRenderer from "./renderers/TableRenderer";
import KpiRenderer from "./renderers/KpiRenderer";
import RechartsRenderer from "./renderers/RechartsRenderer";
import EChartsRenderer from "./renderers/EChartsRenderer";

/** Canonical renderer props (R5). The single source other features import. */
export type RendererProps = {
  view: ReportView;
  def: ReportDefinition;
  result: QueryResult;
  /** Optional drill callback: fired with the clicked group node. Drill-capable
   *  renderers (Recharts/ECharts/Table) wire it; others ignore it. */
  onDrill?: (node: GroupNode) => void;
};

/**
 * Dispatcher (named ReportViewRenderer to avoid clashing with the ReportView
 * *type*). Picks the renderer by library first — this is the structural
 * enforcement of "charts/echarts never render with antd".
 */
export function ReportViewRenderer(props: RendererProps): React.JSX.Element {
  const { view } = props;
  switch (view.library) {
    case "recharts":
      return <RechartsRenderer {...props} />;
    case "echarts":
      return <EChartsRenderer {...props} />;
    case "antd":
    default:
      // antd library: KPI Card vs Table by view type.
      if (view.type === "kpi") return <KpiRenderer {...props} />;
      return <TableRenderer {...props} />;
  }
}
