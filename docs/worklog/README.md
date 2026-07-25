# Worklog — one record per finished task

This is the project's memory between sessions. A chat window is lost; these files are not.

## The rule

> **After finishing any task, write `docs/worklog/YYYY-MM-DD-<short-slug>.md`
> from [`TEMPLATE.md`](TEMPLATE.md), and add a line to the index below (newest first).**

A task is not finished until its record exists. Keep it short — goal, what changed,
root cause if it was a bug, decisions, how it was verified, what is left.

Also, when a task teaches something reusable:

| If you… | Then update |
|---|---|
| hit a trap that looked like something else | [`../ai/GOTCHAS.md`](../ai/GOTCHAS.md) |
| added a service, route group, or page | [`../ai/PROJECT-MAP.md`](../ai/PROJECT-MAP.md) |
| changed how we build, deploy, or verify | [`../ai/OPERATIONS.md`](../ai/OPERATIONS.md) |

## Index

| Date | Record | Area | Status |
|---|---|---|---|
| 2026-07-25 | [Mihan SMS provider for OTP](2026-07-25-mihan-sms.md) | auth | implementation complete, not deployed |
| 2026-07-23 | [Iran Kish payment: made it actually reach the bank](2026-07-23-irankish-payment.md) | welfare | shipped |
| 2026-07-23 | [Welfare service: engineer login, booking, admin](2026-07-23-walfare-service.md) | welfare | shipped |
| 2026-07-23 | [Analytics retargeted to KurdNezam + dashboards](2026-07-23-analytics-kurdnezam.md) | analytics | shipped |
| 2026-07-23 | [AI context structure (this system)](2026-07-23-ai-context-structure.md) | infra | shipped |
