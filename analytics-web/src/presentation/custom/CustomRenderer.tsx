import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "antd";
import { useTranslation } from "react-i18next";
import type { ReportView } from "../../contracts/presentation";
import { EmptyState } from "../../components/ui";
import { getCustomReport, type Params } from "./registry";

/**
 * Renders a report the dimensional engine cannot describe. See `registry.ts` for why these exist.
 *
 * The parameters live in `view.options`, not `view.mapping`. `ViewMapping` is a fixed shape of named
 * chart bindings (`x`, `y`, `series`, `category`, `measure`) with no index signature; putting
 * `cityId` there would mean widening it with `[key: string]: unknown`, which weakens the typing of
 * every chart in the app to accommodate one report. `options` is already
 * `Record<string, unknown>` and is documented as renderer-specific — this is what it is for.
 */
export default function CustomRenderer({ view }: { view: ReportView }) {
  const { t } = useTranslation();
  const entry = getCustomReport(view.component);

  /**
   * Stored parameters win over the entry's defaults, so a saved report reopens on what it was saved
   * with. Only the keys the entry declares are taken: a stale `options` bag left by an earlier
   * version of a report should not smuggle arguments into `fetch`.
   */
  const initial = useMemo<Params>(() => {
    // `{}` rather than `undefined` when there is no entry: hooks below cannot be skipped, and an
    // optional value here would leak `undefined` into every use of it for a case the early return
    // already handles.
    if (!entry) return {};
    const stored = (view.options ?? {}) as Params;
    const picked: Params = { ...entry.defaults };
    for (const p of entry.params) {
      if (stored[p.key] !== undefined) picked[p.key] = stored[p.key];
    }
    return picked;
  }, [entry, view.options]);

  const [params, setParams] = useState<Params | undefined>(undefined);
  // The picker bar arrives in step 2; until then `setParams` keeps the state honest rather than
  // pretending the value is constant.
  void setParams;

  const active = params ?? initial;

  const query = useQuery({
    queryKey: ["custom-report", view.component, active],
    // Guarded by `enabled`; `entry` is non-null whenever this runs.
    queryFn: () => entry!.fetch(active),
    enabled: !!entry,
    staleTime: 60_000,
  });

  /**
   * An unknown component is an **empty state, not a fallback chart**.
   *
   * `chartKind` in `EChartsRenderer` deliberately defaults an unrecognised component to a bar, and
   * that is right there: a stored view naming an unknown *chart* still has a sensible chart to show.
   * Here there is nothing to fall back to, and quietly drawing something would hide a typo'd or
   * deleted registry id behind a plausible-looking screen.
   */
  if (!entry) {
    return <EmptyState description={t("customReport.unknown", { component: view.component })} />;
  }

  if (query.isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (query.isError || query.data === undefined) {
    return <EmptyState description={t("customReport.failed")} />;
  }

  const Body = entry.Component;
  return <Body data={query.data} params={active} />;
}
