# <Task title>

- **Date:** YYYY-MM-DD
- **Area:** <welfare | analytics | auth | cms | web | mobile | infra>
- **Branch / commits:** `<branch>` — `<sha>`, `<sha>`
- **Status:** shipped to production | merged, not deployed | in progress | abandoned

## Goal
What was asked, in one or two sentences. Use the user's own words where possible.

## What changed
- `path/to/file` — what and why (one line each).
- Keep it to the files that matter; skip noise.

## Root cause (only if this was a bug)
What actually broke, and why the symptom pointed elsewhere. Be specific — this is the part
that saves the next session hours. If it is reusable, also add it to `docs/ai/GOTCHAS.md`.

## Decisions
Choices a future reader would otherwise re-litigate, with the reason.
Example: "chose antd-jalali over a custom picker because it matches AntD's RTL panel exactly".

## Verification
How it was proven: build/lint/test output, the check run against the live service, the DB row,
the log line. Say plainly what was **not** verified.

## Follow-ups
- Anything deliberately left undone, with enough context to pick it up.
