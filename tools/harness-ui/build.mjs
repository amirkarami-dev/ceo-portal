#!/usr/bin/env node
/**
 * Harness operations UI.
 *
 *   node tools/harness-ui/build.mjs           read, merge into data/, write out/index.html
 *   node tools/harness-ui/build.mjs --json    print the whole model to stdout
 *   node tools/harness-ui/build.mjs --quiet   no summary; exit code carries the outcome
 *   node tools/harness-ui/serve.mjs           dev server: rebuilds on every request
 *
 * Design rule taken from docs/design/2026-08-04-harness-ui.md: a broken reader degrades its own
 * section and nothing else, and whatever was skipped is SAID OUT LOUD. A silently empty panel is
 * the failure mode this whole tool exists to prevent.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { resolvePaths } from "./lib/paths.mjs";
import { renderPage } from "./lib/render.mjs";
import { readWorkflows } from "./lib/workflows.mjs";
import { readWorklog } from "./lib/worklog.mjs";
import { readMemory, readConfig, readSessions } from "./lib/state.mjs";
import { mergeWorkflows, loadStoredWorkflows } from "./lib/merge.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** Run one reader in isolation: a throw becomes a failed section, never a failed build. */
function safely(id, fn) {
  try {
    return fn();
  } catch (err) {
    return { id, ok: false, warnings: [`reader threw: ${err.message}`], counts: {}, error: String(err?.stack ?? err) };
  }
}

export function collect(root = projectRoot) {
  const paths = resolvePaths(root);

  const workflows = safely("workflows", () => readWorkflows(paths));
  const worklog = safely("worklog", () => readWorklog(paths));
  const memory = safely("memory", () => readMemory(paths));
  const config = safely("config", () => readConfig(paths));
  const sessions = safely("sessions", () => readSessions(paths));

  // Volatile data is written down before anything else looks at it.
  let merge = null;
  if (workflows.ok && Array.isArray(workflows.runs)) {
    merge = safely("merge", () => mergeWorkflows(paths.dataDir, workflows.runs));
    if (merge?.file) workflows.runs = loadStoredWorkflows(paths.dataDir);
    workflows.counts.runs = workflows.runs.length;
    if (merge?.recoveredFromStore > 0) {
      workflows.warnings.push(
        `${merge.recoveredFromStore} run(s) came from data/ only — their %TEMP% source is gone. This is the store doing its job.`,
      );
    }
  }

  const sources = [workflows, worklog, memory, config, sessions];

  return {
    generatedAt: new Date().toISOString(),
    project: { root, slug: paths.slug, base: paths.base, scratch: paths.scratch },
    sources: sources.map(({ id, ok, warnings, counts, volatile }) => ({ id, ok, warnings, counts, volatile: !!volatile })),
    merge,
    workflows: workflows.runs ?? [],
    worklog: worklog.entries ?? [],
    memory: memory.facts ?? [],
    config: { skills: config.skills ?? [], agents: config.agents ?? [], workflowScripts: config.workflowScripts ?? [] },
    sessions: sessions.sessions ?? [],
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

function report(model) {
  const { sources, merge } = model;
  console.log(`harness-ui — ${model.project.slug}`);
  console.log(`generated ${model.generatedAt}\n`);

  for (const s of sources) {
    const mark = s.ok ? "ok  " : "FAIL";
    const counts = Object.entries(s.counts).map(([key, v]) => `${key}=${key === "totalBytes" ? mb(v) : v}`).join("  ");
    console.log(`  [${mark}] ${s.id.padEnd(10)} ${counts}${s.volatile ? "   (volatile source)" : ""}`);
  }

  if (merge?.file) {
    console.log(`\n  data/workflows.json: +${merge.added} new, ${merge.updated} refreshed, ${merge.storedAfter} total`);
  }

  const warnings = sources.flatMap((s) => s.warnings.map((w) => [s.id, w]));
  if (warnings.length) {
    console.log("\n  warnings:");
    for (const [id, w] of warnings) console.log(`    ${id}: ${w}`);
  }

  const runs = model.workflows;
  if (runs.length) {
    console.log("\n  workflow runs (newest first):");
    for (const r of runs.slice(0, 8)) {
      const when = r.startedAt ? new Date(r.startedAt).toISOString().slice(0, 16).replace("T", " ") : "unknown";
      const phases = r.phases.map((p) => `${p.title}(${p.agentIndexes.length})`).join(" → ");
      console.log(`    ${when}  ${String(r.agents.length).padStart(2)} agents  ${k(r.totalTokens).padStart(5)} tok  ${phases}`);
    }
    if (runs.length > 8) console.log(`    … and ${runs.length - 8} more`);
  }

  const open = model.worklog.filter((e) => e.openItems.length);
  if (open.length) {
    console.log(`\n  open threads across ${open.length} worklog entr(ies):`);
    for (const e of open.slice(0, 5)) console.log(`    ${e.date}  ${e.title} — ${e.openItems.length} item(s)`);
    if (open.length > 5) console.log(`    … and ${open.length - 5} more`);
  }

  const failed = sources.filter((s) => !s.ok);
  console.log(failed.length ? `\n${failed.length} source(s) failed.` : "\nAll sources read.");
  return failed.length === 0;
}

/** Render the page and return where it landed. Exported so the dev server reuses one code path. */
export function writePage(model, root = projectRoot) {
  const { outDir } = resolvePaths(root);
  const html = renderPage(model);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "index.html");
  fs.writeFileSync(file, html, "utf8");
  return { file, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const argv = new Set(process.argv.slice(2));
  const model = collect();

  if (argv.has("--json")) {
    console.log(JSON.stringify(model, null, 2));
  } else {
    const page = writePage(model);
    if (!argv.has("--quiet")) {
      const ok = report(model);
      console.log(`\n  page: ${path.relative(projectRoot, page.file)} (${(page.bytes / 1024).toFixed(0)} KB)`);
      if (!ok) process.exitCode = 1;
    }
  }
}
