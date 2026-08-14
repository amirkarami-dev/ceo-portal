import { chartColors } from "./tokens";
import { tokens, type ThemeMode } from "./theme";

/**
 * The ECharts theme — the palette, type and surfaces every ECharts chart in the app gets for free.
 *
 * ECharts, unlike recharts, has a real theme system: `echarts.init(el, theme)` takes either a
 * registered theme name or a plain object. Every chart in the app now goes through
 * `components/charts/useEChart.ts`, so this one object themes all of them from a single `init` call.
 *
 * Use it. The two admin charts used to call `echarts.init(el)` with nothing, which silently gave
 * them ECharts' own defaults: a palette where five of nine colours miss 3:1 on white (its yellow
 * reads 1.56:1), and `#333` body text that measures **1.31:1** on our dark panel — effectively
 * invisible. Nothing warns you; the chart just looks like a different product.
 *
 * What belongs here vs. in an option: this file owns **colour, type and surface**. Anything that
 * depends on reading direction — axis `inverse`, `yAxis.position`, legend side, tooltip text
 * `align`, number formatters — stays in the option, because a theme cannot know the direction.
 */
export function echartsTheme(mode: ThemeMode): Record<string, unknown> {
  const c = chartColors(mode);

  // One axis shape for all four axis types. ECharts keeps categoryAxis / valueAxis / logAxis /
  // timeAxis as separate theme keys, and a chart that switches axis type otherwise loses its
  // colours without any error.
  const axis = {
    axisLine: { show: true, lineStyle: { color: c.axis } },
    axisTick: { show: true, lineStyle: { color: c.axis } },
    axisLabel: { show: true, color: c.axis },
    splitLine: { show: true, lineStyle: { color: c.grid } },
    splitArea: { show: false },
  };

  return {
    color: c.series,
    // The card behind the chart already carries the surface. An opaque chart background paints a
    // hard rectangle inside a rounded card, and in dark mode it is the wrong dark.
    backgroundColor: "transparent",
    textStyle: { fontFamily: tokens.fontFa, color: c.text },

    title: { textStyle: { color: c.text }, subtextStyle: { color: c.axis } },
    // inactiveColor is what a legend entry fades to when you click it off. ECharts' default grey
    // is fixed, so in dark mode "off" and "on" look the same.
    legend: { textStyle: { color: c.text }, inactiveColor: c.axis },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      textStyle: { color: c.text },
      axisPointer: { lineStyle: { color: c.axis }, crossStyle: { color: c.axis } },
    },

    categoryAxis: axis,
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    grid: { borderColor: c.grid },

    // The heatmap's magnitude ramp. It ran on ECharts' default blue-to-red before, which is a
    // second palette on the same page. This is one hue at increasing strength, which is what a
    // single measure deserves — red means "different thing", not "more".
    //
    // Both ramps are monotonic in luminance, and the top stop is 9.6:1 (light) / 11.6:1 (dark).
    // The bottom stop is deliberately near the panel: on a heatmap "almost nothing" should look
    // like almost nothing, and the visualMap bar beside it carries the numbers.
    visualMap: {
      textStyle: { color: c.text },
      inRange: {
        color:
          mode === "dark"
            ? ["#1b2a44", "#24417e", "#326BFC", "#7ba1fd", "#c7d8fe"]
            : ["#eaf0fe", "#9dbafd", "#5a88fd", "#326BFC", "#1a3f96"],
      },
    },

    // dataZoom's default handle and fill are a mid grey that disappears on the dark panel.
    dataZoom: {
      borderColor: c.grid,
      textStyle: { color: c.axis },
      handleStyle: { color: c.axis, borderColor: c.axis },
      dataBackground: { lineStyle: { color: c.grid }, areaStyle: { color: c.grid } },
    },
  };
}
