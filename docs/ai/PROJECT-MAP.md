# PROJECT MAP — what exists and who owns what

One repo, one API, one identity provider, several front ends. Keep this file true:
if you add a service, a route group, or a page, update the tables here.

---

## Live systems

| What | Address | Served by |
|---|---|---|
| MyCEO service directory | `myceo.ir` | `portal-web/` (Vite + React) |
| Mabhas19 web (energy assessment) | `mabhas19.myceo.ir` | `mabhas19-web/` (Next.js) |
| API (all back-end features) | `api.myceo.ir` | `src/Web` |
| Identity provider (SSO) | `auth.myceo.ir` | `src/Auth` (OpenIddict) |
| Analytics / reporting | `analytic.myceo.ir` | `analytics-web/` |
| User administration | `admin.myceo.ir` | `admin-web/` |
| Landing panel (CMS) | `landing-panel.myceo.ir` | `landing-panel/` |
| Sanandaj municipality | `mun-sanandaj.myceo.ir` | `mun-sanandaj-web/` |
| Kurdnezam public site | `kurdnezam.ir` | `kurdnezam-web/` |
| **Engineers' welfare** | **`refahi.kurdnezam.ir`** | `walfare-web/` |
| **Elections** (not deployed yet) | **`election.myceo.ir`** | `election-web/` |
| **Cameras (VMS)** | **`vms.myceo.ir`** | `vms-web/` |
| Object storage (S3) | `s3.myceo.ir` | MinIO |

Server: `/data/apps/ceo-portal` on the production host, behind a **shared** Traefik. The Compose
project and platform containers use `ceo-portal`; the Mabhas19 product web remains `mabhas19-web`.
Details and commands: [`OPERATIONS.md`](OPERATIONS.md).

## Back end (`src/`)

Clean Architecture. A feature normally touches all four layers.

| Layer | Holds | Notes |
|---|---|---|
| `src/Domain` | entities, enums, domain services | Section-19 calculators must stay numerically identical to the legacy JS |
| `src/Application` | CQRS use cases (MediatR), DTOs, validators | `[Authorize]` on the request record controls access |
| `src/Infrastructure` | EF Core, storage, PDF, payments, external directories | one file per external system |
| `src/Web` | Minimal-API endpoint groups | each `IEndpointGroup` auto-maps; handler names are globally unique |
| `src/Auth` | the OIDC identity provider | its own database; the only token issuer |

### Feature areas in the API

| Area | Application folder | Endpoints | Front end |
|---|---|---|---|
| Assessments / projects | `Application/Projects`, `Assessments` | `/api/Projects`, `/api/Assessments` | `mabhas19-web/` |
| Analytics | `Application/Analytics` | `/api/Reports`, `/api/Dashboards`, `/api/SemanticModels` | `analytics-web/` |
| Kurdnezam CMS | `Application/Kurdnezam` | `/api/Kurdnezam*` | `landing-panel/`, `kurdnezam-web/` |
| Municipality | `Application/MunSanandaj` | `/api/MunSanandaj*` | `mun-sanandaj-web/` |
| **Welfare** | `Application/Walfare` | `/api/walfare/*` | `walfare-web/` |
| **Elections** | `Application/Elections` | `/api/ElectionAdmin`, `/api/Election`, `/api/BaleWebhook` | `election-web/`, Bale bot |
| **Rooms** | `Application/Rooms` | `/api/RoomAdmin`, `/api/Room` | `room-web/` (dev port 5277) |
| **VMS** | `Application/Vms` | `/api/VmsAdmin`, `/api/VmsGateway`, `/api/VmsMedia` | `vms-web/` (dev port 5278) |

## VMS — camera viewing — **live** at `vms.myceo.ir`

Live camera viewing at `vms.myceo.ir`, cameras classified by city. Design:
`docs/superpowers/specs/2026-08-01-vms-service-design.md`. **Live since 2026-08-02** — no camera has
been added through the panel yet, so the wall is empty until one is.

- **Media never touches this box.** Cameras are pulled by **go2rtc on the VPS** (`185.182.220.182`),
  the same machine that runs LiveKit. It is a **container** (`vms-go2rtc`, `/srv/sites/vms`) on that
  box's `traefik` network, publishing nothing — the only way in is Traefik at **`cam.myceo.ir`**
  (CDN **off**, real Let's Encrypt cert via TLS-ALPN).
- **Traefik there calls `/api/VmsMedia/check` (forwardAuth) before any stream request.** A browser
  cannot put a bearer token on a `<video>` request, so the SPA trades its JWT for a short-lived
  HMAC-signed cookie on `.myceo.ir` and the browser attaches it by itself. No cookie ⇒ 401.
- **The router is ONE path wide** — `Host(cam.myceo.ir) && Path(/api/ws)`. Everything else is
  *unrouted*, not merely forbidden, because go2rtc's `/api/streams` returns each source URL **with
  the camera password in it**. Step 8 will need `/api/frame.jpeg` added, deliberately.
- **`vms-web` is the eighth SPA** (dev 5278), Administrator-only on every route including the wall.
  Its player is a hand-written MSE-over-WebSocket client, not go2rtc's script — loading that would
  reopen the surface just closed. Tiles disconnect when scrolled away or when the tab is hidden,
  and a per-tab lease keeps one camera to one connection. **Measured:** four viewers = one RTSP
  session, each getting full bandwidth; the camera is released ten seconds after the last one.
- **`vms-health` sweeps every five minutes** from the VPS (`vms-health.timer`, **installed but
  not enabled until step 9**) and posts to `/api/VmsGateway/health`. It skips any camera with a
  live consumer — a probe is a second puller — and only a success moves `LastSeenUtc`, so a
  failure leaves the gap visible. `null` means never checked, which the UI shows grey, not red.
- **Two timers on the VPS, both enabled:** `vms-sync.timer` every 2 min (a camera added in the
  panel reaches go2rtc within that) and `vms-health.timer` every 5 min.
- **Docker on that VPS is Docker Desktop under a user session**: `sudo docker` sees nothing, and it
  bind-mounts only shared host paths — `/srv/...` mounts as an EMPTY DIRECTORY with no error. The
  generated go2rtc config therefore lives at `/home/amirserver/vms-config/go2rtc.yaml`.
- **`VmsCameras` holds no password.** `CredentialKey` names an entry in `/srv/vms/credentials.env`
  on the VPS. **The VPS pulls**: `vms-sync` (`scripts/vms-sync.sh`, installed at
  `/usr/local/bin/vms-sync`) fetches the streams block from `/api/VmsGateway/config` with a shared
  token, substitutes the credentials, and writes `/srv/vms/go2rtc.yaml`. It **refuses to write a
  config whose credential keys it does not hold** (exit 3), and only restarts go2rtc when the
  rendered file actually changed. A test fails the build if a password-ish column or DTO field
  appears.
- **`VmsCities` is a table, seeded with eight cities** by `VmsSeeder` at API startup — all-or-nothing,
  so a city an admin removes is never resurrected. A ninth city is an INSERT, not a release.
- **The binding constraint is each camera site's own upload (~0.41 Mbit/s measured), not the VPS's.**
  Only the 704×576 substream is viewable; the 2560×1440 main stream needs ~11.2 Mbit/s and cannot be
  watched at all. Cameras are H.265, so **MSE only — WebRTC is ruled out** and no new port is needed.

## Election service (in build — steps 1–6 done, 7–9 open)

Secret-ballot online elections. Design: `docs/superpowers/specs/2026-07-29-election-service-design.md`.

- **Three endpoint groups, deliberately split.** `/api/ElectionAdmin` is `Administrator`-only and only
  ever defines an election — it has **no** route that reveals who voted, only counts. `/api/Election`
  is the voter side; its cast body is `{ electionId, candidateIds }` and **never** a voter identifier,
  because identity comes from the token. `/api/BaleWebhook/{path}` is the bot, anonymous by necessity.
- **Two channels, one rule set.** `IBallotCaster` (`Application/Elections/BallotCasting.cs`) holds every
  cast rule and `IElectionBrowser` every eligibility rule; the web command handlers and the bot both
  delegate. These two are the only places a کد ملی is a parameter, and that must never spread to a
  command bound from a request body.
- **The Bale bot** (`Application/Elections/Bale/`) is `/start` → کد ملی → OTP → choose → **fresh OTP** →
  cast. The OTP goes only to the mobile the organisation has on record (SMS + Bale `safir` push by
  phone) — **never into the chat**, which would make a public number the only factor. Conversation state
  is in process memory, so **the API must not be scaled past one replica**.
- **Secrecy**: `ElectionVoteReceipt` holds only `(ElectionId, VoterHash)` — no timestamp, no channel,
  no discipline — so "who voted" and "turnout per رشته" are not computable by design, not merely
  hidden. Ballots are AES-256-GCM sealed with a per-election HKDF key; the roll is HMAC-SHA256 under a
  pepper. Sealed ballots are kept **30 days**, then purged; the SHA-256 result digest survives and is
  the only remaining evidence behind the published numbers.
- **Freeze rule**: once voting opens or any ballot exists, nothing about the election may change.
  Enforced in one place (`ElectionGuard.EnsureEditableAsync`) and surfaced to the admin UI as
  `ElectionDetailDto.IsEditable`.
- **A title restricts nobody.** «انتخاب هیئت رئیسه واحد گاز» limits voters to مکانیک only because the
  admin also selected discipline code 4. The UI shows the eligibility next to every title for this
  reason.
- **Only seven `Reshte` codes exist** in the org DB. سازه / ژئوتکنیک / زه‌کشی / سازه نگهبان are
  صلاحیت, have no column, and are out of v1.
- **One SPA, two audiences.** `election-web` serves voters at `/`, `/vote/:id`, `/result/:id` behind
  `RequireAuth` only, and admins at `/admin*` behind `RequireAdmin`. An `Administrator` check in front
  of the ballot would disenfranchise every engineer.
- **Candidate photos** upload to the shared S3 store under this service's own `elections/` prefix
  (`/api/ElectionMedia`, Administrator to write, anonymous to read so `<img>` works). Every upload in the
  portal follows that pattern — object storage, one folder per service. Never write into another
  service's prefix.
- `election` is in **`ServiceKeys.All`** (grantable, so it can show a launcher tile) but deliberately
  **not in `ClientToKey`** (never gating) — see GOTCHAS. Voters sign in with کد ملی + OTP via
  `/Account/EngineerLogin?service=election`.

## Room service — **live** at `room.myceo.ir`

Online meetings at `room.myceo.ir`. Design: `docs/superpowers/specs/2026-07-31-room-service-design.md`.

- **The media server is a dedicated LiveKit on Amir's own VPS** (`lk.myceo.ir`, `185.182.220.182`), not
  the shared box. A LiveKit API secret is **not scoped to a room**, so sharing one server would let
  either product mint a token into the other's meetings.
- **Two shapes, and the difference is who may speak.** `Meeting` = everyone publishes. `Presentation` =
  only the presenter does, and that is enforced in the **token** (`canPublish:false`), not the UI — the
  media server refuses a track the token does not allow, so a tampered front end changes nothing.
  Careful: LiveKit treats an **omitted** `canPublish` as `true`, so the serializer must write `false`
  explicitly.
- **Three join modes**: `InviteOnly` (Meeting only, by کد ملی), `Private` (link + the welfare کد ملی/OTP
  login), `Public` (link + a full name, Presentation only). The four combinations that must never exist
  are **CHECK constraints**, not just validators — each one is a security rule.
- **The presenter is identified by کد ملی**, because an authenticated join carries the کد ملی as its
  media identity and `Room.MayPublish` compares them ordinally. A free-text id there is a presenter who
  joins muted with no error anywhere. The display name comes from the organisation's record.
- **`JoinToken` is the link secret** (32 hex, regenerable), never the row id. Regenerating it is the only
  way to kill a link that reached the wrong audience. It is returned **only** by `/api/RoomAdmin`, which
  is why admin and attendee are separate endpoint groups.
- **`Rooms:PublicBaseUrl`** decides where a link points. Unset ⇒ every join link is `null`, which looks
  like a broken feature rather than a missing setting.
- **Admin calls to the media server are fail-soft; minting a token is not.** A head-count hiccup must
  render zeros, not a 500; a token is a security decision and throws.
- **One implementation of the join gates** (`IRoomJoiner`), used by both the member path and the link
  path — same reason `IBallotCaster` exists. The gates and their Persian reasons are a pure function
  (`RoomJoinRules.Check`), and their **order** is deliberate: eligibility before the countdown, and
  "media server unavailable" last, because it is about us and not about them.
- **A meeting you may not attend is a 404, never a 403.** A 403 confirms it exists, and walking the ids
  would list every meeting in the organisation one request at a time. Only «باید وارد شوید» is a 401 —
  the one refusal a browser can act on. Nothing is a 403, because the problem-details handler writes no
  `Detail` for one and the Persian reason would vanish.
- **A guest name is sanitized where it is accepted, not where it is rendered** — it goes to the media
  server and comes back to every other client. See GOTCHAS for the two traps in doing that.
- **`room-web`** (dev 5277) is the seventh SPA, same shape as `election-web`: attendee at `/` behind
  `RequireAuth` only, admin at `/admin*` behind `RequireAdmin`. Like `election`, the `room` service key
  is **grantable but never gating** — who attends a meeting is that meeting's invite list or its link,
  so `room-web` is deliberately absent from `ServiceKeys.ClientToKey`.
- **The presenter and invite boxes resolve a name from a کد ملی** via `GET /api/RoomAdmin/people/{code}`
  (Administrator-only, one direction). Searching by name would be a downloadable membership list.
- **`/j/:joinToken`** is the guest landing page — outside `RequireAuth` **and** outside `AppLayout`.
  Its countdown is measured against `serverNowUtc`, never the device clock, and reaching zero only
  triggers a refetch: the server's `canJoinNow` is always the authority.
- **The anonymous link routes share the API-wide rate limiter** (120/min per IP,
  `src/Web/DependencyInjection.cs`). That is the one control worth revisiting before a large public
  webinar — everyone behind one NAT shares the budget. See the step 7 worklog.
- **`/room/:id` and `/j/:joinToken` render the SAME `MeetingScreen`** — a member's door and a guest's
  door into one component, for the same reason `IRoomJoiner` exists on the server. Publish controls are
  **absent, not disabled**, for an audience member; camera and microphone always start off.
- **Chat authenticates a guest with the media token itself**, in an `X-Room-Token` header, verified by
  `IRoomTokenService.VerifyJoinToken`. A guest has no account, so this is the only credential they
  have — and it is a good one: it binds one identity to one room and expires. **The token's room is
  checked against the room being written to**, or one public link would open the chat of every meeting
  on the server. Sender name and `IsGuest` come out of that signature, never from the request body.
- **Chat is saved by the API and delivered live over the media data channel.** Not polling — every
  participant polling would burn the shared per-IP rate limit. De-duplicated on the database row id.

## Welfare service

Engineers buy pool tickets; admins define what is on sale.

- **Login**: کد ملی + SMS code, handled by the IdP (`src/Auth/Pages/Account/EngineerLogin`).
  The account's **username is the national code**; the person is looked up in the
  organisation database through `WebS_GetEngineerInfo`.
- **Domain**: `WelfareService` (offer + date window) → `WelfarePool` (active weekdays, price,
  capacity, hours) → `WelfarePoolReservation` (a ticket, with a snapshot of the buyer) →
  `PaymentTransaction` (the shared payment ledger, reusable by future paid features).
- **Payment**: Iran Kish, in `src/Infrastructure/Payments/IranKishGateway.cs`.
  Flow: token request → payer redirected to the bank → bank posts back to
  `/api/walfare/payments/irk-return` → **verify** → ticket marked paid, tracking code stored.
  An admin can re-run verify from `/admin/payments` («تأیید»).
- **Pages**: services, booking calendar (badges the days a pool actually runs), my reservations,
  payment result; admin: services, pools, reservations, payments.

## Front ends — shared conventions

All SPAs (`analytics-web`, `admin-web`, `landing-panel`, `mun-sanandaj-web`, `walfare-web`,
`election-web`) follow the same shape:

```
src/api/        HTTP client + typed endpoints        src/layout/    shell, nav, app switcher
src/auth/       OIDC (PKCE) + route guards           src/pages/     screens
src/query/      TanStack Query keys + hooks          src/components/ui/  shared primitives
src/theme/      design tokens, light/dark
```

- **The app launcher (`src/layout/AppSwitcher.tsx`) is byte-identical across all six SPAs**
  (`admin-web`, `analytics-web`, `election-web`, `landing-panel`, `mun-sanandaj-web`, `walfare-web`).
  Add a service to one → copy to all six, then rebuild **all six** or the old ones keep serving a
  stale list. Verify with `md5sum */src/layout/AppSwitcher.tsx`.
  It has **no `election` entry yet** — that lands with the step-9 deploy.
- Persian / RTL everywhere; dates shown in the Jalali calendar.
- `mabhas19-web/` and `kurdnezam-web/` are Next.js and follow their own (documented) structure. `portal-web/` is a public Vite service directory with no API or OIDC calls.
- Analytics opens on `/dashboards`: All/Mine/Recent dashboard library, read-only detail at
  `/dashboards/:id`, role-gated editing at `/dashboards/:id/edit`, and Ask AI at `/ask`.
- **Reports the query engine cannot express go through `presentation/custom/`.** A registered entry
  owns its parameters, its own data fetch and its own component; the saved definition is an envelope
  with `library: "custom"` and `component: "<id>"`, dispatched by `ReportView.tsx` like any other
  view, so the page shell, roles, breadcrumb and dashboards keep working. The first one is the
  engineer-quota report, driven by a KurdNezam stored procedure — see
  [`../design/2026-08-15-custom-reports-engineer-quota.md`](../design/2026-08-15-custom-reports-engineer-quota.md).
  Such a report has **no `QueryResult`**, so `ReportViewer` and `WidgetFrame` each carry several
  exemptions; `isCustomDefinition` in the registry is the one place that answers "is this one".
- **Charts in `analytics-web` are ECharts, and only ECharts** (recharts was removed 2026-08-14 —
  see [`../worklog/2026-08-14-recharts-to-echarts.md`](../worklog/2026-08-14-recharts-to-echarts.md)).
  The chain is: `presentation/auto-viz.ts` picks a view → `presentation/ReportView.tsx` dispatches on
  `view.library` → `presentation/renderers/EChartsRenderer.tsx` draws bar, line, area, pie and
  heatmap → `components/charts/useEChart.ts` owns every `echarts.init` in the app, so that no chart
  can be created without the theme. Three things that look like details and are not:
  - `library: "recharts"` is a **permanent alias** in the dispatcher. Stored definitions still carry
    it and nothing migrates them; without the alias they fall through to `TableRenderer` silently.
  - the component strings (`"BarChart"`, `"LineChart"`, `"PieChart"`, `"heatmap"`) are the identity
    key the view switcher matches on, via `targetOfView` in `presentation/view-switching.ts`.
  - charts are a **canvas**, so nothing in them is readable from the DOM — read the instance instead
    (`echarts.getInstanceByDom(el).getOption()`). Tests rely on a canvas stub in `vitest.setup.ts`.

## Documentation layout

| Path | Purpose |
|---|---|
| `docs/ai/` | **context for assistants** — start here |
| `docs/worklog/` | one record per finished task (required) |
| `CLAUDE.md` / `AGENTS.md` | auto-loaded project instructions (commands, architecture, gotchas) |
| `deploy/README.md`, `deploy/sso-cutover-runbook.md` | deployment and the SSO migration |
| `plan_development/` | reusable blueprint for building a *different* new app |
