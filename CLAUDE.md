# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) — it is the single source of truth** for this repo's commands,
architecture, local development setup, gotchas, and deployment rules. This file only adds the
Claude‑specific bits; everything else lives there, so edit `AGENTS.md`, not this file.

## Load the context before you write code

Follow [`docs/ai/START-HERE.md`](docs/ai/START-HERE.md): the project map, the gotchas (**in full**),
recent worklog entries, then `AGENTS.md`, then `docs/ai/OPERATIONS.md` if you will build or deploy.

Two project skills automate this:

- **`project-context`** — load the map, gotchas and recent worklog at the start of a session or
  before any non-trivial change.
- **`task-worklog`** — write the required work record when a task is done.

## The one hard rule

**A task is not finished until `docs/worklog/YYYY-MM-DD-<slug>.md` exists**, is listed in
[`docs/worklog/README.md`](docs/worklog/README.md), and any reusable lesson has been propagated to
`GOTCHAS.md` / `PROJECT-MAP.md` / `OPERATIONS.md`. Use the `task-worklog` skill.
