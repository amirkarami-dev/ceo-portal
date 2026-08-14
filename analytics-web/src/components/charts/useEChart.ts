import { useCallback, useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsCoreOption } from "echarts";
import { useUiStore } from "../../store/ui-store";
import { echartsTheme } from "../../theme/echarts-theme";

/** ECharts event name → handler. Handlers may be recreated every render; see below. */
export type EChartEvents = Record<string, (params: never) => void>;

/**
 * Mount an ECharts instance on a div, themed, following light/dark, and updated in place.
 *
 * **Every chart in the app goes through here** — the report renderers included, since
 * `echarts-for-react` was dropped. Two reasons it had to be:
 *
 * - Its init is two-phase (create a temporary instance, wait for that instance's `finished` event,
 *   dispose it, re-init from the measured size) and **that never completes in jsdom**, so a real chart
 *   could not be tested at all. Asserting the option handed to a `vi.mock` cannot catch an option
 *   ECharts rejects, renames or silently drops.
 * - Called directly, `echarts.init` takes no theme and quietly falls back to ECharts' own palette and
 *   `#333` text — 1.31:1 on our dark panel. That is how two admin charts looked like a different
 *   product for months: nothing errors, the chart just renders in someone else's colours.
 *
 * ## Why three effects and not one
 *
 * The obvious single effect keyed on `[option, themeMode]` looks right and is a trap. The report
 * renderer rebuilds its option object on every render, so a fresh identity every time would mean
 * **dispose and re-init on every render** — worse than the wrapper it replaces, and it would reset the
 * dataZoom slider and dismiss any open tooltip as it went. So:
 *
 * - **init/dispose** keyed on the theme (and on whether there is an option at all, as a *boolean*, so a
 *   new option object does not retrigger it).
 * - **setOption** keyed on the option, updating the live instance.
 * - **handlers** kept in a ref and read at dispatch time, so a new closure each render does not mean
 *   unbinding and rebinding listeners.
 *
 * ## Why the returned ref is a callback and not a `useRef` object
 *
 * A ref object is silent. `ref.current` is read once, inside the init effect, and nothing re-runs that
 * effect when the ref later points at a **different element** — the deps above are theme, has-option
 * and event names, none of which notice.
 *
 * That is not hypothetical. The report renderer draws a donut as a flex row with the chart in an inner
 * box, and every other chart as a single div. Switching between them keeps the component mounted, so
 * React reuses the outer DOM node and just moves the ref inwards. The instance stayed bound to the
 * node React had repurposed as the flex row, and the chart vanished — no error, no warning, an empty
 * rectangle where the ring should be. A callback ref makes the element a dependency like any other, so
 * a moved ref disposes and rebuilds exactly the way a theme change does.
 */
export function useEChart(option: EChartsCoreOption | null, events?: EChartEvents) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // Stable identity, so React only calls it when the element genuinely attaches or detaches — an
  // inline arrow would be a new function every render and would detach/reattach with it.
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  const chart = useRef<echarts.ECharts | null>(null);
  const themeMode = useUiStore((s) => s.themeMode);

  // Read at dispatch time rather than closed over at bind time, so handlers stay current without the
  // listener churn of rebinding on every render.
  const latestEvents = useRef(events);
  latestEvents.current = events;

  // The theme is fixed at `init`, so a rebuild is the only way to follow light/dark. This effect must
  // therefore also apply the current option, or the freshly built chart would be blank until the next
  // option change — which may never come.
  const latestOption = useRef(option);
  latestOption.current = option;

  /** The option the live instance is already showing, so mount does not apply it twice. */
  const applied = useRef<EChartsCoreOption | null>(null);

  // Booleans and a joined string, deliberately: identity-stable, so only a real change re-inits.
  const hasOption = option != null;
  const eventNames = Object.keys(events ?? {}).sort().join(",");

  useEffect(() => {
    if (!el || !hasOption) return;

    const instance = echarts.init(el, echartsTheme(themeMode));
    chart.current = instance;

    for (const name of eventNames ? eventNames.split(",") : []) {
      instance.on(name, (params: unknown) => latestEvents.current?.[name]?.(params as never));
    }

    if (latestOption.current) {
      // notMerge, matching what the renderer did through echarts-for-react. It is what makes a switch
      // between chart kinds or series counts clean — and also what resets dataZoom and dismisses an
      // open tooltip, which is a step-4 question, not this change's.
      instance.setOption(latestOption.current, { notMerge: true });
      applied.current = latestOption.current;
    }

    const onResize = () => instance.resize();
    window.addEventListener("resize", onResize);

    /**
     * Follow the CONTAINER, not just the window.
     *
     * recharts sized itself through `ResponsiveContainer`, which watches its own box with a
     * ResizeObserver. A bare `echarts.init` measures once and then only ever hears about window
     * resizes — so a chart whose container changes without the window changing keeps its old canvas
     * size. On a dashboard that is the normal case, not an edge one: react-grid-layout drags and
     * resizes widgets, and the sidebar folds, none of which resizes the window.
     *
     * Losing this was a parity regression waiting to happen, and it is invisible in tests because
     * jsdom reports no layout at all.
     */
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => instance.resize())
        : undefined;
    ro?.observe(el);

    /**
     * Redraw once the webfont has landed.
     *
     * Vazirmatn is loaded asynchronously (`theme/global.css`), canvas text is rasterised once, and
     * neither ECharts nor zrender listens for font loading. Measured: «آذربایجان شرقی» is 62.27px wide
     * in the fallback face and 71.97px in Vazirmatn — a 15.6% shift, and `grid.containLabel` sizes the
     * plot box from exactly those metrics. So a chart drawn before the font arrives keeps both the
     * wrong glyphs and a plot measured for the wrong font, permanently.
     *
     * Here rather than per chart, because every chart in the app now comes through this hook.
     */
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive && !instance.isDisposed()) instance.resize();
    });

    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, [el, themeMode, hasOption, eventNames]);

  // Subsequent option changes update the live instance instead of rebuilding it. `applied` keeps this
  // from re-sending on mount the option the init effect has just set — both effects run after the same
  // commit, so without it every chart pays for two setOption calls before it draws anything.
  useEffect(() => {
    if (!option || !chart.current || option === applied.current) return;
    chart.current.setOption(option, { notMerge: true });
    applied.current = option;
  }, [option]);

  return ref;
}
