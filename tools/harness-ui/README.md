# harness-ui

Reads what this project's AI sessions actually did — workflow runs, the worklog, memory, skills —
and renders one self-contained page.

Design: [`docs/design/2026-08-04-harness-ui.md`](../../docs/design/2026-08-04-harness-ui.md)

Nothing here is part of the app. `tools/` is in no Dockerfile and never reaches a deploy.

## Running it

```bash
node tools/harness-ui/build.mjs           # read, merge into data/, write out/index.html
node tools/harness-ui/build.mjs --json    # the whole model on stdout
node --test tools/harness-ui/test.mjs     # 7 tests, no dependencies
```

## Developing on it

```bash
node --watch tools/harness-ui/serve.mjs   # http://localhost:4173
```

Or start it from the Browser pane — `.claude/launch.json` has a **harness-ui** entry that already
passes `--watch`.

- The **data** is re-read on every request. Refresh and you see the harness as it is now.
- The **code** is not, because ES modules are cached per process. `--watch` is what makes editing
  `lib/render.mjs` work; without it you will edit CSS, refresh, and see nothing change.
- `/model.json` serves the raw model. `?write` also updates `out/index.html`.
- GET only, bound to loopback. There is no route that mutates anything — see Non-goals in the
  design doc.

## Layout

| File | Job |
| --- | --- |
| `build.mjs` | orchestration + CLI. `collect()` builds the model, `writePage()` renders it |
| `lib/paths.mjs` | resolves the two roots, plus lenient file/JSONL readers |
| `lib/workflows.mjs` | `.output` files + workflow journals → runs, phases, agents |
| `lib/worklog.mjs` | `docs/worklog/README.md` → entries and their open threads |
| `lib/state.mjs` | memory, skills/agents/scripts, session sizes |
| `lib/merge.mjs` | the durable store — see below |
| `lib/render.mjs` | model → HTML. All the CSS lives here |
| `serve.mjs` | dev server |

### Adding a reader

Return `{ id, ok, warnings: [], counts: {}, ...payload }`, call it from `collect()` inside
`safely()`, and add a panel in `render.mjs`. `safely()` means a reader that throws marks its own
section `FAIL` and the others still work.

## Why `data/` is committed

Workflow phase, label and timing metadata exists in exactly one place: `.output` files under
`%TEMP%`. The durable journals in `~/.claude` keep results but carry no phases or timings, so once
the OS clears temp that history is gone.

So every run merges what it can read into `data/workflows.json`, never deletes a stored run because
its source vanished, and says so out loud when it serves from the store:

```
N run(s) came from data/ only — their %TEMP% source is gone. This is the store doing its job.
```

A panel that quietly empties is the exact failure this repo already paid for once
(`docs/ai/GOTCHAS.md`, the MunSanandaj run that failed leaving no evidence).

## Reading the summary

```
[ok  ] workflows  runs=7  agents=79  taskOutputs=41  nonWorkflowOutputs=34   (volatile source)
```

`nonWorkflowOutputs` is **not** an error. `tasks/` holds the output of every background task; a
plain Bash task writes raw stdout there. Those are counted, not warned about.

## Still to do

Step 3 is the design pass (`impeccable`). Deliberately not done yet — designing against data you
have not proven is how a dashboard ends up pretty and wrong.
