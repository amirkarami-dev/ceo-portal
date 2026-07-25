# AI context structure: docs/ai + worklog + project skills

- **Date:** 2026-07-23
- **Area:** infra / documentation
- **Branch / commits:** `main` — this commit
- **Status:** shipped (documentation only, nothing deployed)

## Goal
Keep the knowledge of a long session so a **new chat** can continue without forgetting; give any
AI a single guideline for loading this project's structure and context; and require a markdown
record after every task. Create skills if useful.

## What changed
- `docs/ai/START-HERE.md` — the entry point for any assistant: read order, working rules, the
  required output, and the one line to paste when opening a new chat.
- `docs/ai/PROJECT-MAP.md` — live systems and hosts, backend layering, feature areas, the welfare
  service in detail, shared SPA conventions.
- `docs/ai/GOTCHAS.md` — the traps from this session, each as symptom → real cause → fix → where.
  Opens with "the error message is not evidence", because three separate bugs reported the wrong
  cause.
- `docs/ai/OPERATIONS.md` — build/deploy/verify runbook: server path, one-service-at-a-time rule,
  .NET builds in the SDK container, how to prove a change is really in the served bundle. Names
  of configuration variables only, **no values**.
- `docs/worklog/` — `README.md` (the rule + index), `TEMPLATE.md`, and records for this session's
  three big pieces: welfare service, analytics retarget, Iran Kish payments.
- `.claude/skills/project-context/SKILL.md` — loads the context in the right order.
- `.claude/skills/task-worklog/SKILL.md` — writes the record and propagates reusable lessons.
- `CLAUDE.md` and `AGENTS.md` — both now open with "load the context" and the after-each-task rule,
  so Claude Code and Codex pick it up automatically.

## Decisions
- **`docs/ai/` separate from `plan_development/`.** `plan_development/` is a reusable blueprint
  for scaffolding a *new* app; `docs/ai/` is the living context of *this* one. Mixing them would
  make both harder to trust.
- **Worklog per task, not one growing changelog.** Small files are cheap to write honestly and
  cheap to skim later; a single file would rot.
- **Root cause is a required section.** The expensive part of this session was not writing code,
  it was finding why a symptom lied. That is the knowledge worth persisting.
- **Both `CLAUDE.md` and `AGENTS.md` updated**, so the rule is vendor-neutral.
- **No secrets in docs** — variable names only. The runbook is useless to an attacker.

## Verification
- Documentation only; nothing built or deployed. Links between the new files were written to
  match the actual paths created in this commit.
- **Not verified:** how a future session actually behaves with these files — that shows up the
  next time a new chat is opened.

## Follow-ups
- On the next new chat, open with `Read docs/ai/START-HERE.md and follow it.` and see whether the
  context lands. Tighten `START-HERE.md` if anything important is missed.
- Older work (SSO cutover, CMS, municipality) has no worklog entries — add them lazily, only when
  those areas are next touched.
