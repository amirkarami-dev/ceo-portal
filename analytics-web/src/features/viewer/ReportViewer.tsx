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
import { useReport, useUpdateReport } from "@/api/queries";
import { buildDrilldownDefinition } from "@/query/drilldown";
import { chooseView } from "@/presentation/auto-viz";
import { formatDateTime } from "@/presentation/format";
import { labelLocaleOf, useReportTitle } from "@/presentation/labels";
import { getModelForDataset } from "@/semantic/registry";
import { executeReport } from "@/api/executeApi";
import { ReportViewRenderer } from "@/presentation/ReportView";
import { buildExportMenuItems } from "@/features/export";
import { ViewSwitcher } from "@/features/ask-ai/ViewSwitcher";
import {
  buildViewForTarget,
  findViewForTarget,
  type SwitchTarget,
} from "@/presentation/view-switching";
import { useAuth } from "@/auth/useAuth";
import { reportOwnerLabel } from "@/features/library/report-display";
import {
  EditableLabel,
  ErrorState,
  Loading,
  PageContainer,
  PageHeader,
  Toolbar,
} from "@/components/ui";
import { FilterBar } from "./FilterBar";

type Crumb = { label: string; def: ReportDefinition; result: QueryResult; views: ReportView[] };

/** Nothing worth filtering on: empty, or a range with no bounds filled in. */
function isBlankFilterValue(v: FilterValue | undefined): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => x === "" || x === null || x === undefined);
  return false;
}

export function ReportViewer() {
  const { t, i18n } = useTranslation();
  const { reportId = "" } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const { data, isLoading, isError } = useReport(reportId);
  const updateReport = useUpdateReport();
  // The title a reader sees: what a person typed for this language, else the definition's own name.
  const title = useReportTitle(data?.definition);

  const [filterValues, setFilterValues] = useState<Record<number, FilterValue>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [drillPath, setDrillPath] = useState<Crumb[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [computed, setComputed] = useState<{ result: QueryResult; views: ReportView[] } | undefined>();
  const [execError, setExecError] = useState(false);
  /** Views the switcher built on demand, on top of the ones auto-viz chose. */
  const [extraViews, setExtraViews] = useState<ReportView[]>([]);

  const semantic = useMemo(() => {
    if (!data) return undefined;
    try {
      return getModelForDataset(data.definition.dataset);
    } catch {
      return undefined;
    }
  }, [data]);

  // What the filter bar shows: every filter the report defines, carrying whatever has been typed.
  // Emptied ones stay in this list — drop them here and the control vanishes the moment it is
  // cleared, leaving no way to type a new value.
  const uiFilters = useMemo<Filter[]>(
    () =>
      (data?.definition.filters ?? []).map((f, i) =>
        filterValues[i] === undefined ? f : { ...f, value: filterValues[i] },
      ),
    [data, filterValues],
  );

  // What actually runs. An emptied filter means "do not filter", not "match nothing": sent as-is it
  // became `col = NULL`, or half a range, which the engine refuses outright — so clearing a box
  // returned an empty report or «خطا در بارگذاری گزارش» instead of all the rows.
  const liveDef = useMemo<ReportDefinition | undefined>(() => {
    if (!data) return undefined;
    return { ...data.definition, filters: uiFilters.filter((f) => !isBlankFilterValue(f.value)) };
    // refreshKey forces recompute on "Refresh"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, uiFilters, refreshKey]);

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

  // A built view names columns from the result it was built against. Refresh, a filter change or a
  // drill can change those columns, so drop the built ones and go back to what auto-viz chose
  // rather than point a chart at an axis that is no longer there.
  useEffect(() => {
    setExtraViews([]);
    setActiveIdx(0);
  }, [computed, drillPath.length]);

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


  /**
   * Rename the report in place.
   *
   * Written into `titleOverrides` for the language being read, not into `name`. `name` stays the
   * original: it is what the server keeps in its own column and what the library list sorts and
   * searches on, and overwriting it would push one language's wording onto every reader.
   *
   * An empty box clears the override rather than saving a blank title, which is the only way back to
   * the automatic name once one has been set.
   */
  const saveTitle = useCallback(
    async (next: string) => {
      if (!data) return;
      const locale = labelLocaleOf(i18n.language);
      const overrides = { ...(data.definition.titleOverrides ?? {}) };
      if (next) overrides[locale] = next;
      else delete overrides[locale];

      await updateReport.mutateAsync({
        id: data.id,
        definition: {
          ...data.definition,
          titleOverrides: Object.keys(overrides).length ? overrides : undefined,
        },
      });
    },
    [data, i18n.language, updateReport],
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
  const views = [...activeViews, ...extraViews];
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

  // chooseView only ever returns the view it picked plus a Table, so four of the five buttons had
  // nothing to find and fell back to index 0 — «خطی» and «KPI» looked enabled and quietly put you
  // back on the bar chart. Build the view when it does not exist yet, the same as /ask does.
  const switchView = (target: SwitchTarget) => {
    const idx = findViewForTarget(views, target);
    if (idx >= 0) {
      setActiveIdx(idx);
      return;
    }
    const built = buildViewForTarget(target, result, views[activeIdx]);
    setExtraViews((prev) => [...prev, built]);
    setActiveIdx(views.length);
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
        // titleNode, not title: PageHeader wraps `title` in its own Typography.Title, and
        // EditableLabel already renders one — nesting them makes two headings in the DOM.
        titleNode={
          <EditableLabel
            value={title}
            onSave={saveTitle}
            level={3}
            tooltip={t("common.editLabel")}
            disabled={!canEdit}
            style={{ fontWeight: 500 }}
          />
        }
        subtitle={data.definition.description}
        actions={headerActions}
      />

      <Descriptions
        size="small"
        // Three columns in 287px gave each fact 96px and made them wrap downwards
        // instead of across: «آخرین بروزرسانی» alone was 198px tall, about a quarter
        // of the screen for one date. antd takes a responsive column count, so this
        // is a prop rather than a media query fighting its layout.
        column={{ xs: 1, sm: 2, md: 3 }}
        style={{ marginBottom: 12 }}
        items={[
          {
            key: "owner",
            label: t("viewer.owner"),
            children: reportOwnerLabel(data.ownerName, user, t("library.organizationUser")),
          },
          { key: "model", label: t("viewer.model"), children: data.definition.dataset },
          {
            key: "updated",
            label: t("viewer.updated"),
            children: formatDateTime(data.updatedAt, i18n.dir() === "rtl" ? "rtl" : "ltr"),
          },
        ]}
      />

      <FilterBar
        // Every filter the report defines, not only the ones currently narrowing the query.
        filters={uiFilters}
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
