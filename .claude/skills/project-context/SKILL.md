---
name: project-context
description: Load this project's living context (map, gotchas, recent worklog) before implementing, debugging, or reviewing anything in this repo. Use at the start of a new session, when asked to "get the project structure/context", or before any non-trivial change.
---

# Load project context

Use this before writing code in this repo — especially in a fresh session, where none of the
previous conversation survives.

## Steps

1. **Read the entry point**: `docs/ai/START-HERE.md`. Follow its load order.
2. **Read the map**: `docs/ai/PROJECT-MAP.md` — which app owns the area you are about to touch,
   and where its code lives.
3. **Read the traps**: `docs/ai/GOTCHAS.md` — in full. Most long debugging sessions in this
   project ended in one of these. Skipping this step is the single most expensive mistake.
4. **Read recent history**: `docs/worklog/README.md`, then open the 2–3 records that touch your
   area. They carry the *why* behind decisions and any known follow-ups.
5. **Read the project instructions**: `CLAUDE.md` (or `AGENTS.md`) for commands, architecture
   and per-area conventions.
6. **Only if you will build or deploy**: `docs/ai/OPERATIONS.md`.

Then read the specific source files for the task.

## Say what you loaded

Before proposing changes, state briefly: the area you are working in, the gotchas that apply,
and any follow-up in the worklog that overlaps. If nothing applies, say that.

## Hard rules from the context

- Find the real cause from logs or the database before changing code — error text in this
  project has repeatedly pointed at the wrong thing.
- Surgical edits; match the file's existing style.
- Build, lint and test before claiming done. .NET builds run **on the server** (NuGet is blocked
  locally).
- Every page must work on a phone.
- Never commit secrets; reference variable names only.
- **Finish by writing the work record** — see the `task-worklog` skill.
