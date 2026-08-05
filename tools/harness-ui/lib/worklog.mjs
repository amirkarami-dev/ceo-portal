import path from "node:path";
import { readText, exists } from "./paths.mjs";

/**
 * The worklog — the History panel.
 *
 * The index table in `docs/worklog/README.md` is parsed rather than the entry bodies: it is one
 * stable shape maintained by a documented rule (CLAUDE.md), where the bodies are free-form prose.
 * Rows look like:
 *
 *   | 2026-08-04 | [Access step 2: …](2026-08-04-service-gating.md) | auth / admin-web | shipped |
 *
 * Each entry's "Left to do" / "Not done" section is then pulled out, because those are the open
 * threads of the whole project and today they are only findable by opening all 49 files.
 */

const ROW = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*\[(.+?)\]\((.+?)\)\s*\|(.*?)\|(.*?)\|\s*$/;

/** Headings that mean "unfinished work lives under here". */
const OPEN_HEADING = /^#{2,3}\s+(left to do|not done|remaining|todo|follow[- ]?ups?|what(?:'s| is) left|next steps)\b/i;

/** Bold, italic, code and links become plain text — these strings are read, not rendered. */
const stripMd = (s) =>
  s.replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+?)\*/g, "$1$2")
    .replace(/(^|\s)_([^_]+?)_(?=\s|$)/g, "$1$2")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((?:.+?)\)/g, "$1")
    .trim();

/**
 * Bullet lines under an "unfinished" heading, until the next heading.
 *
 * Two things this has to get right, both learned by reading the real files:
 *
 * - Only TOP-LEVEL bullets. Markdown nests with two or more spaces, and a sub-bullet is detail
 *   about the item above it — flattening them turns one thread into three.
 * - Bullets WRAP. Prose in these worklogs runs to ~100 columns, so most items span several lines;
 *   taking only the first line truncated them mid-sentence ("Renew the certificate …, then set").
 *   Continuation lines are folded back in.
 */
function openItems(markdown) {
  if (!markdown) return [];
  const items = [];
  let collecting = false;
  let current = null;

  const flush = () => {
    if (current) {
      const text = stripMd(current.replace(/\s+/g, " "));
      if (text) items.push(text);
    }
    current = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();

    if (/^#{1,6}\s/.test(line)) {
      flush();
      collecting = OPEN_HEADING.test(line);
      continue;
    }
    if (!collecting) continue;

    const bullet = line.match(/^( *)(?:[-*+]|\d+\.)\s+(.*)$/);

    if (bullet) {
      flush();
      // A nested bullet ends the current item and contributes nothing of its own.
      if (bullet[1].length <= 1) current = bullet[2];
      continue;
    }

    if (line.trim() === "") { flush(); continue; }        // blank line closes the item
    if (current !== null) current += " " + line.trim();   // wrapped continuation
  }

  flush();
  return items;
}

export function readWorklog({ worklogDir }) {
  const warnings = [];
  const indexFile = path.join(worklogDir, "README.md");

  if (!exists(indexFile)) {
    return { id: "worklog", ok: false, warnings: [`${indexFile} not found`], counts: { entries: 0 }, entries: [] };
  }

  const entries = [];
  let missingFiles = 0;

  for (const line of (readText(indexFile) ?? "").split("\n")) {
    const m = line.match(ROW);
    if (!m) continue;

    const [, date, title, file, area, status] = m;
    const full = path.join(worklogDir, file);
    const body = readText(full);
    if (body === null) missingFiles++;

    entries.push({
      date,
      title: stripMd(title),
      file: `docs/worklog/${file}`,
      area: stripMd(area),
      status: stripMd(status),
      exists: body !== null,
      openItems: openItems(body),
    });
  }

  if (entries.length === 0) warnings.push("index table parsed but matched no rows — has the table shape changed?");
  if (missingFiles > 0) warnings.push(`${missingFiles} entr(ies) are listed in README.md but the file is missing`);

  entries.sort((a, b) => b.date.localeCompare(a.date));

  return {
    id: "worklog",
    ok: true,
    warnings,
    counts: {
      entries: entries.length,
      withOpenItems: entries.filter((e) => e.openItems.length > 0).length,
      openItems: entries.reduce((s, e) => s + e.openItems.length, 0),
    },
    entries,
  };
}
