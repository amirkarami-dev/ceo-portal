import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as echarts from "echarts";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";
import { useEChart } from "./useEChart";
import { echartsTheme } from "@/theme/echarts-theme";

/**
 * The one test that mounts a **real** ECharts chart — nothing here is mocked.
 *
 * ## Why this file exists
 *
 * It is the guard on the canvas and element-size stubs in `vitest.setup.ts`. Without the canvas stub
 * `getContext("2d")` returns null and ECharts dies with `Cannot set properties of null (setting 'dpr')`
 * as an **unhandled rejection** — which Vitest attributes at run level, so it lands on whichever file
 * runs next and blames the wrong one. If someone deletes those stubs, this file fails loudly and in
 * the right place.
 *
 * It also proves something no mock can: that ECharts *accepts* the option it is given. Asserting the
 * object you handed to a `vi.mock` cannot catch an option ECharts renames, normalises or silently
 * drops. Reading it back off a live instance can.
 *
 * ## Why it tests `useEChart` and not `EChartsRenderer`
 *
 * Measured here, and it is a real constraint on the migration: **`echarts-for-react` cannot complete
 * an init in jsdom.** Its `initEchartsInstance` (`lib/core.js:68-89`) is two-phase — create a
 * temporary instance, wait for that instance's `finished` event, dispose it, re-init with the measured
 * `clientWidth`/`clientHeight`. In jsdom the container ends up carrying `_echarts_instance_` with a
 * canvas beside it, `clientWidth`/`clientHeight` reporting correctly, **zero errors logged** — and no
 * live instance, because the last thing to happen to the element was the dispose. Pumping 80
 * animation frames does not rescue it; neither does passing explicit `opts.width/height`.
 *
 * A direct `echarts.init` — what `useEChart` does, and what the two admin charts already use —
 * registers an instance immediately and behaves. So a real-mount test is possible, just not through
 * the wrapper. `EChartsRenderer` keeps its option-shape tests next door until it moves onto this hook.
 */

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

function Chart({ option }: { option: echarts.EChartsCoreOption }) {
  const ref = useEChart(option);
  return <div ref={ref} data-testid="chart" style={{ width: "400px", height: "300px" }} />;
}

const barOption: echarts.EChartsCoreOption = {
  animation: false,
  xAxis: { type: "category", data: ["تهران", "فارس"] },
  yAxis: { type: "value" },
  series: [{ name: "درآمد", type: "bar", data: [500, 700] }],
};

const el = () => document.querySelector<HTMLElement>("[data-testid='chart']")!;
const live = () => echarts.getInstanceByDom(el());

let errors: string[] = [];
let warns: string[] = [];

beforeEach(() => {
  errors = [];
  warns = [];
  vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.map(String).join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => void warns.push(a.map(String).join(" ")));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a real ECharts chart mounts in jsdom", () => {
  it("registers a live instance", () => {
    render(<Chart option={barOption} />, { wrapper });

    const instance = live();
    expect(instance, "no live instance — is the canvas stub still in vitest.setup.ts?").toBeDefined();
    // Falsy, not `false`: on echarts 5.6.0 `isDisposed()` returns `undefined` for a live chart rather
    // than a boolean, because the internal flag is simply unset until dispose runs.
    expect(instance!.isDisposed()).toBeFalsy();
  });

  /**
   * The plan's original acceptance criterion was "zero unhandled rejections across the run", which no
   * test can assert and which a half-working stub satisfies intermittently depending on file order.
   * Counting what one mount writes to the console asks the same question somewhere it can be answered.
   */
  it("mounts silently", () => {
    render(<Chart option={barOption} />, { wrapper });

    expect(errors, "console.error during mount").toEqual([]);
    // "[ECharts] Can't get DOM width or height" is what the clientWidth/clientHeight stub prevents;
    // the canvas stub alone does not silence it.
    expect(warns, "console.warn during mount").toEqual([]);
  });

  it("prints no jsdom 'Not implemented' canvas noise", () => {
    render(<Chart option={barOption} />, { wrapper });

    const all = [...errors, ...warns].join("\n");
    expect(all).not.toMatch(/Not implemented/i);
    expect(all).not.toMatch(/getContext/i);
  });

  it("has a real canvas to draw on, sized from the container", () => {
    render(<Chart option={barOption} />, { wrapper });

    const canvas = el().querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(el().clientWidth).toBe(400);
    expect(el().clientHeight).toBe(300);
  });

  // ── What only a live instance can prove ───────────────────────────────────

  it("ECharts accepts the option and keeps the series", () => {
    render(<Chart option={barOption} />, { wrapper });
    const opt = live()!.getOption() as { series: { type: string; data: unknown[] }[] };

    expect(opt.series).toHaveLength(1);
    expect(opt.series[0].type).toBe("bar");
    expect(opt.series[0].data).toHaveLength(2);
  });

  it("the theme really applied — the palette is ours, not ECharts' default", () => {
    render(<Chart option={barOption} />, { wrapper });
    const opt = live()!.getOption() as { color: string[] };

    // ECharts' own first colour is #5470c6. A mock would accept the theme without applying it.
    const themePalette = echartsTheme("light").color as string[];
    expect(opt.color[0]).toBe(themePalette[0]);
    expect(opt.color[0]).toBe("#326BFC");
  });

  it("renders Persian category labels without throwing on the stubbed text metrics", () => {
    render(<Chart option={barOption} />, { wrapper });
    const opt = live()!.getOption() as { xAxis: { data: string[] }[] };

    expect(opt.xAxis[0].data).toEqual(["تهران", "فارس"]);
  });

  it("disposes on unmount, leaving nothing behind", () => {
    const { unmount } = render(<Chart option={barOption} />, { wrapper });
    const node = el();
    expect(echarts.getInstanceByDom(node)).toBeDefined();

    unmount();

    // A leaked instance keeps a ResizeObserver and a render loop alive for the rest of the file.
    expect(echarts.getInstanceByDom(node)).toBeUndefined();
  });
});
