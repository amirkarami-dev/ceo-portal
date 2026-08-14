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
| 2026-08-14 | [Every chart moved from recharts to ECharts](2026-08-14-recharts-to-echarts.md) | analytics | merged to `feat/echarts-only`, **not deployed** |
| 2026-08-14 | [Renaming a chart label in place, and the two blockers that made it a backend job](2026-08-14-analytics-editable-labels.md) | analytics + api | **live** on analytic.myceo.ir |
| 2026-08-14 | [The palette moved from emerald to blue, and the charts got two lists instead of one](2026-08-14-analytics-blue-palette.md) | analytics | **live** on analytic.myceo.ir |
| 2026-08-13 | [The organisation switcher offered a choice that changed nothing](2026-08-13-analytics-hide-tenant-switcher.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [A save button that shows its own progress](2026-08-13-analytics-save-button.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [The flaky permission test was paying for a module graph inside its own timer](2026-08-13-analytics-flaky-permission-test.md) | analytics-web | fixed, test-only |
| 2026-08-13 | [A dashboard widget can be a bar, a line, a pie or a table](2026-08-13-analytics-widget-view-modes.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [The date filter is a Persian calendar now](2026-08-13-analytics-jalali-date-filter.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [Typing in a filter gave «خطا در بارگذاری گزارش»](2026-08-13-analytics-range-filter.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [The charts in RTL — and what «left» actually means](2026-08-13-analytics-charts-rtl.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [The pie, the views that did nothing, and «sum_amount»](2026-08-13-analytics-charts-and-labels.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-13 | [AI gateway moved to DeepSeek-V4-Flash, and why «۱۴۰۵» came back empty](2026-08-13-analytics-ai-gateway-v4.md) | api | **live** — gateway switched, three bugs fixed |
| 2026-08-13 | [«اطلاعات پروژه‌ای مهندسان» on the Ask-AI page](2026-08-13-analytics-engineer-project-info.md) | analytics-web / api | **live** on analytic.myceo.ir |
| 2026-08-13 | [The reports pages on a phone](2026-08-13-analytics-reports-mobile.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Dates read as dates, in the language the app is set to](2026-08-12-analytics-date-format.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Opening a report from the library said it did not exist](2026-08-12-analytics-report-not-found.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Tab labels follow the theme, in every strip in the app](2026-08-12-analytics-tabs-theme.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Sidebar redesign: a head, three tiles, and a tab order that was backwards](2026-08-12-analytics-sidebar-redesign.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Two follow-ups cleared, and the widget-count line removed](2026-08-12-analytics-followups.md) | analytics-web + all 8 SPAs | **live** — all eight deployed |
| 2026-08-12 | [Navigation step 4: the design and phone pass](2026-08-12-analytics-navigation-polish.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Navigation step 3: /dashboards is just the dashboard](2026-08-12-analytics-dashboards-tabs.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Navigation step 2: managing dashboards gets its own page](2026-08-12-analytics-manage-dashboards.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Navigation step 1: a sidebar you can fold](2026-08-12-analytics-sidebar-collapse.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-12 | [Dashboard widgets jumped to the right corner when grabbed](2026-08-12-analytics-rtl-grid-drag.md) | analytics-web | **live** on analytic.myceo.ir |
| 2026-08-11 | [Form builder step 5: the design and phone pass](2026-08-11-form-builder-step-5-design.md) | kurdnezam-web | **live** — feature complete |
| 2026-08-11 | [Form builder step 4: the public form](2026-08-11-form-builder-step-4-public.md) | kurdnezam-web | **live** — proven end to end on kurdnezam.ir |
| 2026-08-11 | [Form builder step 3: the panel](2026-08-11-form-builder-step-3-panel.md) | kurdnezam / landing-panel | deployed; panel screens not clicked through yet |
| 2026-08-11 | [Form builder step 2: the API](2026-08-11-form-builder-step-2-api.md) | kurdnezam / api | **live**, proven end to end; no screens yet |
| 2026-08-11 | [Form builder step 1: the tables](2026-08-11-form-builder-step-1-schema.md) | kurdnezam / database | **live** — nothing uses it yet |
| 2026-08-07 | [Kurdnezam: builder credit in the footer](2026-08-07-kurdnezam-japra-credit.md) | kurdnezam-web | **live** at kurdnezam.ir |
| 2026-08-04 | [MunSanandaj: 60 runs failed and showed no reason](2026-08-04-mun-sanandaj-silent-failure.md) | mun-sanandaj | code fix **live**; blocked on an expired cert we don't control |
| 2026-08-04 | [Access step 2: an admin only gets the services you give them](2026-08-04-service-gating.md) | auth / admin-web / all 8 SPAs | **shipped and verified live**; 16/16 new tests |
| 2026-08-04 | [Access step 1: a working `SuperUser` role](2026-08-04-superuser-role.md) | auth / api / all 8 SPAs | **shipped and verified live**; does nothing until step 2 turns it on |
| 2026-08-04 | [The login loop after access is removed, and why the reason was hidden](2026-08-04-access-denied-loop.md) | auth / all 8 SPAs | **fixed and deployed**; the service-access half is not finished |
| 2026-08-03 | [Kurdnezam step 7: the phone check, and what the review found](2026-08-03-kurdnezam-step-7-mobile-and-closeout.md) | kurdnezam / panel / api | **live** — feature complete |
| 2026-08-03 | [Kurdnezam step 6: the last two fixed lists removed](2026-08-03-kurdnezam-step-6-arkan-nav.md) | kurdnezam-web | **live** — ارکان fully manageable |
| 2026-08-03 | [Kurdnezam step 5: /p/tamas rebuilt from the database](2026-08-03-kurdnezam-step-5-contact-page.md) | kurdnezam-web | **live** at kurdnezam.ir/p/tamas |
| 2026-08-03 | [Kurdnezam step 4: ارکان becomes editable, and the panel ships](2026-08-03-kurdnezam-step-4-admin-fields.md) | kurdnezam / landing-panel | done and deployed |
| 2026-08-03 | [Kurdnezam step 3: the بخش‌های تماس admin screen, and a panel that never worked on a phone](2026-08-03-kurdnezam-step-3-contact-admin.md) | kurdnezam / landing-panel | built and verified; deploys with step 4 |
| 2026-08-03 | [Kurdnezam step 2: the API for contact sections and managed ارکان](2026-08-03-kurdnezam-step-2-api.md) | kurdnezam | done and deployed |
| 2026-08-03 | [Kurdnezam step 1: schema for managed contact sections and ارکان](2026-08-03-kurdnezam-step-1-schema.md) | kurdnezam | done — verified on prod data, applies at next deploy |
| 2026-08-03 | [VMS: the first real camera, and the WebSocket go2rtc kept closing](2026-08-03-vms-first-camera-ws-origin.md) | vms / media VPS | fixed — **first camera proven end to end** |
| 2026-08-03 | [VMS: the mobile menu, and a drawer bug that was never about the drawer](2026-08-03-vms-mobile-menu.md) | vms / room | fixed and deployed |
| 2026-08-03 | [VMS: the CORS credentials bug, and a mobile pass](2026-08-03-vms-cors-and-mobile.md) | vms | fixed and deployed |
| 2026-08-02 | [VMS step 9: deployed, and the login server went down on the way](2026-08-02-vms-step-9-deploy.md) | vms / infra | **live** at vms.myceo.ir; auth crash fixed |
| 2026-08-02 | [VMS step 8: health check and «آخرین اتصال»](2026-08-02-vms-step-8.md) | vms | done — timer installed, enabled at step 9 |
| 2026-08-02 | [VMS step 7: one puller per camera, measured](2026-08-02-vms-step-7.md) | vms | done — go2rtc feeds many viewers; SPA keeps the stream alive |
| 2026-08-02 | [VMS step 6: vms-web and a smaller gateway](2026-08-02-vms-step-6.md) | vms | built; gateway proven, UI not seen signed in |
| 2026-08-02 | [VMS step 5: forwardAuth on the media gateway](2026-08-02-vms-step-5.md) | vms / infra | done — cam.myceo.ir refuses without a cookie, proven from the internet |
| 2026-08-02 | [VMS step 4: go2rtc config from the database](2026-08-02-vms-step-4.md) | vms / infra | done — proven end to end; go2rtc is a service on the VPS |
| 2026-08-02 | [VMS step 3: admin CRUD, by city](2026-08-02-vms-step-3.md) | vms | done — /api/VmsAdmin, 43 tests, not deployed |
| 2026-08-02 | [VMS step 2: the camera model](2026-08-02-vms-step-2.md) | vms | done — 2 tables + migration, applied locally, not deployed |
| 2026-08-02 | [VMS step 1: one camera, end to end](2026-08-02-vms-step-1.md) | vms / infra | done — stream URL found, camera uplink is the real limit |
| 2026-08-01 | [Down: every engineer was told they were not an engineer](2026-08-01-engineer-lookup-outage.md) | welfare / election / room | **fixed and deployed** |
| 2026-07-31 | [Room step 10: deploy — room.myceo.ir](2026-07-31-room-step-10-deploy.md) | room / infra | **live** at room.myceo.ir |
| 2026-07-31 | [Room step 9: saved chat](2026-07-31-room-step-9-chat.md) | room | **observed** — a guest's message survived a reload |
| 2026-07-31 | [Room step 8: the meeting screen, both modes](2026-07-31-room-step-8-meeting-screen.md) | room / front end | **observed** — server refused the audience publish |
| 2026-07-31 | [Room step 7: the link landing page and the countdown](2026-07-31-room-step-7-join-page.md) | room / front end | **proven in a browser** — a guest joined |
| 2026-07-31 | [Room step 6: room-web — my meetings, admin table, create/edit](2026-07-31-room-step-6-room-web.md) | room / front end | built; signed-in screens not tried yet |
| 2026-07-31 | [Room step 5: joining — member, guest, landing page](2026-07-31-room-step-5-join.md) | room | built and tested; no browser has connected |
| 2026-07-31 | [Room step 4: admin CRUD, join links, invites](2026-07-31-room-step-4-admin-api.md) | room | built and tested; no UI yet |
| 2026-07-31 | [Room steps 1-3: video server, meeting model, tokens](2026-07-31-room-steps-1-2.md) | room / infra | steps 1-3 done; token proven live |
| 2026-07-31 | [Election step 10: candidate photos go to file storage](2026-07-31-election-candidate-photo-upload.md) | election | built, not deployed |
| 2026-07-31 | [Election service: deployed to production](2026-07-31-election-deploy.md) | election / infra | **live** at election.myceo.ir |
| 2026-07-30 | [Election step 9: deploy setup](2026-07-30-election-deploy-prep.md) | election / infra | ready to deploy — needs secrets on the server |
| 2026-07-30 | [Election step 8: the Bale voting bot](2026-07-30-election-bale-bot.md) | election | in progress — safir push verified live; bot chat untested |
| 2026-07-30 | [Election step 7: the voter flow](2026-07-30-election-voter-flow.md) | election | in progress — voter UI not seen working |
| 2026-07-30 | [Election step 6: `election-web` admin panel](2026-07-30-election-admin-panel.md) | election | in progress — UI not clicked through yet |
| 2026-07-27 | [Kurdnezam portal dock: welfare first, same-size tiles](2026-07-27-kurdnezam-portal-dock.md) | kurdnezam-web | implemented, not deployed |
| 2026-07-27 | [New agent instructions, and starting the stack locally](2026-07-27-agent-docs-and-local-stack.md) | docs / local dev | complete, local only |
| 2026-07-26 | [Analytics: report details and easier menus](2026-07-26-analytics-report-ux.md) | analytics | shipped to production |
| 2026-07-26 | [CEO Portal Docker project and volume migration](2026-07-26-docker-platform-rename.md) | infra | shipped to production |
| 2026-07-26 | [Analytics dashboard home and read-only viewer](2026-07-26-analytics-dashboard-home.md) | analytics | shipped to production |
| 2026-07-26 | [MyCEO: new name and a move to a new host](2026-07-26-platform-rebrand.md) | infra | shipped to production |
| 2026-07-25 | [Mihan SMS provider for OTP](2026-07-25-mihan-sms.md) | auth | built, not deployed |
| 2026-07-23 | [Iran Kish payment: made it actually reach the bank](2026-07-23-irankish-payment.md) | welfare | shipped |
| 2026-07-23 | [Welfare service: engineer login, booking, admin](2026-07-23-walfare-service.md) | welfare | shipped |
| 2026-07-23 | [Analytics pointed at KurdNezam + dashboards](2026-07-23-analytics-kurdnezam.md) | analytics | shipped |
| 2026-07-23 | [AI context structure (this system)](2026-07-23-ai-context-structure.md) | infra | shipped |
