import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Pinned, and strict on purpose. The port is not cosmetic: the IdP's registered redirect URIs and
    // the API's CORS allow-list are keyed to it, so silently landing on 5278 because 5277 was taken
    // would fail at the login redirect with an error that says nothing about ports.
    port: 5277,
    strictPort: true,
  },
  test: {
    globals: true,
    // Node, not jsdom: the only tests here exercise pure functions over JSON and TextEncoder. A
    // jsdom environment would drag in the canvas-context and antd-jalali stubs that analytics-web
    // needs, for no gain — see the plan's Task 2 note.
    environment: "node",
  },
});
