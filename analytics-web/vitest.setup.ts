import "@testing-library/jest-dom/vitest";

// Ant Design uses window.matchMedia (via useBreakpoint) which jsdom doesn't provide.
// Provide a minimal stub so Antd layout components render without throwing.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Recharts ResponsiveContainer, ECharts' size-sensor and antd all use ResizeObserver,
// which jsdom does not implement. Provide a minimal stub globally.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── Canvas, so ECharts can mount ─────────────────────────────────────────────
// jsdom has no 2D context: `getContext("2d")` returns null and prints
// "Not implemented: HTMLCanvasElement.prototype.getContext". Without this, mounting a real ECharts
// chart fails with an **unhandled rejection** — `Cannot set properties of null (setting 'dpr')`, from
// the second init inside echarts-for-react's `finished` handler. Vitest attributes that at run level,
// so it surfaces in whichever file happens to run next and blames the wrong one.
//
// A Proxy rather than a hand-listed object: zrender reaches for a long tail of context methods and
// properties, and a missing one is a TypeError deep inside a render. Unknown members answer with a
// no-op function, known ones with something plausible.
if (typeof HTMLCanvasElement !== "undefined") {
  const context2d = () => {
    const state: Record<string, unknown> = {
      canvas: undefined,
      // zrender measures every label through this. Returning `{ width: 0 }` makes all text
      // zero-width, which quietly collapses `grid.containLabel` maths — so estimate instead. It is
      // not real font metrics and must not be treated as such; it only keeps layout non-degenerate.
      measureText: (text: string) => ({
        width: String(text ?? "").length * 6,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: String(text ?? "").length * 6,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      }),
      getImageData: (_x: number, _y: number, w = 1, h = 1) => ({
        data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
        width: w,
        height: h,
      }),
      createImageData: (w = 1, h = 1) => ({
        data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
        width: w,
        height: h,
      }),
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      createPattern: () => null,
      getLineDash: () => [],
      isPointInPath: () => false,
      isPointInStroke: () => false,
      // Written to by zrender; they have to survive assignment rather than vanish.
      direction: "inherit",
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      lineWidth: 1,
    };
    return new Proxy(state, {
      get: (target, prop) => (prop in target ? target[prop as string] : () => undefined),
      set: (target, prop, value) => {
        target[prop as string] = value;
        return true;
      },
    });
  };

  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    if (kind !== "2d") return null;
    const ctx = context2d() as unknown as CanvasRenderingContext2D & { canvas: HTMLCanvasElement };
    ctx.canvas = this;
    return ctx;
  } as HTMLCanvasElement["getContext"];

  // exportPdf reads this; a data URL keeps the PDF path exercisable instead of throwing.
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
}

// ── Elements have a size ─────────────────────────────────────────────────────
// jsdom reports every clientWidth/clientHeight as 0. ECharts then warns once per chart —
// "[ECharts] Can't get DOM width or height" — and lays out against nothing. Our own charts size with
// `height: 360, width: "100%"`, so the percentage cannot rescue the width.
//
// Inline px wins where it is given, so a test that says 240×240 gets 240×240; otherwise a plausible
// default. Returning 0 for everything was never truthful either — this is a stub replacing a stub.
for (const [prop, fallback] of [
  ["clientWidth", 800],
  ["clientHeight", 600],
] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get(this: HTMLElement) {
      const inline = prop === "clientWidth" ? this.style?.width : this.style?.height;
      const px = /^(\d+(?:\.\d+)?)px$/.exec(inline ?? "");
      return px ? Math.round(parseFloat(px[1])) : fallback;
    },
  });
}

// antd v5 Table / rc-table calls getComputedStyle for scrollbar width detection;
// jsdom marks this as not-implemented. Stub it out so tests don't print warnings.
const _origGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  try { return _origGetComputedStyle(elt, pseudoElt); } catch { return {} as CSSStyleDeclaration; }
};

// antd-jalali is stubbed here — not because the package is broken (the app builds and the picker
// works in the browser) but because it reaches into antd with an extensionless deep import
// ("antd/es/date-picker/generatePicker/generateRangePicker"). Vite adds the extension during dev and
// build; under Vitest antd stays externalised and that specifier reaches Node's ESM loader, which
// will not. server.deps.inline and a resolve alias were both tried; neither reaches an import made
// INSIDE an externalised package.
//
// The stub keeps the real field's contract — a string in, the same string out — so the unit tests
// still prove the WIRING: which control a field gets, and that a range keeps both of its bounds. The
// calendar panel itself is verified in the browser, the only place a calendar can really be judged.
import { createElement } from "react";

vi.mock("antd-jalali", () => ({
  JalaliLocaleListener: () => null,
  DatePicker: (props: {
    value?: { format?: (f: string) => string } | null;
    onChange?: (d: unknown) => void;
    placeholder?: string;
    style?: Record<string, unknown>;
  }) =>
    createElement("input", {
      "data-testid": "jalali-picker",
      style: props.style,
      placeholder: props.placeholder,
      value: props.value?.format?.("YYYY/MM/DD") ?? "",
      onChange: (e: { target: { value: string } }) =>
        props.onChange?.(e.target.value ? { format: () => e.target.value } : null),
    }),
}));
