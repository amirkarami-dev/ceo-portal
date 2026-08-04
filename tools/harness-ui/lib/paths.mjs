import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Where the harness keeps this project's state.
 *
 * Two roots, and the difference between them is the whole reason this tool exists:
 *
 * - `base`    ~/.claude/projects/<slug>/ — durable. Transcripts, memory, workflow journals.
 * - `scratch` %TEMP%/claude/<slug>/      — VOLATILE. The OS may clear it at any time, and it is
 *                                          the only place workflow phase/timing metadata lives.
 *
 * Anything read from `scratch` must be copied into `data/` or it is one cleanup away from gone.
 */

/** The harness turns an absolute project path into a folder name by flattening `:`, `\` and `/`. */
export function projectSlug(projectRoot) {
  return projectRoot.replace(/[:\\/]/g, "-");
}

export function resolvePaths(projectRoot = process.cwd()) {
  const slug = projectSlug(projectRoot);
  const base = path.join(os.homedir(), ".claude", "projects", slug);
  const scratch = path.join(os.tmpdir(), "claude", slug);

  return {
    projectRoot,
    slug,
    base,
    scratch,
    memoryDir: path.join(base, "memory"),
    worklogDir: path.join(projectRoot, "docs", "worklog"),
    claudeDir: path.join(projectRoot, ".claude"),
    outDir: path.join(projectRoot, "tools", "harness-ui", "out"),
    dataDir: path.join(projectRoot, "tools", "harness-ui", "data"),
  };
}

export const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

/** Directory entries, or [] — a missing folder is a normal state here, not an error. */
export function listDir(dir, { dirsOnly = false, filesOnly = false } = {}) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => (dirsOnly ? e.isDirectory() : filesOnly ? e.isFile() : true))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

export function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

/** Parse a .jsonl file leniently: a truncated final line is expected, not a failure. */
export function readJsonl(file) {
  const text = readText(file);
  if (text === null) return [];
  const out = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* truncated or partial write */ }
  }
  return out;
}

/** Keep `data/` small: previews are for orientation, the full text lives in the journals. */
export function clip(s, n = 600) {
  if (typeof s !== "string") return undefined;
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
