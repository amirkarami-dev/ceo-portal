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

const stripMd = (s) =>
  s.replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((?:.+?)\)/g, "$1")
    .trim();

/** Bullet lines under an "unfinished" heading, until the next heading. */
function openItems(markdown) {
  if (!markdown) return [];
  const items = [];
  let collecting = false;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();

    if (/^#{1,6}\s/.test(line)) {
      collecting = OPEN_HEADING.test(line);
      continue;
    }
    if (!collecting) continue;

    // Top-level bullets only. Markdown nests with two or more spaces, and a sub-bullet is detail
    // about the item above it — flattening them turns one thread into three.
    const bullet = line.match(/^( *)(?:[-*+]|\d+\.)\s+(.*)$/);
    if (bullet && bullet[1].length <= 1) {
      const text = stripMd(bullet[2]);
      if (text) items.push(text);
    }
  }
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
