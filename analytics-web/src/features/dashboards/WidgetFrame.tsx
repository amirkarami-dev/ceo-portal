import { Alert, Button, Dropdown, Segmented, Tooltip } from "antd";
import {
  BarChartOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  MoreOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DashboardWidget } from "@/dashboard/widget";
import type { QueryResult, ReportView } from "@/contracts";
import { useReport } from "@/api/queries";
import { executeReport } from "@/api/executeApi";
import { chooseView } from "@/presentation/auto-viz";
import { getModelForDataset } from "@/semantic/registry";
import { ReportViewRenderer } from "@/presentation/ReportView";
import { exportCsv, exportPdf, exportXlsx } from "@/features/export";
import { KpiTile, SectionCard } from "@/components/ui";

interface Props {
  widget: DashboardWidget;
  editing: boolean;
  onRemove: () => void;
  /** Persist a per-widget display change (view mode toggle). */
  onChange?: (next: DashboardWidget) => void;
}

const TABLE_VIEW: ReportView = {
  type: "table",
  library: "antd",
  component: "Table",
  mapping: {},
};

/** Prefer an existing chart view; else derive a bar view from the result columns. */
function chartViewOf(views: ReportView[], result: QueryResult): ReportView {
  const existing = views.find((v) => v.type === "chart");
  if (existing) return existing;
  const dim = result.columns.find((c) => !c.isMetric)?.key;
  const meas = result.columns.find((c) => c.isMetric)?.key;
  return {
    type: "chart",
    library: "recharts",
    component: "BarChart",
    mapping: { x: dim, y: meas },
  };
}

export function WidgetFrame({ widget, editing, onRemove, onChange }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useReport(widget.reportId);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Execute through the gated executeReport so widgets work in BOTH modes
  // (server-side SQL in real mode, in-browser engine in mock) — the old
  // direct runQuery call broke every widget on the real backend.
  const exec = useQuery({
    queryKey: ["widget-exec", widget.reportId],
    queryFn: () => executeReport(data!.definition),
    enabled: !!data,
    staleTime: 60_000,
  });

  const views = useMemo(() => {
    if (!data || !exec.data) return [];
    try {
      const pinned = data.definition.presentation?.views;
      if (pinned && pinned.length > 0) return pinned;
      const semantic = getModelForDataset(data.definition.dataset);
      return chooseView(data.definition, exec.data, semantic);
    } catch {
      return [];
    }
  }, [data, exec.data]);

  const title = widget.title ?? data?.definition.name ?? t("dash.widget");
  const result = exec.data;
  const loading = isLoading || exec.isLoading;
  const broken = isError || exec.isError || (!!data && !loading && views.length === 0);

  // View resolution: widget override wins; otherwise the report's default view.
  const defaultView = views[widget.viewIndex ?? 0] ?? views[0];
  const activeView: ReportView | undefined = !result
    ? undefined
    : widget.viewMode === "table"
      ? TABLE_VIEW
      : widget.viewMode === "chart"
        ? chartViewOf(views, result)
        : defaultView;

  const mode: "chart" | "table" =
    widget.viewMode ?? (defaultView?.type === "table" ? "table" : "chart");

  const exportName = title.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "widget";
  const iconBtn = { type: "text" as const, size: "small" as const };

  const toolbar = (
    <div className="widget-toolbar" onMouseDown={(e) => e.stopPropagation()}>
      {onChange && (
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => onChange({ ...widget, viewMode: v as "chart" | "table" })}
          options={[
            { value: "chart", icon: <BarChartOutlined />, title: t("dash.viewChart") },
            { value: "table", icon: <TableOutlined />, title: t("dash.viewTable") },
          ]}
        />
      )}
      {result && data && (
        <>
          <Tooltip title="CSV">
            <Button
              {...iconBtn}
              aria-label="CSV"
              icon={<FileTextOutlined />}
              onClick={() => exportCsv(data.definition, result)}
            />
          </Tooltip>
          <Tooltip title="Excel">
            <Button
              {...iconBtn}
              aria-label="Excel"
              icon={<FileExcelOutlined />}
              onClick={() => void exportXlsx(exportName, result)}
            />
          </Tooltip>
          <Tooltip title="PDF">
            <Button
              {...iconBtn}
              aria-label="PDF"
              icon={<FilePdfOutlined />}
              onClick={() => exportPdf(title, result, bodyRef.current)}
            />
          </Tooltip>
        </>
      )}
      {editing && (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "remove",
                danger: true,
                label: t("dash.removeWidget"),
                onClick: onRemove,
              },
            ],
          }}
        >
          <Button {...iconBtn} icon={<MoreOutlined />} aria-label={t("dash.widgetMenu")} />
        </Dropdown>
      )}
    </div>
  );

  // KPI bento: if the resolved view is a kpi with a single value, render it as
  // a KpiTile card (no chart container overhead, fills the bento cell).
  const isKpiView = activeView?.type === "kpi" && widget.viewMode === undefined;

  return (
    <SectionCard
      size="small"
      title={title}
      loading={loading}
      extra={toolbar}
      className="widget-card"
      style={{ height: "100%" }}
      styles={{ body: { height: "calc(100% - 40px)", overflow: "auto" } }}
    >
      {broken ? (
        <Alert type="error" showIcon message={t("dash.widgetError")} />
      ) : result && data && activeView ? (
        <div ref={bodyRef} className="widget-body">
          {isKpiView ? (
            <div style={{ padding: "8px 0" }}>
              <KpiTile
                label={title}
                value={String(
                  (result.rows[0] as Record<string, unknown> | undefined)?.[
                    (activeView.mapping.value as string) ?? ""
                  ] ?? "—",
                )}
                tone="emerald"
              />
            </div>
          ) : (
            <ReportViewRenderer view={activeView} def={data.definition} result={result} />
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
