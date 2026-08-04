import path from "node:path";
import fs from "node:fs";
import { listDir, readText, exists, clip } from "./paths.mjs";

/**
 * Memory, project configuration and session totals — the State panel.
 *
 * All three are cheap directory reads, so they share a file. None of them is volatile: memory and
 * transcripts live under ~/.claude, skills and agents live in the repo.
 */

/** Minimal YAML frontmatter reader — the memory format is fixed and shallow, so a parser is overkill. */
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fields: {}, body: text };

  const fields = {};
  let section = null;
  for (const line of m[1].split("\n")) {
    const nested = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    const top = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);

    if (top) {
      section = top[2].trim() === "" ? top[1] : null;
      if (top[2].trim() !== "") fields[top[1]] = top[2].trim();
    } else if (nested && section) {
      fields[`${section}.${nested[1]}`] = nested[2].trim();
    }
  }
  return { fields, body: m[2] };
}

export function readMemory({ memoryDir }) {
  const warnings = [];
  if (!exists(memoryDir)) {
    return { id: "memory", ok: false, warnings: [`${memoryDir} not found`], counts: { facts: 0 }, facts: [] };
  }

  const facts = [];
  for (const name of listDir(memoryDir, { filesOnly: true })) {
    if (!name.endsWith(".md") || name === "MEMORY.md") continue;
    const text = readText(path.join(memoryDir, name));
    if (text === null) continue;

    const { fields, body } = frontmatter(text);
    facts.push({
      file: name,
      name: fields.name ?? name.replace(/\.md$/, ""),
      description: fields.description ?? "",
      type: fields["metadata.type"] ?? "unknown",
      // [[wiki-links]] are how memories reference each other; surfacing them makes the set navigable.
      links: [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((x) => x[1]),
      excerpt: clip(body.trim().replace(/\s+/g, " "), 240),
    });
  }

  const untyped = facts.filter((f) => f.type === "unknown").length;
  if (untyped > 0) warnings.push(`${untyped} memory file(s) have no metadata.type`);

  facts.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  const byType = {};
  for (const f of facts) byType[f.type] = (byType[f.type] ?? 0) + 1;

  return { id: "memory", ok: true, warnings, counts: { facts: facts.length, ...byType }, facts };
}

export function readConfig({ claudeDir, base }) {
  const warnings = [];

  const skills = listDir(path.join(claudeDir, "skills"), { dirsOnly: true });
  const agents = listDir(path.join(claudeDir, "agents"), { filesOnly: true })
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));

  // Workflow scripts are written per session, so collect across all of them and de-duplicate by
  // the human-readable prefix (the run id suffix differs every invocation).
  const scripts = new Map();
  for (const session of listDir(base, { dirsOnly: true })) {
    const dir = path.join(base, session, "workflows", "scripts");
    for (const f of listDir(dir, { filesOnly: true })) {
      if (!f.endsWith(".js")) continue;
      const name = f.replace(/-wf_[a-z0-9-]+\.js$/i, "").replace(/\.js$/, "");
      if (!scripts.has(name)) scripts.set(name, { name, file: f, session });
    }
  }

  if (skills.length === 0) warnings.push(`no project skills under ${path.join(claudeDir, "skills")}`);

  return {
    id: "config",
    ok: true,
    warnings,
    counts: { skills: skills.length, agents: agents.length, workflowScripts: scripts.size },
    skills,
    agents,
    workflowScripts: [...scripts.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function readSessions({ base }) {
  const warnings = [];
  if (!exists(base)) {
    return { id: "sessions", ok: false, warnings: [`${base} not found`], counts: { sessions: 0 }, sessions: [] };
  }

  const sessions = [];
  for (const name of listDir(base, { filesOnly: true })) {
    if (!name.endsWith(".jsonl")) continue;
    try {
      const st = fs.statSync(path.join(base, name));
      sessions.push({
        id: name.replace(/\.jsonl$/, ""),
        bytes: st.size,
        modifiedAt: st.mtimeMs,
      });
    } catch { /* raced with a write; skip */ }
  }

  sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

  return {
    id: "sessions",
    ok: true,
    warnings,
    // Transcripts are ~119 MB here. Counts and sizes only — never the contents.
    counts: { sessions: sessions.length, totalBytes: sessions.reduce((s, x) => s + x.bytes, 0) },
    sessions,
  };
}
