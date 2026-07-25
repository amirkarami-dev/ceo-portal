import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPlugin = any;

export default defineConfig({
  // Cast needed: monorepo root has vite@5 alongside analytics-web's vite@6;
  // tsc resolves types from root node_modules causing a dual-instance mismatch.
  plugins: [react() as AnyPlugin],
  // react-draggable (via react-grid-layout) reads process.env at runtime; the
  // browser has no `process`, so every drag threw "process is not defined".
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    testTimeout: 10000,
  },
});
