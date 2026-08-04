import path from "node:path";
import { listDir, readJson, readJsonl, clip, exists } from "./paths.mjs";

/**
 * Workflow runs — the Flow panel's data.
 *
 * Two sources that only make sense together:
 *
 * 1. `<scratch>/<session>/tasks/<taskId>.output` → `workflowProgress[]`
 *    label, phaseTitle, model, state, tokens, toolCalls, durationMs. This is the flow graph.
 *    It is in the OS temp directory and can vanish, which is why the caller merges it into `data/`.
 *
 * 2. `<base>/<session>/subagents/workflows/wf_<runId>/journal.jsonl`
 *    one `started` and one `result` line per agent, carrying the agent's actual return value.
 *    Durable, but has no phases, labels or timings — useless on its own for a flow view.
 *
 * They join on `agentId`.
 */

/** Every agent's return value in this session's workflow journals, keyed by agentId. */
function readJournalResults(sessionDir) {
  const results = new Map();
  const wfRoot = path.join(sessionDir, "subagents", "workflows");
  if (!exists(wfRoot)) return results;

  for (const runDir of listDir(wfRoot, { dirsOnly: true })) {
    const journal = path.join(wfRoot, runDir, "journal.jsonl");
    for (const entry of readJsonl(journal)) {
      if (entry.type !== "result" || !entry.agentId) continue;
      const value = entry.result;
      results.set(entry.agentId, {
        runDir,
        // Structured returns are objects; plain agents return a string. Normalise for display.
        preview: clip(typeof value === "string" ? value : JSON.stringify(value), 800),
        isStructured: value !== null && typeof value === "object",
      });
    }
  }
  return results;
}

function toAgent(entry, journal) {
  const j = journal.get(entry.agentId);
  return {
    index: entry.index,
    label: entry.label,
    phaseIndex: entry.phaseIndex ?? 0,
    phaseTitle: entry.phaseTitle ?? "(no phase)",
    agentId: entry.agentId,
    model: entry.model,
    state: entry.state,
    attempt: entry.attempt,
    startedAt: entry.startedAt,
    queuedAt: entry.queuedAt,
    durationMs: entry.durationMs,
    tokens: entry.tokens ?? 0,
    toolCalls: entry.toolCalls ?? 0,
    lastToolName: entry.lastToolName,
    promptPreview: clip(entry.promptPreview, 400),
    resultPreview: clip(entry.resultPreview, 400),
    journalRunDir: j?.runDir,
    returnedStructured: j?.isStructured,
    returnPreview: j?.preview,
  };
}

/**
 * Group agents into the phases the script declared, preserving declaration order.
 *
 * Phases reference agents by position, they do not contain them. Embedding the objects wrote every
 * agent to `data/` twice — it doubled the file — and left two copies that could drift apart. The
 * flat `agents` array is the single source; this is just an ordering over it.
 */
function toPhases(agents) {
  const byIndex = new Map();
  agents.forEach((a, i) => {
    const key = a.phaseIndex;
    if (!byIndex.has(key)) byIndex.set(key, { index: key, title: a.phaseTitle, agentIndexes: [] });
    byIndex.get(key).agentIndexes.push(i);
  });
  return [...byIndex.values()].sort((x, y) => x.index - y.index);
}

export function readWorkflows({ scratch, base }) {
  const warnings = [];
  const runs = [];

  const sessions = listDir(scratch, { dirsOnly: true });
  if (sessions.length === 0) {
    warnings.push(`no session folders under ${scratch} — nothing to read (temp may have been cleared)`);
  }

  // `tasks/` holds the output of every background task, not just workflows: a plain Bash task
  // writes its raw stdout there. Those are not JSON and never were — counting them as "corrupt"
  // would send someone hunting a bug that does not exist, so they are classified, not warned about.
  const seen = { total: 0, workflowRuns: 0, jsonNoWorkflow: 0, plainText: 0 };

  for (const session of sessions) {
    const tasksDir = path.join(scratch, session, "tasks");
    const journal = readJournalResults(path.join(base, session));

    for (const name of listDir(tasksDir, { filesOnly: true })) {
      if (!name.endsWith(".output")) continue;
      seen.total++;

      const doc = readJson(path.join(tasksDir, name));
      if (!doc) { seen.plainText++; continue; }
      if (!Array.isArray(doc.workflowProgress) || doc.workflowProgress.length === 0) {
        seen.jsonNoWorkflow++;
        continue;
      }

      const agents = doc.workflowProgress
        .filter((e) => e.type === "workflow_agent")
        .map((e) => toAgent(e, journal));
      if (agents.length === 0) continue;

      const times = agents.map((a) => a.startedAt).filter(Boolean);
      const ends = agents.map((a) => (a.startedAt ?? 0) + (a.durationMs ?? 0)).filter(Boolean);

      seen.workflowRuns++;
      runs.push({
        taskId: name.replace(/\.output$/, ""),
        session,
        summary: doc.summary ?? null,
        logs: Array.isArray(doc.logs) ? doc.logs.slice(0, 20) : [],
        agentCount: doc.agentCount ?? agents.length,
        totalTokens: doc.totalTokens ?? agents.reduce((s, a) => s + a.tokens, 0),
        totalToolCalls: doc.totalToolCalls ?? agents.reduce((s, a) => s + a.toolCalls, 0),
        startedAt: times.length ? Math.min(...times) : null,
        endedAt: ends.length ? Math.max(...ends) : null,
        phases: toPhases(agents),
        agents,
      });
    }
  }

  // Only genuinely surprising things are warnings. "A Bash task wrote plain text" is not one.
  if (seen.total > 0 && seen.workflowRuns === 0) {
    warnings.push(
      `${seen.total} task output(s) found but none were workflow runs `
      + `(${seen.plainText} plain-text, ${seen.jsonNoWorkflow} structured non-workflow)`,
    );
  }

  runs.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return {
    id: "workflows",
    ok: true,
    warnings,
    volatile: true, // read from %TEMP% — must be merged into data/ to survive
    counts: {
      runs: runs.length,
      agents: runs.reduce((s, r) => s + r.agents.length, 0),
      taskOutputs: seen.total,
      nonWorkflowOutputs: seen.plainText + seen.jsonNoWorkflow,
    },
    runs,
  };
}
