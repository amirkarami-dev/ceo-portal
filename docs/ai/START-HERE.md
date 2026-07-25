# START HERE — context guide for any AI working on this repo

Read this file first. It tells you **what to read, in what order, before you write code**,
and **what you must produce when you finish**. It is written for any assistant
(Claude Code, Codex, Cursor, Copilot, …), not one vendor.

---

## 1. The 5-minute load order

| # | Read | Why |
|---|------|-----|
| 1 | **this file** | the rules of the road |
| 2 | [`PROJECT-MAP.md`](PROJECT-MAP.md) | what exists, which app owns what, live URLs |
| 3 | [`GOTCHAS.md`](GOTCHAS.md) | traps that already cost hours — **do not rediscover them** |
| 4 | [`../worklog/README.md`](../worklog/README.md) | what was done recently and why |
| 5 | `/CLAUDE.md` (or `/AGENTS.md`) | commands, architecture, per-area conventions |
| 6 | [`OPERATIONS.md`](OPERATIONS.md) | only when you need to build/deploy/verify on the server |

Then read the code you are about to change. Do not skip step 3 — most of the
long debugging sessions in this project ended in a one-line cause that is now listed there.

## 2. Rules for doing the work

1. **Find the real cause before changing code.** Error text in this project has lied more
   than once (a bank *decline* reported as "no connection"; a *login* failure that was really a
   SQL parameter bug). Read the server log or the DB row, then fix.
2. **Surgical changes.** Touch what the task needs. Do not reformat or "improve" nearby code.
   If you spot an unrelated problem, mention it — don't fix it silently.
3. **Match the surrounding style** — comment density, naming, and idiom of the file you edit.
4. **Comments explain WHY**, especially where a non-obvious workaround exists. Every entry in
   `GOTCHAS.md` should also have a short comment at the code site.
5. **Build and test before you claim done.** Frontend: `npm run build` + `npm run lint` +
   the test suite. Backend: NuGet is blocked on the dev machine — build/test **on the server**
   (see `OPERATIONS.md`).
6. **Every page you add or change must work on a phone.** Fluid grids, wrapping text, tables
   that scroll instead of crushing, nav that collapses. State which widths you considered.
7. **Never commit secrets.** Passwords, connection strings, gateway pass phrases and API keys
   live in `deploy/.env` (encrypted as `deploy/prod.enc.env`) — reference the **variable name**
   in docs, never the value.
8. **Report honestly.** If a step was skipped or a test failed, say so plainly with the output.

## 3. What you MUST produce at the end of every task

> **After finishing any task, write a work record:
> `docs/worklog/YYYY-MM-DD-<short-slug>.md`**

Use [`../worklog/TEMPLATE.md`](../worklog/TEMPLATE.md). It takes two minutes and it is the
memory the next session will have. Then:

- add one line for it in [`../worklog/README.md`](../worklog/README.md) (newest first);
- if you hit a trap worth remembering, add it to [`GOTCHAS.md`](GOTCHAS.md);
- if you added a service, route, or page, update [`PROJECT-MAP.md`](PROJECT-MAP.md).

A task is not finished until its `.md` exists.

## 4. Starting a brand-new chat

Paste this:

```
Read docs/ai/START-HERE.md and follow it. Then <your task>.
```

That single line pulls in the map, the gotchas, and the recent worklog, so the new session
starts where the last one ended.

## 5. Building a NEW app (not this one)

`plan_development/` is a separate, reusable blueprint for scaffolding a new project with the
same architecture. It is **not** the context of this app — use `docs/ai/` for that.
