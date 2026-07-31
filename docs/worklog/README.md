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
| 2026-07-31 | [Room step 10: deploy — room.myceo.ir](2026-07-31-room-step-10-deploy.md) | room / infra | **live** at room.myceo.ir |
| 2026-07-31 | [Room step 9: saved chat](2026-07-31-room-step-9-chat.md) | room | **observed** — a guest's message survived a reload |
| 2026-07-31 | [Room step 8: the meeting screen, both modes](2026-07-31-room-step-8-meeting-screen.md) | room / front end | **observed** — server refused the audience publish |
| 2026-07-31 | [Room step 7: the link landing page and the countdown](2026-07-31-room-step-7-join-page.md) | room / front end | **proven in a browser** — a guest joined |
| 2026-07-31 | [Room step 6: room-web — my meetings, admin table, create/edit](2026-07-31-room-step-6-room-web.md) | room / front end | built; signed-in screens not yet driven |
| 2026-07-31 | [Room step 5: joining — member, guest, landing page](2026-07-31-room-step-5-join.md) | room | built and tested; no browser has connected |
| 2026-07-31 | [Room step 4: admin CRUD, join links, invites](2026-07-31-room-step-4-admin-api.md) | room | built and tested; no UI yet |
| 2026-07-31 | [Room steps 1-3: video server, meeting model, tokens](2026-07-31-room-steps-1-2.md) | room / infra | steps 1-3 done; token proven live |
| 2026-07-31 | [Election step 10: candidate photos upload to object storage](2026-07-31-election-candidate-photo-upload.md) | election | built, not deployed |
| 2026-07-31 | [Election service: deployed to production](2026-07-31-election-deploy.md) | election / infra | **live** at election.myceo.ir |
| 2026-07-30 | [Election step 9: deployment wiring](2026-07-30-election-deploy-prep.md) | election / infra | ready to deploy — needs secrets on the server |
| 2026-07-30 | [Election step 8: the Bale voting bot](2026-07-30-election-bale-bot.md) | election | in progress — safir push verified live; bot chat untested |
| 2026-07-30 | [Election step 7: the voter flow](2026-07-30-election-voter-flow.md) | election | in progress — voter UI not seen rendered |
| 2026-07-30 | [Election step 6: `election-web` admin panel](2026-07-30-election-admin-panel.md) | election | in progress — UI click-through pending |
| 2026-07-27 | [Kurdnezam portal dock: welfare first, uniform tiles](2026-07-27-kurdnezam-portal-dock.md) | kurdnezam-web | implemented, not deployed |
| 2026-07-27 | [Agent instruction refresh and local stack bring-up](2026-07-27-agent-docs-and-local-stack.md) | docs / local dev | complete, local only |
| 2026-07-26 | [Analytics report metadata and navigation UX](2026-07-26-analytics-report-ux.md) | analytics | shipped to production |
| 2026-07-26 | [CEO Portal Docker project and volume migration](2026-07-26-docker-platform-rename.md) | infra | shipped to production |
| 2026-07-26 | [Analytics dashboard home and read-only viewer](2026-07-26-analytics-dashboard-home.md) | analytics | shipped to production |
| 2026-07-26 | [MyCEO platform rebrand and host cutover](2026-07-26-platform-rebrand.md) | infra | shipped to production |
| 2026-07-25 | [Mihan SMS provider for OTP](2026-07-25-mihan-sms.md) | auth | implementation complete, not deployed |
| 2026-07-23 | [Iran Kish payment: made it actually reach the bank](2026-07-23-irankish-payment.md) | welfare | shipped |
| 2026-07-23 | [Welfare service: engineer login, booking, admin](2026-07-23-walfare-service.md) | welfare | shipped |
| 2026-07-23 | [Analytics retargeted to KurdNezam + dashboards](2026-07-23-analytics-kurdnezam.md) | analytics | shipped |
| 2026-07-23 | [AI context structure (this system)](2026-07-23-ai-context-structure.md) | infra | shipped |
