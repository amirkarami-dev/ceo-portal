// react-draggable (via react-grid-layout) reads `process.env` at runtime; the
// browser has no `process`, so every widget drag threw "process is not defined".
// Shim it before any dependency code runs (covers dev pre-bundled deps too).
if (typeof (globalThis as { process?: unknown }).process === "undefined") {
  (globalThis as { process?: { env: Record<string, string> } }).process = { env: {} };
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/global.css";
import { App } from "./app/App";
import { initDemoClock } from "./app/demo-clock";

// Pin the query engine to 2025-06-01 so dynamic-date filters (startOfYear, today)
// resolve inside the bundled 2025 sample data.  Must run before the first render.
initDemoClock();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
