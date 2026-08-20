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

/**
 * The toolbar labels fa-IR ships EMPTY, and what they should say.
 *
 * That missing 16% is not missing KEYS — it is keys present with `""`, and Excalidraw falls back to
 * English one empty string at a time. In the toolbar it left «ابزارهای بیشتر» opening a menu of four
 * English labels sitting among Persian ones.
 *
 * «Mermaid to Excalidraw» is deliberately not translated word for word. `Mermaid` stays, because it
 * names a syntax the person has to type and translating it would hide what the feature wants.
 * `Excalidraw` goes, because this product does not tell its users which drawing library it embeds —
 * the same reason the board's menu drops Excalidraw's GitHub and Discord links.
 */
const TOOLBAR_LABELS: Readonly<Record<string, string>> = {
  frame: "ابزار قاب",
  embeddable: "جاسازی وب",
  laser: "اشاره‌گر لیزری",
  mermaidToExcalidraw: "تبدیل Mermaid به نمودار",
};

/**
 * Only the Persian locale, and only its toolbar group.
 *
 * Both bounds are load-bearing.
 *
 * EVERY locale file carries these same keys, so matching on the key alone would write Persian into
 * the Arabic translation. Hence the path test.
 *
 * And inside fa-IR, `frame:""` and `embeddable:""` each occur TWICE — once in the toolbar, once
 * under `libraryElementTypeError`, where they mean "a frame cannot be added to the library". Writing
 * «ابزار قاب» there would put a wrong sentence inside a real error message. Hence the group test.
 *
 * `extraTools` is the anchor because it is the one key unique to that object, and the object holds
 * nothing but `key:"string"` pairs — so `[^{}]*` cannot run past its own closing brace.
 */
const PERSIAN_LOCALE = /[\\/]locales[\\/]fa-IR/;
const TOOLBAR_GROUP = /\{[^{}]*extraTools\s*:[^{}]*\}/;

function excalidrawPersian(): Plugin {
  let patched = 0;
  let groupSeen = false;
  const filled = new Set<string>();
  const alreadyTranslated = new Set<string>();
  const vanished = new Set<string>();

  /**
   * Fills the empty toolbar strings, inside the toolbar group of the Persian locale only.
   *
   * TWO escaping traps live in these three lines. Both were written here first and found by RUNNING
   * the matcher against the real files, not by reading it:
   *
   * 1. A regex built from a plain template literal loses its backslashes. `\b` is the backspace
   *    escape, and `\s` is not an escape at all, so it collapses to a bare `s` — a pattern matching
   *    the letter s. Both fail silently and match nothing at all. `String.raw` is what keeps the
   *    backslash, and it is why these use it while `TOOLBAR_GROUP` above, a regex LITERAL, does not.
   *
   * 2. The whitespace is load-bearing. Excalidraw ships the SAME locale twice — minified as
   *    `frame:""` under `dist/prod`, pretty-printed as `frame: ""` under `dist/dev`. A pattern
   *    without `\s*` matches production and silently misses the dev server, so the fix looks correct
   *    when built and broken while being developed.
   *
   * The key is anchored on a leading `[{,]` rather than a word boundary, which also stops `frame`
   * matching inside `magicframe` — a neighbouring key that must stay empty.
   */
  const fillLabels = (code: string, id: string): string | null => {
    if (!PERSIAN_LOCALE.test(id)) return null;

    const group = TOOLBAR_GROUP.exec(code);
    if (group === null) return null;

    groupSeen = true;
    let next = group[0];

    for (const [key, persian] of Object.entries(TOOLBAR_LABELS)) {
      const empty = new RegExp(String.raw`([{,])(\s*)${key}\s*:\s*""`);

      if (empty.test(next)) {
        next = next.replace(empty, `$1$2${key}: ${JSON.stringify(persian)}`);
        filled.add(key);
      } else if (new RegExp(String.raw`([{,])\s*${key}\s*:\s*"`).test(next)) {
        // Upstream has translated it since. Leave theirs — a translator beats us.
        alreadyTranslated.add(key);
      } else {
        vanished.add(key);
      }
    }

    return next === group[0] ? null : code.replace(group[0], next);
  };

  const patch = (code: string, id: string): string | null => {
    const percentage = FA_IR_PERCENTAGE.test(code)
      ? code.replace(FA_IR_PERCENTAGE, `$1${REQUIRED_THRESHOLD}`)
      : null;

    // Both patches can apply to one file, so the second reads whatever the first produced.
    const labels = fillLabels(percentage ?? code, id);

    return labels ?? percentage;
  };

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
                  const contents = patch(await readFile(args.path, "utf8"), args.path);
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
      const next = patch(code, id);
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

      // Every failure below is one that would otherwise ship quietly as English, which is the whole
      // reason this plugin exists — so they stop the build rather than print something nobody reads.
      if (!groupSeen) {
        this.error(
          "excalidraw-enable-persian: never saw the Persian locale's toolbar group (an object " +
            "containing `extraTools:`). Excalidraw has changed how it ships locales, so the four " +
            "toolbar labels would silently be English again.",
        );
      }

      if (vanished.size > 0) {
        this.error(
          `excalidraw-enable-persian: these toolbar keys no longer exist: ${Array.from(vanished).join(", ")}. ` +
            "They were renamed or removed upstream, so translating them does nothing.",
        );
      }

      if (filled.size === 0 && alreadyTranslated.size === 0) {
        this.error(
          "excalidraw-enable-persian: the toolbar group was found but not one label was filled. " +
            "The key-matching regex is wrong — see the note on backspace-in-template-literals above.",
        );
      }

      if (alreadyTranslated.size > 0) {
        this.warn(
          `excalidraw-enable-persian: upstream now translates ${Array.from(alreadyTranslated).join(", ")}. ` +
            "Theirs is used, ours ignored — drop these from TOOLBAR_LABELS.",
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
