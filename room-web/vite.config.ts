import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

/**
 * Makes Excalidraw actually use its Persian translation.
 *
 * Excalidraw filters its own language list by how complete each translation is:
 *
 *     const COMPLETION_THRESHOLD = 85;
 *     languages = [...].filter(lang => percentages[lang.code] >= COMPLETION_THRESHOLD)
 *
 * and it ships `"fa-IR": 84`. Persian misses by ONE point, so it is not in the list, and
 * `langCode="fa-IR"` then hits this line in the editor:
 *
 *     const lang = languages.find(l => l.code === props.langCode) || defaultLang;
 *
 * — falling back to English with no warning, no error, and no locale request at all. That is why
 * the whiteboard showed English menus and the English canvas hint while the Persian strings sat
 * unused in the bundle.
 *
 * Raising that one number to 85 puts Persian back in the list. The translation is genuinely 84%
 * done; the remaining strings fall back to English individually, which is far better than every
 * string falling back at once.
 *
 * The chunk file names are content hashes and change on every upgrade, so this matches on the
 * NUMBER, never on a filename — and it fails the build when it finds nothing to patch, because the
 * failure it is guarding against is exactly the silent kind that started this.
 */
const FA_IR_PERCENTAGE = /("fa-IR":\s*)84(?![0-9])/;
const REQUIRED_THRESHOLD = 85;

function excalidrawPersian(): Plugin {
  let patched = 0;

  const patch = (code: string): string | null =>
    FA_IR_PERCENTAGE.test(code) ? code.replace(FA_IR_PERCENTAGE, `$1${REQUIRED_THRESHOLD}`) : null;

  return {
    name: "excalidraw-enable-persian",
    enforce: "pre",

    // `vite dev` pre-bundles dependencies with esbuild, and Rollup's `transform` below never sees
    // them. Without this hook the fix would work in production and not while developing it.
    config: () => ({
      optimizeDeps: {
        esbuildOptions: {
          plugins: [
            {
              name: "excalidraw-enable-persian-predep",
              setup(build) {
                build.onLoad({ filter: /@excalidraw[\\/]excalidraw[\\/]dist[\\/].*\.js$/ }, async (args) => {
                  const contents = patch(await readFile(args.path, "utf8"));
                  if (contents === null) return null;
                  patched += 1;
                  return { contents, loader: "js" as const };
                });
              },
            },
          ],
        },
      },
    }),

    // `vite build` goes through Rollup, where node_modules IS transformed.
    transform(code, id) {
      if (!id.includes("@excalidraw")) return null;
      const next = patch(code);
      if (next === null) return null;
      patched += 1;
      return { code: next, map: null };
    },

    buildEnd(error) {
      if (error) return;
      if (patched === 0) {
        this.error(
          'excalidraw-enable-persian: could not find `"fa-IR": 84` in @excalidraw/excalidraw. ' +
            "Excalidraw probably changed how it stores translation completeness. Until this is " +
            "fixed the whiteboard silently falls back to ENGLISH, so the build stops here rather " +
            "than shipping that quietly. See docs/superpowers/specs/2026-08-20-room-files-and-persian-whiteboard.md",
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [excalidrawPersian(), react()],
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
