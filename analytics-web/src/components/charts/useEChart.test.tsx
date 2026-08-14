import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const initCalls: unknown[][] = [];
const disposed = { count: 0 };
vi.mock("echarts", () => ({
  init: (...args: unknown[]) => {
    initCalls.push(args);
    return { setOption: vi.fn(), resize: vi.fn(), dispose: () => { disposed.count++; } };
  },
}));

import { useEChart } from "./useEChart";
import { echartsTheme } from "../../theme/echarts-theme";
import { useUiStore } from "../../store/ui-store";

function Chart({ option }: { option: Record<string, unknown> | null }) {
  const ref = useEChart(option);
  return <div ref={ref} data-testid="chart" />;
}

const option = { series: [{ type: "bar", data: [1, 2, 3] }] };

beforeEach(() => {
  initCalls.length = 0;
  disposed.count = 0;
  useUiStore.setState({ themeMode: "light" });
});

describe("useEChart", () => {
  // The whole point of the hook. Two admin charts called echarts.init(el) bare for months: no
  // error, no warning, they simply rendered in ECharts' palette with #333 text that measures
  // 1.31:1 on our dark panel.
  it("never initialises a chart without the theme", () => {
    render(<Chart option={option} />);
    expect(initCalls).toHaveLength(1);
    expect(initCalls[0][1], "second arg to echarts.init is the theme").toEqual(echartsTheme("light"));
  });

  it("uses the dark theme when the app is dark", () => {
    useUiStore.setState({ themeMode: "dark" });
    render(<Chart option={option} />);
    expect(initCalls[0][1]).toEqual(echartsTheme("dark"));
  });

  // A theme is bound at init time and cannot be changed on a live instance, so following the app's
  // light/dark toggle means disposing and rebuilding. Without themeMode in the dependency list the
  // chart keeps its light-mode axis text after the user switches to dark.
  it("rebuilds the chart when the theme changes", () => {
    const { rerender } = render(<Chart option={option} />);
    expect(initCalls).toHaveLength(1);

    act(() => useUiStore.setState({ themeMode: "dark" }));
    rerender(<Chart option={option} />);

    expect(initCalls, "did not re-init on theme change").toHaveLength(2);
    expect(disposed.count, "old instance leaked").toBe(1);
    expect(initCalls[1][1]).toEqual(echartsTheme("dark"));
  });

  it("does not initialise anything while the option is still null", () => {
    render(<Chart option={null} />);
    expect(initCalls).toHaveLength(0);
  });

  it("disposes the instance on unmount", () => {
    const { unmount } = render(<Chart option={option} />);
    unmount();
    expect(disposed.count).toBe(1);
  });
});
