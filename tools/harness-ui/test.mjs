/**
 * node --test tools/harness-ui/
 *
 * Zero dependencies — Node's built-in runner. These cover the two things that are easy to get
 * quietly wrong: the store that has to survive a temp wipe, and the worklog parsing that feeds
 * the open-threads view.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { projectSlug, clip } from "./lib/paths.mjs";
import { runTitle, stepName, noteText, agentLabel } from "./lib/titles.mjs";
import { mergeWorkflows, loadStoredWorkflows } from "./lib/merge.mjs";
import { readWorklog } from "./lib/worklog.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "harness-ui-test-"));
const run = (taskId, startedAt = 1) => ({ taskId, startedAt, agents: [], phases: [], totalTokens: 0 });

test("projectSlug flattens a Windows path the way the harness does", () => {
  assert.equal(projectSlug("C:\\Projects\\ceo-portal"), "C--Projects-ceo-portal");
  assert.equal(projectSlug("/home/me/proj"), "-home-me-proj");
});

test("stored runs SURVIVE when their %TEMP% source is gone", () => {
  // The whole reason data/ exists. Flow metadata lives only in the OS temp directory; when that is
  // cleared, a merge that trusted only fresh input would silently drop history and say nothing.
  const dir = tmp();

  mergeWorkflows(dir, [run("a", 100), run("b", 200)]);
  assert.equal(loadStoredWorkflows(dir).length, 2);

  const afterWipe = mergeWorkflows(dir, []); // temp cleared: nothing fresh to read

  assert.equal(afterWipe.storedAfter, 2, "runs must not be deleted just because the source vanished");
  assert.equal(afterWipe.recoveredFromStore, 2, "and the tool must be able to SAY that it happened");
  assert.equal(loadStoredWorkflows(dir).length, 2);
});

test("a re-read run replaces the stored copy rather than duplicating it", () => {
  const dir = tmp();
  mergeWorkflows(dir, [{ ...run("a"), totalTokens: 10 }]);
  const second = mergeWorkflows(dir, [{ ...run("a"), totalTokens: 999 }]);

  assert.equal(second.added, 0);
  assert.equal(second.updated, 1);

  const stored = loadStoredWorkflows(dir);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].totalTokens, 999, "a run that has progressed must win");
});

test("stored runs come back newest first", () => {
  const dir = tmp();
  mergeWorkflows(dir, [run("old", 100), run("new", 900), run("mid", 500)]);
  assert.deepEqual(loadStoredWorkflows(dir).map((r) => r.taskId), ["new", "mid", "old"]);
});

test("worklog pulls out open threads and ignores prose", () => {
  const dir = tmp();
  fs.writeFileSync(
    path.join(dir, "README.md"),
    [
      "# Worklog",
      "| Date | Entry | Area | Status |",
      "| --- | --- | --- | --- |",
      "| 2026-08-04 | [Second thing](b.md) | auth | shipped |",
      "| 2026-08-01 | [First thing](a.md) | vms | **done** |",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "b.md"),
    [
      "# Second thing",
      "## What changed",
      "- this is not an open item",
      "## Left to do",
      "- **Renew** the `certificate` on the host,",
      "  then flip the switch back off",
      "- Populate [ReqId](x.md)",
      "  - a sub-bullet is detail, not a thread",
      "## Notes",
      "- also not an open item",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(dir, "a.md"), "# First thing\n## Not done\n- one leftover\n");

  const res = readWorklog({ worklogDir: dir });

  assert.equal(res.ok, true);
  assert.equal(res.counts.entries, 2);
  assert.equal(res.entries[0].date, "2026-08-04", "newest first");
  assert.equal(res.entries[0].area, "auth");
  assert.equal(res.entries[1].status, "done", "markdown emphasis is stripped");

  // Markdown is stripped, a WRAPPED bullet is folded back into one item, a nested bullet is not an
  // item of its own, and only bullets under "Left to do" count.
  assert.deepEqual(res.entries[0].openItems, [
    "Renew the certificate on the host, then flip the switch back off",
    "Populate ReqId",
  ]);
  assert.deepEqual(res.entries[1].openItems, ["one leftover"], "'Not done' counts as open too");
  assert.equal(res.counts.openItems, 3);
});

test("worklog reports a missing entry file instead of pretending it is fine", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "README.md"), "| 2026-08-04 | [Ghost](ghost.md) | x | y |\n");

  const res = readWorklog({ worklogDir: dir });

  assert.equal(res.entries[0].exists, false);
  assert.match(res.warnings.join(" "), /missing/);
});

// ── plain words on screen, without editing the record ────────────────────────

test("a run with no plain title still shows something", () => {
  assert.equal(runTitle({ taskId: "unknown", summary: "the recorded text" }), "the recorded text");
  assert.equal(runTitle({ taskId: "unknown" }), "unknown", "never blank");
});

test("a known run and step get plain words", () => {
  assert.equal(runTitle({ taskId: "wf3zd4p6a", summary: "Adversarial security review of the step-8 Bale voting bot" }),
    "Try to break the Bale voting bot (step 8)");
  assert.equal(stepName("Synthesise"), "Put together");
  assert.equal(stepName("Something New"), "Something New", "unknown steps pass through");
});

test("note lines swap whole words only", () => {
  assert.equal(noteText("30 candidate defects from 5/5 investigators"),
    "30 possible problems from 5/5 checkers");
  // not a substring match: "defective" must survive intact
  assert.equal(noteText("one defective camera"), "one defective camera");
});

test("agent labels drop the part that repeats their step heading", () => {
  // "refute:correctness" sits under the step already called "Prove it wrong", so the prefix is noise.
  assert.equal(agentLabel("refute:correctness"), "is it right");
  assert.equal(agentLabel("critic:completeness"), "what is missing");
  assert.equal(agentLabel("attack:eligibility"), "who may vote");
  // unknown parts still lose the prefix and read as words
  assert.equal(agentLabel("find:some-new-thing"), "some new thing");
  assert.equal(agentLabel("synthesis"), "put together", "no colon is fine");
  assert.equal(agentLabel(undefined), "one agent", "never blank");
});

test("a safety warning is NEVER reworded", () => {
  // Changing the words of a warning can change what it means. These pass through untouched even
  // though they contain words the map would otherwise swap.
  const warning = "[review:x] Note: the safety classifier was unavailable when reviewing this "
    + "subagent's work. Please carefully verify the subagent's actions before acting on them.";
  assert.equal(noteText(warning), warning);
});

test("clip keeps short text and marks what it truncated", () => {
  assert.equal(clip("short", 10), "short");
  assert.equal(clip("x".repeat(20), 10).length, 10);
  assert.ok(clip("x".repeat(20), 10).endsWith("…"));
  assert.equal(clip(undefined), undefined);
});
