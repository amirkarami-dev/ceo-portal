import path from "node:path";
import fs from "node:fs";
import { readJson } from "./paths.mjs";

/**
 * Persist workflow runs so they outlive the temp directory.
 *
 * The flow metadata (phases, labels, timings, token counts) exists in ONE place: `.output` files
 * under %TEMP%. The durable journals in ~/.claude carry results but no phases or timings, so once
 * temp is cleared that history is gone and nothing announces it — the Flow panel would just quietly
 * shrink. Same failure shape as the MunSanandaj run that failed leaving no evidence
 * (docs/ai/GOTCHAS.md), and the same answer: write it down, and say what you did.
 *
 * Merge rule: union by taskId, and a freshly-read run replaces a stored one (it may have completed
 * since). Stored runs are never deleted just because their source file is gone — that is the point.
 */

const STORE = "workflows.json";

export function mergeWorkflows(dataDir, freshRuns) {
  const file = path.join(dataDir, STORE);
  const previous = readJson(file);
  const stored = Array.isArray(previous?.runs) ? previous.runs : [];

  const byId = new Map(stored.map((r) => [r.taskId, r]));
  const before = byId.size;

  let updated = 0;
  let added = 0;
  for (const run of freshRuns) {
    if (byId.has(run.taskId)) updated++; else added++;
    byId.set(run.taskId, run);
  }

  const runs = [...byId.values()].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  // Runs we hold that the filesystem no longer offers — i.e. temp has been cleared for them.
  const freshIds = new Set(freshRuns.map((r) => r.taskId));
  const recoveredFromStore = stored.filter((r) => !freshIds.has(r.taskId)).length;

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), runs }, null, 2) + "\n",
    "utf8",
  );

  return { file, added, updated, recoveredFromStore, storedBefore: before, storedAfter: runs.length };
}

export function loadStoredWorkflows(dataDir) {
  const doc = readJson(path.join(dataDir, STORE));
  return Array.isArray(doc?.runs) ? doc.runs : [];
}
