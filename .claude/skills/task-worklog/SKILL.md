---
name: task-worklog
description: Write the required work record after finishing a task in this repo, and update the context files it affects. Use when a task is complete (code shipped, bug fixed, feature merged) or when asked to document what was just done.
---

# Write the work record

Every finished task in this repo leaves one markdown file behind. That file is the memory the
next session gets — a chat window is lost, this is not.

## Steps

1. **Create** `docs/worklog/YYYY-MM-DD-<short-slug>.md` from `docs/worklog/TEMPLATE.md`.
   Slug: 2–4 words, lowercase, hyphens (`irankish-payment`, `mobile-layout`).
   If a record for the same task already exists today, extend it instead of adding a second.

2. **Fill it in**, keeping it short and concrete:
   - **Goal** — what was asked, in the user's own words where possible.
   - **What changed** — the files that matter, one line each, with the *why*.
   - **Root cause** — only for bugs, and this is the valuable part: what actually broke and why
     the symptom pointed elsewhere.
   - **Decisions** — anything a future reader would otherwise argue about again, with reasons.
   - **Verification** — the build/test output, the live check, the log line or DB row. State
     plainly what was **not** verified (e.g. "did not complete a real payment").
   - **Follow-ups** — what was deliberately left, with enough context to resume.

3. **Add one line to the index** in `docs/worklog/README.md`, newest first.

4. **Propagate what is reusable:**

   | If the task… | Update |
   |---|---|
   | hit a trap that looked like something else | `docs/ai/GOTCHAS.md` (symptom → cause → fix → where) |
   | added a service, route group, or page | `docs/ai/PROJECT-MAP.md` |
   | changed how we build, deploy or verify | `docs/ai/OPERATIONS.md` |

5. **Mirror the fix in code comments.** A gotcha entry without a comment at the code site will be
   re-broken by the next edit.

## Quality bar

- Written for someone with **no memory of the conversation**.
- Honest: failures, skipped steps and unverified parts are stated, not implied.
- No secrets — variable names only, never values.
- Short. A good record is under a page.
