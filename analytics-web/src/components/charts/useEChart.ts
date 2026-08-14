import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsCoreOption } from "echarts";
import { useUiStore } from "../../store/ui-store";
import { echartsTheme } from "../../theme/echarts-theme";

/**
 * Mount an ECharts instance on a div, themed and following light/dark.
 *
 * Every raw `echarts.init` in the app should come through here. Called directly it takes no theme,
 * and ECharts quietly falls back to its own palette and `#333` text — which is 1.31:1 on our dark
 * panel. That is how two admin charts ended up looking like a different product for months: nothing
 * errors, the chart just renders in someone else's colours.
 *
 * `themeMode` is in the dependency list on purpose. The theme is fixed at `init` time, so switching
 * to dark has no effect until the instance is disposed and rebuilt — without this the charts keep
 * their light-mode axis text on the dark panel.
 *
 * The report renderers do not need this: echarts-for-react takes the same theme object as a prop.
 */
export function useEChart(option: EChartsCoreOption | null) {
  const ref = useRef<HTMLDivElement>(null);
  const themeMode = useUiStore((s) => s.themeMode);

  useEffect(() => {
    if (!ref.current || !option) return;
    const chart = echarts.init(ref.current, echartsTheme(themeMode));
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option, themeMode]);

  return ref;
}
