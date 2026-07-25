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
