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
| 2026-08-03 | [Kurdnezam step 3: the بخش‌های تماس admin screen, and a panel that never worked on a phone](2026-08-03-kurdnezam-step-3-contact-admin.md) | kurdnezam / landing-panel | built and verified; deploys with step 4 |
| 2026-08-03 | [Kurdnezam step 2: the API for contact sections and managed ارکان](2026-08-03-kurdnezam-step-2-api.md) | kurdnezam | done and deployed |
| 2026-08-03 | [Kurdnezam step 1: schema for managed contact sections and ارکان](2026-08-03-kurdnezam-step-1-schema.md) | kurdnezam | done — verified on prod data, applies at next deploy |
| 2026-08-03 | [VMS: the first real camera, and the WebSocket go2rtc would not open](2026-08-03-vms-first-camera-ws-origin.md) | vms / media VPS | fixed — **first camera proven end to end** |
| 2026-08-03 | [VMS: the mobile menu, and a drawer bug that was never about the drawer](2026-08-03-vms-mobile-menu.md) | vms / room | fixed and deployed |
| 2026-08-03 | [VMS: the CORS credentials bug, and a mobile pass](2026-08-03-vms-cors-and-mobile.md) | vms | fixed and deployed |
| 2026-08-02 | [VMS step 9: deployed, and an IdP outage on the way](2026-08-02-vms-step-9-deploy.md) | vms / infra | **live** at vms.myceo.ir; auth crash fixed |
| 2026-08-02 | [VMS step 8: health sweep and «آخرین اتصال»](2026-08-02-vms-step-8.md) | vms | done — timer installed, enabled at step 9 |
| 2026-08-02 | [VMS step 7: one puller per camera, measured](2026-08-02-vms-step-7.md) | vms | done — go2rtc fan-out proven; SPA lease added |
| 2026-08-02 | [VMS step 6: vms-web and the narrowed gateway](2026-08-02-vms-step-6.md) | vms | built; gateway proven, UI not seen signed in |
| 2026-08-02 | [VMS step 5: forwardAuth on the media gateway](2026-08-02-vms-step-5.md) | vms / infra | done — cam.myceo.ir refuses without a cookie, proven from the internet |
| 2026-08-02 | [VMS step 4: go2rtc config from the database](2026-08-02-vms-step-4.md) | vms / infra | done — proven end to end; go2rtc is a service on the VPS |
| 2026-08-02 | [VMS step 3: admin CRUD, by city](2026-08-02-vms-step-3.md) | vms | done — /api/VmsAdmin, 43 tests, not deployed |
| 2026-08-02 | [VMS step 2: the camera model](2026-08-02-vms-step-2.md) | vms | done — 2 tables + migration, applied locally, not deployed |
| 2026-08-02 | [VMS step 1: one camera, end to end](2026-08-02-vms-step-1.md) | vms / infra | done — stream URL found, camera uplink is the real limit |
| 2026-08-01 | [Outage: every engineer was told they were not an engineer](2026-08-01-engineer-lookup-outage.md) | welfare / election / room | **fixed and deployed** |
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
