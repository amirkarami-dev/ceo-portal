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

// Recharts ResponsiveContainer (and some other libraries) use ResizeObserver
// which jsdom does not implement. Provide a minimal stub globally.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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
