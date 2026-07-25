// report-web/src/features/ask-ai/useAskAi.ts
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  GroupNode,
  QueryResult,
  ReportDefinition,
  ReportView,
  SemanticModel,
  ViewType,
} from "@/contracts";
import { createAIService } from "@/ai";
import { drillIntoAsync } from "@/query/drilldown";
import { chooseView } from "@/presentation/auto-viz";
import { getSemanticModel, listSemanticModels } from "@/semantic/registry";
import { executeReport } from "@/api/executeApi";

export type DrillCrumb = {
  label: string;
  def: ReportDefinition;
  result: QueryResult;
  views: ReportView[];
};

export type AskAiPhase = "hero" | "thinking" | "result" | "error";

export interface AskAiState {
  phase: AskAiPhase;
  datasetKey: string;
  def?: ReportDefinition;
  result?: QueryResult;
  views: ReportView[];
  activeViewIndex: number;
  drillPath: DrillCrumb[];
  explanation?: string;
  errorKey?: string;
}

/** The default model key to pre-select — the first model of the active set
 *  (FarsNezam in real mode, sample models in mock mode). */
const DEFAULT_MODEL_KEY = listSemanticModels()[0]?.key ?? "model-sales";

/** Maps a view-switcher subtype to a ReportView shape. */
const SUBTYPE_TO_VIEW: Record<
  "bar" | "line" | "pie",
  Pick<ReportView, "type" | "library" | "component">
> = {
  bar: { type: "chart", library: "recharts", component: "BarChart" },
  line: { type: "chart", library: "recharts", component: "LineChart" },
  pie: { type: "chart", library: "recharts", component: "PieChart" },
};

export function useAskAi() {
  const ai = useMemo(() => createAIService(), []);
  const [state, setState] = useState<AskAiState>({
    phase: "hero",
    datasetKey: DEFAULT_MODEL_KEY,
    views: [],
    activeViewIndex: 0,
    drillPath: [],
  });
  // Guard against out-of-order responses from rapid resubmits.
  const reqSeq = useRef(0);

  const submit = useCallback(
    async (prompt: string, datasetKey?: string) => {
      const key = datasetKey ?? state.datasetKey;
      const seq = ++reqSeq.current;
      setState((s) => ({ ...s, phase: "thinking", datasetKey: key, errorKey: undefined }));
      try {
        const semantic: SemanticModel = getSemanticModel(key);
        const res = await ai.generate({ prompt, semanticModel: semantic, locale: "fa" });
        if (seq !== reqSeq.current) return; // stale
        const def = res.definition;
        // Execute via the gated executeReport (server-side in real mode, in-browser in mock).
        const result = await executeReport(def);
        // Prefer AI-pinned views; if empty, fall back to auto-viz.
        const views =
          def.presentation?.views?.length > 0
            ? def.presentation.views
            : chooseView(def, result, semantic);
        setState((s) => ({
          ...s,
          phase: "result",
          def,
          result,
          views,
          activeViewIndex:
            typeof def.presentation?.defaultView === "number"
              ? def.presentation.defaultView
              : 0,
          drillPath: [],
          explanation: res.explanation,
        }));
      } catch {
        if (seq !== reqSeq.current) return;
        setState((s) => ({ ...s, phase: "error", errorKey: "ask.error.unmapped" }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ai, state.datasetKey],
  );

  const switchView = useCallback(
    (type: ViewType | "bar" | "line" | "pie") => {
      setState((s) => {
        // Look for an existing view of that type/subtype first (avoids recompute).
        const existing = s.views.findIndex((v) =>
          type === "table" || type === "kpi"
            ? v.type === type
            : v.component.toLowerCase().includes(type),
        );
        if (existing >= 0) return { ...s, activeViewIndex: existing };
        if (type === "table" || type === "kpi") {
          const v: ReportView = {
            type,
            library: "antd",
            component: type === "table" ? "Table" : "KpiCard",
            mapping: {},
          };
          return { ...s, views: [...s.views, v], activeViewIndex: s.views.length };
        }
        // Build a chart view with correct axis mapping derived from result columns.
        // Never blindly copy base.mapping: when the active view is a Table, its
        // mapping only has `columns`, no x/y — the chart would silently get undefined
        // axes and render nothing.  Derive dim/meas from the current result instead
        // and use base.mapping's values only when they are actually set.
        const base = s.views[s.activeViewIndex];
        const cols = s.result?.columns ?? [];
        const dim = cols.find((c) => !c.isMetric)?.key;
        const meas = cols.find((c) => c.isMetric)?.key;
        const chartKey = type as "bar" | "line" | "pie";
        const subtype = SUBTYPE_TO_VIEW[chartKey] ?? SUBTYPE_TO_VIEW.bar;
        let mapping: ReportView["mapping"];
        if (chartKey === "pie") {
          mapping = {
            category: base?.mapping?.category ?? dim,
            measure: base?.mapping?.measure ?? meas,
          };
        } else {
          mapping = {
            x: base?.mapping?.x ?? dim,
            y: base?.mapping?.y ?? meas,
          };
        }
        const v: ReportView = { ...subtype, mapping };
        return { ...s, views: [...s.views, v], activeViewIndex: s.views.length };
      });
    },
    [],
  );

  const drill = useCallback(
    async (node: GroupNode) => {
      // Capture the current def synchronously before any async work.
      let parentDef: ReportDefinition | undefined;
      let parentResult: QueryResult | undefined;
      let parentViews: ReportView[] | undefined;
      let parentDatasetKey: string | undefined;
      setState((s) => {
        parentDef = s.def;
        parentResult = s.result;
        parentViews = s.views;
        parentDatasetKey = s.datasetKey;
        return s;
      });
      if (!parentDef) return;

      try {
        const semantic = getSemanticModel(parentDatasetKey!);
        const { def, result } = await drillIntoAsync(parentDef, node);
        const views = chooseView(def, result, semantic);
        const crumb: DrillCrumb = {
          label: String(node.value),
          def: parentDef,
          result: parentResult!,
          views: parentViews!,
        };
        setState((s) => ({
          ...s,
          def,
          result,
          views,
          activeViewIndex: 0,
          drillPath: [...s.drillPath, crumb],
        }));
      } catch {
        // drilldown config missing or execute failed — silently skip
      }
    },
    [],
  );

  const drillUp = useCallback(() => {
    setState((s) => {
      if (s.drillPath.length === 0) return s;
      const path = [...s.drillPath];
      const prev = path.pop()!;
      return {
        ...s,
        def: prev.def,
        result: prev.result,
        views: prev.views,
        activeViewIndex: 0,
        drillPath: path,
      };
    });
  }, []);

  /**
   * Switches the active dataset (model key) only — does NOT generate a new report.
   * Used by the dataset picker so the user can change context before submitting.
   */
  const setDataset = useCallback(
    (key: string) => setState((s) => ({ ...s, datasetKey: key })),
    [],
  );

  const reset = useCallback(
    () =>
      setState({
        phase: "hero",
        datasetKey: DEFAULT_MODEL_KEY,
        views: [],
        activeViewIndex: 0,
        drillPath: [],
      }),
    [],
  );

  return { state, submit, setDataset, switchView, drill, drillUp, reset };
}
