// report-web/src/features/viewer/ReportViewer.tsx
import {
  Breadcrumb,
  Button,
  Descriptions,
  Dropdown,
  Empty,
  Result,
} from "antd";
import { DownloadOutlined, EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import type {
  Filter,
  FilterValue,
  GroupNode,
  QueryResult,
  ReportDefinition,
  ReportView,
} from "@/contracts";
import { useReport } from "@/api/queries";
import { buildDrilldownDefinition } from "@/query/drilldown";
import { chooseView } from "@/presentation/auto-viz";
import { getModelForDataset } from "@/semantic/registry";
import { executeReport } from "@/api/executeApi";
import { ReportViewRenderer } from "@/presentation/ReportView";
import { buildExportMenuItems } from "@/features/export";
import { ViewSwitcher, type SwitchTarget } from "@/features/ask-ai/ViewSwitcher";
import { useAuth } from "@/auth/useAuth";
import {
  ErrorState,
  Loading,
  PageContainer,
  PageHeader,
  Toolbar,
} from "@/components/ui";
import { FilterBar } from "./FilterBar";

type Crumb = { label: string; def: ReportDefinition; result: QueryResult; views: ReportView[] };

export function ReportViewer() {
  const { t } = useTranslation();
  const { reportId = "" } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { data, isLoading, isError } = useReport(reportId);

  const [filterValues, setFilterValues] = useState<Record<number, FilterValue>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [drillPath, setDrillPath] = useState<Crumb[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [computed, setComputed] = useState<{ result: QueryResult; views: ReportView[] } | undefined>();
  const [execError, setExecError] = useState(false);

  const semantic = useMemo(() => {
    if (!data) return undefined;
    try {
      return getModelForDataset(data.definition.dataset);
    } catch {
      return undefined;
    }
  }, [data]);

  // Apply live filter-bar overrides into the definition before running.
  const liveDef = useMemo<ReportDefinition | undefined>(() => {
    if (!data) return undefined;
    const base = data.definition;
    const filters: Filter[] = (base.filters ?? []).map((f, i) =>
      filterValues[i] === undefined ? f : { ...f, value: filterValues[i] },
    );
    return { ...base, filters };
    // refreshKey forces recompute on "Refresh"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterValues, refreshKey]);

  // Execute asynchronously via the gated executeReport (real or mock).
  useEffect(() => {
    if (!liveDef || !semantic) {
      setComputed(undefined);
      return;
    }
    let cancelled = false;
    setExecError(false);
    executeReport(liveDef)
      .then((result) => {
        if (cancelled) return;
        const views =
          liveDef.presentation?.views?.length > 0
            ? liveDef.presentation.views
            : chooseView(liveDef, result, semantic);
        setComputed({ result, views });
      })
      .catch(() => {
        if (!cancelled) {
          setComputed(undefined);
          setExecError(true);
        }
      });
    return () => { cancelled = true; };
  }, [liveDef, semantic]);

  // Derived values for the render — computed below the hooks (safe since hooks are unconditional).
  const activeResult = drillPath.length ? drillPath[drillPath.length - 1].result : computed?.result;
  const activeViews = drillPath.length ? drillPath[drillPath.length - 1].views : computed?.views ?? [];
  const activeDef = drillPath.length ? drillPath[drillPath.length - 1].def : (liveDef ?? data?.definition);

  const drill = useCallback(
    async (node: GroupNode) => {
      if (!semantic || !activeDef) return;
      try {
        const childDef = buildDrilldownDefinition(activeDef, node);
        const r = await executeReport(childDef);
        const drillViews = chooseView(childDef, r, semantic);
        setDrillPath((p) => [
          ...p,
          { label: String(node.value), def: childDef, result: r, views: drillViews },
        ]);
        setActiveIdx(0);
      } catch {
        // drilldown config missing or execute failed — silently skip
      }
    },
    [activeDef, semantic],
  );

  if (isLoading) return <Loading rows={8} />;
  if (isError || (data === null && !isLoading)) {
    return <Result status="404" title={t("viewer.notFound")} />;
  }
  if (!data) return <Loading rows={8} />;
  // While waiting for executeReport to resolve (liveDef loaded but computed not yet ready)
  if (!computed && !execError) return <Loading rows={8} />;
  if (execError || !liveDef || !semantic || !activeResult || !activeDef) {
    return <ErrorState title={t("viewer.invalid")} />;
  }

  const result = activeResult;
  const views = activeViews;
  const activeView = views[Math.min(activeIdx, views.length - 1)] ?? views[0];

  const canEdit =
    roles.includes("ReportDesigner") ||
    roles.includes("PowerUser") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

  const drillUp = (toRoot = false) => {
    setDrillPath((p) => (toRoot ? [] : p.slice(0, -1)));
    setActiveIdx(0);
  };

  const switchView = (target: SwitchTarget) => {
    const idx = views.findIndex((v) =>
      target === "table" || target === "kpi"
        ? v.type === target
        : v.component.toLowerCase().includes(target),
    );
    setActiveIdx(idx >= 0 ? idx : 0);
  };

  const headerActions = (
    <>
      <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)}>
        {t("viewer.refresh")}
      </Button>
      {canEdit && (
        <Button icon={<EditOutlined />} onClick={() => navigate(`/ask?from=${reportId}`)}>
          {t("viewer.openInAsk")}
        </Button>
      )}
      <Dropdown menu={{ items: buildExportMenuItems(activeDef, result) }} trigger={["click"]}>
        <Button icon={<DownloadOutlined />}>{t("viewer.export")}</Button>
      </Dropdown>
    </>
  );

  return (
    <PageContainer>
      <PageHeader
        title={data.definition.name}
        subtitle={data.definition.description}
        actions={headerActions}
      />

      <Descriptions
        size="small"
        column={3}
        style={{ marginBottom: 12 }}
        items={[
          { key: "owner", label: t("viewer.owner"), children: data.ownerName },
          { key: "model", label: t("viewer.model"), children: data.definition.dataset },
          { key: "updated", label: t("viewer.updated"), children: data.updatedAt },
        ]}
      />

      <FilterBar
        filters={liveDef.filters ?? []}
        semantic={semantic}
        onChange={(i, v) => setFilterValues((s) => ({ ...s, [i]: v }))}
      />

      <Toolbar>
        <ViewSwitcher views={views} active={activeView} result={result} onSwitch={switchView} />
      </Toolbar>

      {drillPath.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 12 }}
          items={[
            { title: <a onClick={() => drillUp(true)}>{data.definition.name}</a> },
            ...drillPath.map((c) => ({ title: c.label })),
          ]}
        />
      )}

      <div data-testid="result-canvas">
        {result.total === 0 ? (
          <Empty description={t("viewer.emptyFilters")} />
        ) : (
          <ReportViewRenderer view={activeView} def={activeDef} result={result} onDrill={drill} />
        )}
      </div>
    </PageContainer>
  );
}
