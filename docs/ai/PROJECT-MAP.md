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
| **VMS** (in build — steps 1–3 of 9) | `Application/Vms` | `/api/VmsAdmin` | none yet (`vms-web` is step 6) |

## VMS — camera viewing (in build, steps 1–3 done)

Live camera viewing at `vms.myceo.ir`, cameras classified by city. Design:
`docs/superpowers/specs/2026-08-01-vms-service-design.md`. **Nothing is deployed.**

- **Media never touches this box.** Cameras are pulled by **go2rtc on the VPS** (`185.182.220.182`,
  `~/vms`, `127.0.0.1:1984`), the same machine that runs LiveKit for the room service. `cam.myceo.ir`
  will point there with the CDN **off**; `vms.myceo.ir` is a normal SPA on this box with the CDN on.
- **`VmsCameras` holds no password.** `CredentialKey` names an entry in a secrets file on the VPS;
  step 4 joins the two to write go2rtc's config. A test fails the build if a password-ish column
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

## Documentation layout

| Path | Purpose |
|---|---|
| `docs/ai/` | **context for assistants** — start here |
| `docs/worklog/` | one record per finished task (required) |
| `CLAUDE.md` / `AGENTS.md` | auto-loaded project instructions (commands, architecture, gotchas) |
| `deploy/README.md`, `deploy/sso-cutover-runbook.md` | deployment and the SSO migration |
| `plan_development/` | reusable blueprint for building a *different* new app |
