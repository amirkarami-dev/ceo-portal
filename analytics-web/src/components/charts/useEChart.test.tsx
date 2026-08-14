import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const initCalls: unknown[][] = [];
const setOptionCalls: unknown[][] = [];
const boundEvents: string[] = [];
const listeners: Record<string, (p: unknown) => void> = {};
const disposed = { count: 0 };
const observed: unknown[] = [];
const resizes: number[] = [];
const observers: CapturingResizeObserver[] = [];
const disconnects = { count: 0 };
class CapturingResizeObserver {
  constructor(public cb: () => void) {
    observers.push(this);
  }
  observe(el: unknown) { observed.push(el); }
  unobserve() {}
  disconnect() { disconnects.count++; }
}
vi.mock("echarts", () => ({
  init: (...args: unknown[]) => {
    initCalls.push(args);
    return {
      setOption: (...a: unknown[]) => void setOptionCalls.push(a),
      on: (name: string, handler: (p: unknown) => void) => {
        boundEvents.push(name);
        listeners[name] = handler;
      },
      resize: () => void resizes.push(1),
      dispose: () => { disposed.count++; },
    };
  },
}));

import { useEChart } from "./useEChart";
import { echartsTheme } from "../../theme/echarts-theme";
import { useUiStore } from "../../store/ui-store";

function Chart({
  option,
  events,
}: {
  option: Record<string, unknown> | null;
  events?: Record<string, (p: never) => void>;
}) {
  const ref = useEChart(option, events);
  return <div ref={ref} data-testid="chart" />;
}

const option = { series: [{ type: "bar", data: [1, 2, 3] }] };

beforeEach(() => {
  initCalls.length = 0;
  setOptionCalls.length = 0;
  boundEvents.length = 0;
  for (const k of Object.keys(listeners)) delete listeners[k];
  disposed.count = 0;
  observed.length = 0;
  resizes.length = 0;
  observers.length = 0;
  disconnects.count = 0;
  vi.stubGlobal("ResizeObserver", CapturingResizeObserver);
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

// ── Updating in place ─────────────────────────────────────────────────────────
// The report renderer rebuilds its option object every render. A single effect keyed on
// [option, themeMode] — which is what this hook used to have — would dispose and re-init the chart
// each time: worse than the echarts-for-react wrapper it replaced, and it would reset the dataZoom
// slider and dismiss any open tooltip on the way.

describe("useEChart — a new option updates, it does not rebuild", () => {
  it("calls setOption again and does NOT re-init", () => {
    const { rerender } = render(<Chart option={{ series: [{ type: "bar", data: [1] }] }} />);
    expect(initCalls).toHaveLength(1);
    expect(setOptionCalls).toHaveLength(1);

    // A fresh object with the same shape — exactly what a re-render produces.
    rerender(<Chart option={{ series: [{ type: "bar", data: [2] }] }} />);

    expect(initCalls, "re-initialised on an option change").toHaveLength(1);
    expect(disposed.count, "disposed on an option change").toBe(0);
    expect(setOptionCalls).toHaveLength(2);
  });

  it("still rebuilds on a theme change, and gives the new instance the current option", () => {
    const { rerender } = render(<Chart option={{ series: [{ type: "bar", data: [1] }] }} />);
    setOptionCalls.length = 0;

    act(() => useUiStore.setState({ themeMode: "dark" }));
    rerender(<Chart option={{ series: [{ type: "bar", data: [1] }] }} />);

    expect(initCalls, "did not rebuild for the new theme").toHaveLength(2);
    expect(disposed.count).toBe(1);
    // The rebuilt instance must be given the option it is meant to be showing. Without this the chart
    // goes blank on a light/dark switch until the next option change, which may never come.
    expect(setOptionCalls.length, "new instance was left blank").toBeGreaterThanOrEqual(1);
  });
});

describe("useEChart — event handlers", () => {
  it("binds the named events once", () => {
    render(<Chart option={option} events={{ click: () => undefined }} />);

    expect(boundEvents).toEqual(["click"]);
  });

  it("a new handler identity does not rebind or rebuild", () => {
    const { rerender } = render(<Chart option={option} events={{ click: () => undefined }} />);
    // Both a new option AND a new handler closure, the normal case on a re-render.
    rerender(<Chart option={{ ...option }} events={{ click: () => undefined }} />);

    expect(boundEvents, "rebound listeners on a new closure").toEqual(["click"]);
    expect(initCalls).toHaveLength(1);
  });

  it("dispatches to the latest handler, not the one bound at init", () => {
    // Guards the ref indirection. Bind the handler directly and it is captured at init, so a rerender
    // with a new closure would still call the first one — a drill click going to a stale callback.
    const calls: string[] = [];
    const { rerender } = render(
      <Chart option={option} events={{ click: () => calls.push("first") }} />,
    );
    rerender(<Chart option={option} events={{ click: () => calls.push("second") }} />);

    listeners.click({ dataIndex: 0 });

    expect(calls).toEqual(["second"]);
  });

  it("takes no events at all, as the admin charts do", () => {
    render(<Chart option={option} />);

    expect(boundEvents).toEqual([]);
    expect(initCalls).toHaveLength(1);
  });
});

/**
 * recharts sized itself through ResponsiveContainer, which watches its own box. A bare echarts.init
 * measures once and then hears only window resizes — so on a dashboard, where react-grid-layout drags
 * and resizes widgets and the sidebar folds, the chart would keep its old canvas size. jsdom reports
 * no layout, so this is only checkable by the wiring.
 */
describe("useEChart — follows its container, not just the window", () => {
  it("observes the chart element", () => {
    render(<Chart option={option} />);

    expect(observed).toHaveLength(1);
    expect(observed[0]).toBe(document.querySelector('[data-testid="chart"]'));
  });

  it("disconnects on unmount, so the observer does not outlive the chart", () => {
    const { unmount } = render(<Chart option={option} />);
    unmount();

    expect(disconnects.count).toBe(1);
  });

  it("resizes the instance when the container changes", () => {
    render(<Chart option={option} />);
    expect(resizes).toHaveLength(0);

    // Fire the observer's own callback, which is what a layout change does.
    observers[0].cb();

    expect(resizes, "a container resize did not reach instance.resize()").toHaveLength(1);
  });

  it("a window resize still works too", () => {
    render(<Chart option={option} />);
    window.dispatchEvent(new Event("resize"));

    expect(resizes).toHaveLength(1);
  });
});

/**
 * The defect this hook shipped with, and the reason its ref is a callback.
 *
 * Found in a browser, not here: switching a report to its donut view left an empty rectangle where
 * the ring should be — no error, no warning, no failing test. The renderer draws a donut as a flex
 * row with the chart in an inner box and every other chart as a single div, so the ref MOVES while
 * the component stays mounted. React reused the outer node, the instance stayed bound to it, and
 * React then filled that same node with the flex row's children.
 *
 * A `useRef` object cannot notice this: `ref.current` is read once inside the init effect, whose deps
 * are the theme, whether there is an option, and the event names.
 */
function MovingChart({ nested }: { nested: boolean }) {
  const ref = useEChart(option);
  return nested ? (
    <section data-testid="wrap">
      <div ref={ref} data-testid="chart" />
    </section>
  ) : (
    <div ref={ref} data-testid="chart" />
  );
}

describe("useEChart — the ref moving to a different element", () => {
  it("rebuilds on the new element instead of leaving the chart on the old one", () => {
    const { rerender, getByTestId } = render(<MovingChart nested={false} />);
    const first = initCalls[0][0];
    expect(first).toBe(getByTestId("chart"));

    rerender(<MovingChart nested />);

    // Disposed once and re-initialised, exactly the way a theme change behaves.
    expect(disposed.count).toBe(1);
    expect(initCalls).toHaveLength(2);
    const second = initCalls[1][0];
    expect(second).not.toBe(first);
    expect(second).toBe(getByTestId("chart"));
  });

  it("observes the element it is actually drawing on", () => {
    const { rerender, getByTestId } = render(<MovingChart nested={false} />);
    rerender(<MovingChart nested />);

    // The ResizeObserver has to follow too, or the chart keeps measuring a box it no longer occupies.
    expect(observed[observed.length - 1]).toBe(getByTestId("chart"));
    expect(disconnects.count).toBe(1);
  });

  it("does not rebuild when the element stays put", () => {
    const { rerender } = render(<MovingChart nested={false} />);
    rerender(<MovingChart nested={false} />);

    // The other half: a callback ref that is a fresh function each render would detach and reattach
    // on every render, which is the churn the three-effect split exists to avoid.
    expect(initCalls).toHaveLength(1);
    expect(disposed.count).toBe(0);
  });
});
