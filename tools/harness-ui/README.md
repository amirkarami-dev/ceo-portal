# harness-ui

Reads what this project's AI sessions actually did — workflow runs, the worklog, memory, skills —
and turns it into one data model. Step 2 will render it as a page; today it prints.

Design: [`docs/design/2026-08-04-harness-ui.md`](../../docs/design/2026-08-04-harness-ui.md)

```bash
node tools/harness-ui/build.mjs           # read, merge into data/, print a summary
node tools/harness-ui/build.mjs --json    # the whole model on stdout
node --test tools/harness-ui/test.mjs     # 7 tests, no dependencies
```

Nothing here is part of the app. `tools/` is in no Dockerfile and never reaches a deploy.

## Why `data/` is committed

The workflow flow metadata — phases, labels, timings, token counts — exists in exactly one place:
`.output` files under `%TEMP%`. The durable journals in `~/.claude` keep results but carry no
phases or timings, so once the OS clears temp that history is gone.

So every run merges what it can read into `data/workflows.json` and never deletes a stored run just
because its source vanished. When that happens the summary says so out loud:

```
N run(s) came from data/ only — their %TEMP% source is gone. This is the store doing its job.
```

A panel that quietly empties is the exact failure this repo already paid for once
(`docs/ai/GOTCHAS.md`, the MunSanandaj run that failed leaving no evidence).

## Reading the summary

```
[ok  ] workflows  runs=7  agents=79  taskOutputs=43  nonWorkflowOutputs=36   (volatile source)
```

`nonWorkflowOutputs` is **not** an error. `tasks/` holds the output of every background task; a
plain Bash task writes raw stdout there. Those are counted, not warned about.

Each source is read in isolation — a reader that throws marks its own section `FAIL` and the rest
still work.
