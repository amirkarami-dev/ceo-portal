# Ready-to-Paste Prompts

Copy a prompt, replace the `<PLACEHOLDER>` tokens (see `05-templates/README.md`), and paste it to
Claude. Each prompt names the **driver agent** (`03-agents/`) and the **skill(s)** (`04-skills/`)
to use, points at the blueprint docs, and ends by demanding the **verification gate** from
`checklist.md`. Run the **reviewer** prompt at the end of every phase before advancing.

> General preamble (already true in this repo): the blueprint lives in `plan_development/`. Read
> `CLAUDE.md` and the relevant `01-development/*.md` + `gotchas.md` before coding. Verify with real
> command output — evidence, not assertions.

---

## Base project structure (the basic skeleton — run this FIRST) — `architect` → `backend-builder` + `frontend-builder`

```
Implement the **base project structure** for `<APP_NAME>` according to `plan_development/`.
Read `00-planning/base-scaffold-plan.md` and follow it exactly. Build an **empty but running
skeleton — NO domain features**:

- Monorepo (npm workspaces: `packages/*`, `web/`).
- .NET 10 solution with the 4 Clean-Architecture layers + the strict-build conventions
  (use skill `04-skills/scaffold-clean-architecture` + `05-templates/`); serves `/scalar`.
- Shared TS package (`packages/<CORE_PACKAGE>`): empty engine + a passing vitest.
- Web app (`web/`): Next.js shell — next-intl (default locale + RTL if needed), design tokens,
  landing + login only.
- Auth: the API is a JWT resource server exposing only `GET /api/Users/me`; web OIDC client.
- Local infra: `docker-compose.dev` (DB + MinIO), the `Dockerfile`s + Traefik labels.
- `CLAUDE.md` + `README` from the `02-documentation/*` templates.

Replace every `<PLACEHOLDER>` (see `05-templates/README.md`). Do NOT add business entities, use
cases, endpoints, or feature pages. Stop at the verify gate in `base-scaffold-plan.md` §3 with
evidence (real command output): `dotnet build` + `dotnet run` (`/scalar`, `/api/Users/me`),
`npm run build` (web home + login), `npm test` (shared package), `docker compose ... dev up`.
```

> The prompts below are the **project-specific build** — run them after the skeleton is green
> (Step 2 in `README.md`).

---

## Kickoff / Planning (Phase 0) — `architect`

```
Use the `architect` agent. We are building `<APP_NAME>` on the reference blueprint in
`plan_development/`. Read `00-planning/project-charter.template.md`, `requirements.template.md`,
`tech-stack.md`, `architecture-decisions.md`, and `roadmap-and-phases.md`.

1. Fill the charter + requirements for `<APP_NAME>`: <one-paragraph description of the domain and
   the interactive calculation/scoring it performs>.
2. Append ADRs for every material decision (Clean-Architecture layering, CQRS/MediatR pinned to free
   12.5.0, EF provider = SQL Server, central OIDC SSO [OpenIddict IdP owns password/OTP/Google; the
   API is a JWT resource server; web Auth.js v5; mobile expo-auth-session] + Administrator/User roles,
   the subscription account-gate (project cap removed — ADR-020), scoring-in-the-frontend with the backend as system of record,
   npm-workspaces monorepo + shared TS package, Expo + the APK fixes, the Traefik image-transfer deploy).
3. Refresh `roadmap-and-phases.md` with concrete names and make every Exit gate machine-checkable.
4. State the dependency-ordered build sequence and the owner agent per phase.

Do NOT write product code. Output the ADRs added, the phase list with gates, and the build order
with absolute paths to files changed. Stop at the Phase 0 gate in `06-migration/checklist.md`.
```

---

## Backend core (Phase 1) — `backend-builder`

```
Use the `backend-builder` agent. Stand up the .NET 10 Clean Architecture backend for `<APP_NAME>`
(`<PROJECT_NAME>.slnx`, namespace root `<RootName>`). Read `CLAUDE.md`,
`01-development/backend-clean-architecture.md`, `coding-standards.md`, `gotchas.md`.

Use the `scaffold-clean-architecture` skill for the solution; copy `Directory.Build.props` and
`.gitignore` from `05-templates/`; create `Directory.Packages.props`.

1. Domain first: port the calculation into `Domain/Services` as a FAITHFUL port of <reference
   source>, and write unit tests asserting NUMERIC PARITY. Define entities (use `sample-entity.cs`).
2. Application: CQRS CRUD with `add-cqrs-usecase` (command + `AbstractValidator` + DTO with nested
   `Mapping : Profile`); service interfaces in `Application/Common/Interfaces`.
3. Infrastructure: EF Core 10 + SQL Server; `ApplicationDbContext` (+ JSON as `nvarchar(max)`);
   `ApplicationDbContextInitialiser` (migrate-on-startup); first migration with `dotnet ef`.
4. Web: `IEndpointGroup` classes with `add-endpoint-group` (auto-mapped at `/api/{ClassName}`),
   Scalar at `/scalar`, health checks. The API is a **JWT resource server** — wire stock
   `AddJwtBearer` (authority = the OIDC IdP, audience = `<API_AUDIENCE>`, `RoleClaimType=role`,
   `NameClaimType=name`); do **NOT** add `MapIdentityApi` or any `/api/Auth/*` (OTP/Google) endpoints —
   login lives in the IdP, not the API. Bring up backing services with the dev compose.

Gate (Phase 1 in `06-migration/checklist.md`): `dotnet build <PROJECT_NAME>.slnx` green under
warnings-as-errors; domain parity tests pass; `dotnet run --project src/Web` applies migrations and
`/scalar` lists endpoints; CRUD works against a real DB. Report files changed + commands run.
```

---

## Web shell (Phase 2) — `frontend-builder`

```
Use the `frontend-builder` agent. Build the Next.js 16 web shell for `<APP_NAME>`. Read
`01-development/frontend-web.md` and `i18n-rtl.md`.

1. Create `web/` (App Router, TypeScript, `output: "standalone"`); set `NEXT_PUBLIC_API_BASE` in
   `.env.local`.
2. Wire next-intl: `<PRIMARY_LOCALE>` (default, RTL) + `<SECONDARY_LOCALE>` (LTR),
   `localePrefix: "as-needed"`, real `<html lang dir>` in `app/[locale]/layout.tsx`.
3. Design system: Tailwind v4, shadcn-style CSS-variable tokens (`<PRIMARY_COLOR>`), light/dark
   provider, shared `components/ui` primitives (stable export surface), self-hosted font.
4. Stub the route groups (public landing `/`, `(auth)`, protected `(dashboard)`) and the `lib/`
   API layer (`api.ts`, `endpoints.ts`, `tokens.ts`, `auth-context.tsx`).

Gate (Phase 2): `npm run build` passes; `npm run lint` clean; routes render; locale switch flips
`dir`/`lang`; dark mode works; dashboard redirects to login when unauthenticated.
```

---

## Scoring engine in the frontend (Phase 3) — `frontend-builder`

```
Use the `frontend-builder` agent. Implement the interactive scoring engine for `<APP_NAME>` in
`web/src/features/assessment` (this is where scoring LIVES — not the backend). Read
`01-development/frontend-web.md`.

1. Port the engine verbatim from <legacy source>: checklist modules + lookup data tables + types.
2. Build the interactive UI with a live total/max score.
3. Wire save/load against the Phase-1 endpoints (POST input + computed result + scores).
4. Add tests asserting the frontend engine matches the backend Domain on the same fixtures.

Gate (Phase 3): score updates live with no per-keystroke server calls; save persists + reload
restores; frontend<->backend parity tests pass.
```

---

## Auth + roles + admin (Phase 4) — `backend-builder` + `frontend-builder`

```
Use the `backend-builder` agent for the API, then `frontend-builder` for the UI. Implement auth for
`<APP_NAME>` as **central OIDC SSO**. Read `01-development/auth-and-roles.md` and `sso-oidc.md`.

Auth lives in a dedicated **OpenIddict OIDC IdP** (its own app/db) that owns ALL login methods
(password / OTP / Google) and issues **signed JWT access tokens** (30-min lifetime; **no
auto-refresh** — expiry forces a re-auth redirect). The IdP seeds `Administrator`/`User` roles + the
admin user. The token shape is a frozen contract (see `sso-oidc.md`).

Backend (the API is a **JWT resource server only**):
- Wire stock `AddJwtBearer` (authority = the IdP, audience = `<API_AUDIENCE>`, `RoleClaimType=role`,
  `NameClaimType=name`). Do **NOT** add `MapIdentityApi` or any `/api/Auth/*` (OTP/Google) endpoints —
  login is the IdP's job.
- `GET /api/Users/me` reads the **JWT claims** -> `{ id, email, phoneNumber, roles, isAdmin }`.
- `/api/Admin/*` gated with `RequireRole(Administrator)` (list users, change role/plan).

Frontend (server-side auth boundary):
- Web is an **Auth.js v5** generic OIDC client (Authorization Code + PKCE, httpOnly session cookie);
  the `jwt` callback lifts `role`/`email`/`name` into the session (`isAdmin` derived). **No manual
  token refresh.**
- Resolve identity **server-side**: the `(dashboard)` layout (Server Component) calls `auth()` and
  seeds `<AuthProvider initialUser>`. **Do NOT add a client `<RequireAuth>`.** `middleware.ts` does a
  cheap session-cookie presence gate (`next-intl` owns the response). Gate `/admin` with a Server
  Component layout (`(dashboard)/admin/layout.tsx` via `auth()`).

Gate (Phase 4): password/OTP/Google through the IdP each land authenticated and the API accepts the
IdP-issued JWT; identity is server-resolved (no `<RequireAuth>`); non-admin gets 403 + no admin UI
(server-layout gate); `GET /api/Users/me` -> `{ id, email, phoneNumber, roles, isAdmin }` from claims;
`dotnet test` (mocks the OIDC JWT scheme) + `npm run build` pass.
```

---

## Landing page (Phase 5) — `frontend-builder`

```
Use the `frontend-builder` agent. Build the public landing page for `<APP_NAME>` in
`components/landing/*` using the design system. Fully localise (RTL primary + LTR secondary), add
SEO basics per locale, keep it public (no auth) with CTAs into `(auth)`.

Gate (Phase 5): `/` renders for anonymous users in both locales with correct `dir`; `npm run build`
passes.
```

---

## Subscriptions + PDF / object storage (Phase 6) — `backend-builder` + `frontend-builder`

```
Use the `backend-builder` agent for the API, then `frontend-builder` for the UI. Read
`01-development/subscriptions.md` and `file-storage-pdf.md`.

Backend:
- `ISubscriptionService.EnsureCanCreateProjectAsync` (active-account gate; the per-user project cap
  was removed — ADR-020), inactive-account error surfaced under a `Subscription` field; call it on
  project create.
- `IReportGenerator` (QuestPDF) renders the PDF from the STORED result; `IFileStorage` (MinIO)
  uploads it; return a presigned URL against the public storage host.

Frontend: no user-facing subscription/usage UI (it's hidden); "Download report" opens the
presigned URL.

Gate (Phase 6): an inactive account returns a `Subscription`-field 400 (not 500), admin unblocks by
setting `IsActive`; a PDF generates/uploads/downloads via presigned URL; the script font renders.
```

---

## Shared package (Phase 7) — `frontend-builder` (+ `mobile-builder` for Metro)

```
Use the `frontend-builder` agent with the `setup-monorepo-shared-package` skill. Extract the
scoring engine for `<APP_NAME>` into `packages/<CORE_PACKAGE>` as the single source of truth.

1. Create the npm-workspaces root (`workspaces: ["packages/*","web","mobile"]`).
2. Move the engine from `web/src/features/assessment` into `packages/<CORE_PACKAGE>` (pure TS,
   `main/module/types -> ./src/index.ts`, `src/scoring/*` + `src/data/*`). Add Vitest parity tests.
3. Point web at it: dependency `"@<SCOPE>/<CORE_PACKAGE>": "*"`, `transpilePackages` in
   `next.config.ts`, `outputFileTracingRoot` at the repo root; replace the in-web copy with imports.

Gate (Phase 7): `npm install` at root links the workspace; web imports from `@<SCOPE>/<CORE_PACKAGE>`;
web build still passes; package Vitest tests pass; SCORES UNCHANGED vs Phase 3.
```

---

## Mobile app (Phase 8) — `mobile-builder`

```
Use the `mobile-builder` agent with the `setup-monorepo-shared-package` skill. Build the Expo SDK 54
app for `<APP_NAME>` that reuses `@<SCOPE>/<CORE_PACKAGE>`. Read `01-development/mobile-expo.md`.

1. Scaffold `mobile/` (expo-router typed routes, `newArchEnabled: true`); add it to workspaces; copy
   `metro.config.js` and `eas.json` from `05-templates/` (Metro forces a single react/react-native;
   `EXPO_NO_METRO_WORKSPACE_ROOT=1`).
2. Auth on device: reuse the API layer; tokens in `expo-secure-store`; OTP/Google via
   expo-web-browser/linking; `EXPO_PUBLIC_API_BASE` -> prod API.
3. Build the core screens (list, assessment, result) consuming the shared package.

Gate (Phase 8): `expo start` runs; `tsc --noEmit` passes; sign-in works on device/emulator;
assessment computes identically to web (no "Invalid hook call").
```

---

## Deploy behind existing Traefik (Phase 9) — `devops-deployer`

```
Use the `devops-deployer` agent with the `deploy-behind-traefik` skill. Deploy `<APP_NAME>` to the
network-restricted server (`<SERVER_IP>`, `/srv/<PROJECT_NAME>`) behind its EXISTING Traefik. Read
`CLAUDE.md` (Deployment), `01-development/setup.md`, `gotchas.md`.

1. Author `deploy/Dockerfile.api`, `Dockerfile.web`, `docker-compose.server.yml` from
   `05-templates/` (external `traefik` network; cert resolver `<CERT_RESOLVER>`; hosts
   `<WEB_DOMAIN>`/`<API_DOMAIN>`/`<S3_DOMAIN>`; DB/MinIO via `<REGISTRY_MIRROR>`; MinIO public host
   + SSL). Bake the PROD `NEXT_PUBLIC_API_BASE` into the web image.
2. Build images LOCALLY, `docker save | gzip` -> `pscp` -> `docker load` on the server. Pull
   DB/MinIO via the mirror.
3. Set `deploy/.env` (DB, MinIO public host+SSL, admin user, OTP/Google keys). Bring up ONLY
   `api`/`web`; do NOT restart the shared daemon or touch other stacks.

Gate (Phase 9): the three hosts serve over valid TLS; `/alive` OK; migrations applied + admin
seeded; only `api`/`web` recreated; prod smoke test (sign in -> create -> assess -> PDF) passes.
```

---

## DB migration / provider swap (Phase 10, if needed) — `backend-builder`

```
Use the `backend-builder` agent with the `swap-database-provider` skill. Swap `<APP_NAME>`'s EF
provider to <target provider>. Change the provider + `Aspire.Hosting.<DB>` packages, the
`Use<Provider>(...)` call + connection string, and provider-specific column types (jsonb <->
nvarchar(max)). DELETE and regenerate migrations (`dotnet ef migrations add Initial`). Update every
compose DB service + volume + mirror reference. Migrate/seed any legacy data.

Gate (Phase 10): `dotnet build`/`dotnet test` pass on the new provider; migrate-on-startup creates
the schema; prod smoke test passes on the new DB.
```

---

## Release Android APK (Phase 11) — `mobile-builder`

```
Use the `mobile-builder` agent with the `build-android-apk` skill. Produce a release APK of
`<APP_NAME>`'s mobile app. Configure `eas.json` + `app.json` (package id, version, icons);
`EXPO_PUBLIC_API_BASE` -> prod. Honor the build trio (New Arch ON, Metro project root pinned via
`EXPO_NO_METRO_WORKSPACE_ROOT=1`, React dedup, local `index.js` entry; NDK + JDK 17). Run the EAS
build, install on a device, and smoke-test against production.

Gate (Phase 11): EAS produces `mobile/<APP_NAME>.apk`; the installed app signs in and runs the
assessment against production.
```

---

## Reviewer (run at EVERY phase gate) — `reviewer`

```
Use the `reviewer` agent. We just finished Phase <N> of `<APP_NAME>`. Verify it against the
blueprint and the Phase <N> gate in `06-migration/checklist.md`:
- RUN the build/test commands (`dotnet build <PROJECT_NAME>.slnx`, `dotnet test`, `npm run build`,
  `tsc --noEmit` as applicable) and paste the real output.
- Check the diff against the Clean-Architecture / Next.js / Expo conventions and `gotchas.md`
  (strict build; no `jsonb`/`KnownNetworks`/un-aliased `ValidationException`; nested
  `Mapping : Profile`; `IEndpointGroup` at `/api/{ClassName}`; scoring in the frontend; deploy
  doesn't restart the shared daemon).
- For auth (Phase 4) specifically, verify: `middleware.ts` does **NOT** wrap `next-intl` in Auth.js's
  `auth()` helper (behind Traefik that rebases the `/`->`/fa` rewrite to an absolute URL the standalone
  server proxies -> `EAI_AGAIN`, breaking the default-locale site); the `/admin` gate is **server-side**
  (`(dashboard)/admin/layout.tsx` via `auth()`), not a client `<RequireAuth>`; the API has **no**
  password/OTP/Google (`/api/Auth/*`) endpoints (login lives in the IdP); and **MediatR is 12.5.0**
  (free, Apache-2.0), not a 13/14 commercial-license version.
Report findings with file:line evidence and a clear MERGE / CHANGES-REQUESTED verdict. Do not fix
code — report only.
```

---

## Migrate an EXISTING app — `architect` (then the phase prompts above)

```
Use the `architect` agent. We are migrating an EXISTING app onto the reference blueprint in
`plan_development/`. The existing app: <name + stack + where its interactive
calculation/scoring lives today>.

1. Map its domain onto the reference shapes: pick the Domain ENTITIES (-> `src/Domain/Entities`,
   `BaseAuditableEntity`) and the USE CASES (one MediatR command/query per operation). Identify the
   numerically-sensitive ENGINE (the equivalent of the reference's calculators) as the top risk.
2. Plan to port that engine into `packages/<CORE_PACKAGE>` as pure TypeScript (single source of
   truth) AND a faithful port into `Domain/Services` for the parts the backend must validate/store,
   with PARITY TESTS both ways (Vitest + Domain unit tests) against the legacy results.
3. Produce ADRs + a refreshed `roadmap-and-phases.md`, then hand the phases to the builder agents
   in dependency order. Include Phase 10 (provider swap with `swap-database-provider`) if the
   legacy DB differs from the target, and a data-migration step (JSON payloads stay as portable
   text columns).

Preserve the invariants: domain-parity-first; scoring in the frontend/shared package with the
backend as system of record; **central OIDC SSO** (OpenIddict IdP owns password/OTP/Google; the API is
a JWT resource server with **no** `/api/Auth/*`; web Auth.js v5 — no manual refresh, no `<RequireAuth>`,
server-seeded `AuthProvider`) + roles + the subscription account-gate; strict build; the APK fixes as their own phase; the
image-transfer/Traefik deploy that never restarts the shared daemon. Output the domain mapping, ADRs,
phase plan, and the migration's first gate (the parity tests).
```
