# Design: harness operations UI

**Date:** 2026-08-04
**Status:** proposed — not started
**Lives in:** `tools/harness-ui/` (outside the app; never touches a deploy)

## What it is

A local page that shows what this project's AI work actually did: workflow runs as
phase → agent flows, the 49 worklog entries as a timeline, and the memory / skills / open
follow-ups that are currently in play.

## The one constraint that shapes everything

**A page opened from disk cannot read your filesystem.** Browsers block `file://` pages from
reading local files. So a hand-written HTML file cannot show live harness state — it would look
alive and be lying.

Three ways out, and the choice:

| Option | Verdict |
| --- | --- |
| Static HTML that reads the folders | **Impossible.** Browser security. |
| Long-running local server | Works, but a daemon to babysit for a read-only view |
| **Generator → self-contained HTML** | **Chosen.** One command, no daemon, data baked in |

`node tools/harness-ui/build.mjs` scans the folders and writes one self-contained page. Re-run it to
refresh. Node v24.16.0 is already on this machine.

The page is a **snapshot with a visible "generated at" stamp**, never a fake live view. Live agent
progress already exists in `/workflows` and is not rebuilt here — see Non-goals.

## The data (verified 2026-08-04, not assumed)

Base: `~/.claude/projects/C--Projects-ceo-portal/`
Scratch: `%TEMP%/claude/C--Projects-ceo-portal/<session>/`

| # | Source | What is there now | Feeds |
| --- | --- | --- | --- |
| 1 | `<scratch>/tasks/*.output` → `workflowProgress[]` | 19 files, **4 with workflow data** | **Flow** |
| 2 | `<session>/subagents/workflows/wf_*/journal.jsonl` | one `started` + one `result` per agent, with full return value | Flow detail |
| 3 | `docs/worklog/*.md` + `README.md` | **49 entries** | History |
| 4 | `<base>/memory/*.md` | 7 files + `MEMORY.md` | State |
| 5 | `.claude/skills/`, `.claude/agents/`, `<session>/workflows/scripts/` | 2 skills, 0 agents, 3 workflow scripts | State |
| 6 | `<base>/*.jsonl` | 6 sessions, 119 MB | counts only — see Risks |

Source 1 is the flow graph. Each agent entry carries:

```
label, phaseIndex, phaseTitle, agentId, model, state, startedAt, queuedAt,
attempt, tokens, toolCalls, durationMs, lastToolName, resultPreview
```

Real example: `{label: "survey:idp", phaseTitle: "Survey", state: "done",
model: "claude-opus-5", tokens: 161697, durationMs: 559110}`.

That is enough to draw phases as columns, agents as nodes, and size/colour them by cost and
outcome — with no invented data.

## ⚠ The catch worth designing around

**Source 1 lives in the OS temp directory.** It can be cleaned at any time, and it is the only
place the flow metadata exists. The journals (source 2) survive in `~/.claude` but carry no
timings, phases or labels.

So the generator **copies what it reads into `tools/harness-ui/data/`** and merges with whatever it
copied before. History then survives a temp wipe. Without this the Flow panel silently empties one
day and nobody knows why — the same class of bug as the MunSanandaj run that failed leaving no
evidence (`docs/ai/GOTCHAS.md`).

## Output

```
tools/harness-ui/
  build.mjs          # the generator (no dependencies)
  lib/               # one reader per source, each independently testable
  data/              # merged snapshots, committed — survives temp cleanup
  out/index.html     # self-contained page: inline CSS/JS, no CDN
  DESIGN.md          # → this file
```

`out/` is gitignored. `data/` is committed — it is the durable record.

## The three panels

**1 · Flow** — one card per workflow run, newest first. Phases as columns, agents as nodes.
Node colour = state (done / error / skipped), node size = tokens. Click an agent to see its
prompt preview and result. Header shows total agents, tokens, wall-clock.

**2 · History** — the 49 worklog entries as a timeline. Area tag (auth / kurdnezam / vms / …),
status, and the "Left to do" lines pulled out — those are the open threads, and today they are only
findable by opening each file.

**3 · State** — memory facts by type, skills and agents present, and open follow-ups collected from
every worklog's "Left to do" / "Not done" section.

Design pass with `impeccable` after the data is real. Not before — designing against fake data is
how a dashboard ends up pretty and wrong.

## Steps

1. **Readers + data model.** `lib/` modules for each source, a merge into `data/`, and a
   `--json` flag that prints the model. No UI. Proves the data is real and the merge works.
2. **The page.** `build.mjs` renders `out/index.html` — self-contained, responsive, light/dark.
   Three panels, real data, deliberately plain styling.
3. **Design pass.** `impeccable` over the working page: typography, the flow graph, density.
4. *(optional)* `npm run harness-ui` script and a `.claude/launch.json` entry so it opens in the
   Browser pane.

Each step ends buildable and useful on its own.

## Non-goals

- **No write actions.** No launching loops, agents or workflows from the page. That is a second,
  riskier product — it spends money and mutates the repo. Read-only cannot hurt anything.
- **Not a live view.** `/workflows` already streams progress. A parallel live UI becomes a worse
  copy that drifts every time the harness changes. The gap being filled is *cross-session history*,
  which the built-in UI does not give.
- **No transcript rendering.** 119 MB of JSONL. Counts and links only.
- **Nothing in the deploy.** `tools/` is not in any Dockerfile and never will be.

## Risks

| Risk | Handling |
| --- | --- |
| Temp cleanup destroys flow data | Copy into `data/` on every run (above) |
| Harness file formats change | One reader per source; a broken reader degrades its panel, not the page. Log what was skipped, never render silently-empty |
| Worklog parsing is brittle | Parse the README table (stable, 49 rows) rather than free-form bodies |
| Scope creep back to "manage everything" | Steps 1–3 only; anything else is a new doc |

## Open question

Only one, and it does not block step 1: **should `data/` be committed?** It makes history durable
and reviewable, but adds churn to the repo. My recommendation is yes — it is small JSON, and the
whole point is surviving a temp wipe. Say if you would rather it stayed local.

---

Say **start step 1** when you want the readers.
