#!/usr/bin/env node
/**
 * Dev server for the harness UI.
 *
 *   node --watch tools/harness-ui/serve.mjs [--port 4173]
 *
 * Re-reads the harness folders and re-renders on EVERY request, so the page is never stale relative
 * to what the harness has actually done — something a file:// snapshot cannot promise.
 *
 * ⚠ That covers the DATA, not this tool's own code. ES modules are cached per process, so editing
 * `lib/render.mjs` and refreshing shows the old page — the first version of this file claimed
 * otherwise and was wrong. Run it under Node's built-in `--watch` (as `.claude/launch.json` does)
 * and the process restarts itself when any file it imported changes.
 *
 * Node's built-in http only. This tool has no dependencies and is not part of the app.
 *
 * Read-only by design: it serves GET, binds to loopback, and there is no route that mutates
 * anything. Launching agents or loops from a web page is a different product with real risk
 * (it spends money and edits the repo) — see the Non-goals in the design doc.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, writePage } from "./build.mjs";
import { renderPage } from "./lib/render.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PORT = Number(arg("--port", process.env.HARNESS_UI_PORT ?? 4173));

/** A failure has to be visible in the browser, not just the terminal. */
const errorPage = (err) => `<!doctype html><meta charset="utf-8">
<title>harness — build failed</title>
<body style="font:14px ui-monospace,monospace;padding:28px;background:#1d1f23;color:#e8e8e6">
<h1 style="font-size:16px;color:#e2807d">Build failed</h1>
<pre style="white-space:pre-wrap;line-height:1.5">${String(err?.stack ?? err)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
<p style="color:#9a9a95">Fix it and refresh — the model is rebuilt on every request.</p>`;

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" }).end("read-only");
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const started = Date.now();

  try {
    const model = collect(root);

    if (url.pathname === "/model.json") {
      const body = JSON.stringify(model, null, 2);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }

    // Any other path renders the page: this is a single-page tool, and a 404 for a stray path
    // would just look broken.
    const html = renderPage(model);
    if (url.searchParams.has("write")) writePage(model, root);

    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : html);

    const failed = model.sources.filter((s) => !s.ok).length;
    console.log(
      `  ${new Date().toISOString().slice(11, 19)}  ${url.pathname}  ${Date.now() - started}ms  `
      + `${model.workflows.length} runs · ${model.worklog.length} entries`
      + (failed ? `  ⚠ ${failed} source(s) failed` : ""),
    );
  } catch (err) {
    console.error("  build failed:", err);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(errorPage(err));
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`  port ${PORT} is already in use — pass --port <n> to pick another.`);
    process.exit(1);
  }
  throw err;
});

// Loopback only. Nothing here should be reachable from the network.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`harness-ui  http://localhost:${PORT}`);
  console.log(`            /model.json for the raw model, ?write to also update out/index.html`);
  console.log(`            rebuilds on every request — just refresh\n`);
});
