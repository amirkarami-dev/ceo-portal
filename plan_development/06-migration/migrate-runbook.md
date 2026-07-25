# Migration & Build Runbook

**Goal:** Point Claude at `plan_development/` and build (or migrate) `<APP_NAME>` — a full-stack
app on the reference blueprint (derived from **Mabhas19**): a .NET 10 Clean Architecture backend +
Next.js 16 web + Expo SDK 54 mobile, sharing one pure-TypeScript engine in an npm-workspaces
monorepo, deployed behind an existing Traefik on a network-restricted server.

This runbook is the end-to-end procedure. It tells you what to read, in what order to build, which
**agent** drives each phase, which **skill** to invoke, and the **verification gate** that must be
green before moving on. Pair it with `checklist.md` (the gates as checkboxes) and `prompts.md`
(ready-to-paste prompts).

Replace `<APP_NAME>` with the new project's name and every other `<PLACEHOLDER>` per the table in
`05-templates/README.md`.

---

## 0. Prerequisites & toolchain

Install/confirm before Phase 1:

- **.NET 10 SDK** — pin it with a repo-root `global.json` (`dotnet --version` matches).
- **`dotnet-ef` matching EF Core 10**: `dotnet tool update -g dotnet-ef --version "10.0.*"`.
- **Node.js >= 20.9** and **npm** (workspaces).
- **Docker** + Docker Compose (for SQL Server + MinIO locally).
- **Mobile (later phases):** Android SDK + **JDK 17** + NDK (the version the Expo SDK pins),
  Expo/EAS CLI via `npx`.
- **Deploy (later phases):** PuTTY **`plink`/`pscp`** (Windows) for the restricted server; access to
  a **registry mirror** (`<REGISTRY_MIRROR>`); DNS + TLS via the server's existing Traefik.

> Strict build: `TreatWarningsAsErrors=true`. Fix warnings; do not relax the flag. Only the listed
> transitive NuGet-audit advisories are demoted (`NU1608;NU1902;NU1903`).

---

## 1. How to read the blueprint (00 -> 05)

Read top to bottom **once** before writing anything, then keep them open as you build:

| Folder | What it gives you | When |
|--------|-------------------|------|
| `00-planning/` | Charter + requirements templates, **tech stack**, **architecture decisions (ADRs)**, and the **`roadmap-and-phases.md`** (the canonical 11-phase order). | First. Fill the charter/requirements for `<APP_NAME>`. |
| `01-development/` | The prose "how" for each area: backend Clean Architecture, frontend web, mobile, shared package, auth/roles, i18n/RTL, file-storage/PDF, SMS/OTP, subscriptions, setup, and **`gotchas.md`**. | Per phase, as the deep reference. |
| `02-documentation/` | README / CLAUDE.md / API-reference / HTML-guide templates to produce the project's own docs. | When documenting (end of phases / before handoff). |
| `03-agents/` | The six agent role files: `architect`, `backend-builder`, `frontend-builder`, `mobile-builder`, `devops-deployer`, `reviewer`. | To pick the driver per phase. |
| `04-skills/` | Seven step-by-step skills (see the table in §3). | When performing the concrete action. |
| `05-templates/` | Copy-ready, parametrized files (build props, `.gitignore`, compose, Dockerfiles, EAS/Metro, C# samples). | When creating those files. |

**Source of truth for the build order is `00-planning/roadmap-and-phases.md`.** This runbook
references its phases rather than restating them.

---

## 2. Phase order (from `00-planning/roadmap-and-phases.md`)

Build back-to-front of the dependency chain: **domain correctness first**, then a thin working
slice per client, then cross-cutting features, then sharing, then mobile, then deploy.

```
1 backend core ─┬─> 2 web shell ─┬─> 3 scoring (web) ──> 7 shared pkg ─┬─> 8 mobile ──> 11 APK
                │                ├─> 4 auth + admin                    │
                │                └─> 5 landing                         │
                └────────────────────> 6 subscriptions + PDF ─────────┘
                                                  │
                                  9 deploy (Traefik + image transfer)
                                                  │
                                  10 DB migration (provider swap, if needed)
```

1. **Backend core** — Domain -> Application -> Infrastructure -> Web (CRUD, no auth yet).
2. **Web shell** — Next.js routes + i18n + design system.
3. **Scoring engine (frontend)** — the interactive domain logic in the browser.
4. **Auth + roles + admin** — central OIDC SSO (OpenIddict IdP owns password/OTP/Google); the API is a JWT resource server; web is an Auth.js v5 OIDC client; `Administrator`/`User`, admin area.
5. **Public landing page**.
6. **Subscriptions + PDF / object storage**.
7. **Extract the shared package** — engine becomes `packages/<CORE_PACKAGE>`, web consumes it.
8. **Mobile app (Expo)**.
9. **Deploy behind existing Traefik** (image-transfer pipeline).
10. **Database migration** — provider swap *(skip if you start on the target provider)*.
11. **Release Android APK**.

> Do **not** start a phase until the previous gate is green. Treat each phase's Exit criteria in
> `roadmap-and-phases.md` (and `checklist.md` here) as a hard gate.

---

## 3. Per-phase driver agent + skill + gate

For each phase: invoke the **agent** (from `03-agents/`) as the driver, use the **skill(s)** (from
`04-skills/`) for the concrete steps, and pass the **gate** to the `reviewer` agent before moving
on. The `architect` plans; the `reviewer` verifies every phase.

| Phase | Driver agent | Skill(s) | Verification gate (must be green) |
|-------|--------------|----------|-----------------------------------|
| 0 — Plan | `architect` | — | Charter + stack agreed; ADRs recorded; roadmap with per-phase gates exists. |
| 1 — Backend core | `backend-builder` | `scaffold-clean-architecture`, `add-cqrs-usecase`, `add-endpoint-group` | `dotnet build <PROJECT_NAME>.slnx` green under warnings-as-errors; **domain parity unit tests pass**; `dotnet run --project src/Web` applies migrations + `/scalar` lists endpoints; CRUD works against a real DB. |
| 2 — Web shell | `frontend-builder` | — (see `01-development/frontend-web.md`, `i18n-rtl.md`) | `npm run build` (web) passes; `npm run lint` clean; routes render; locale switch flips `dir`/`lang`; dashboard redirects to login when unauthenticated. |
| 3 — Scoring engine (frontend) | `frontend-builder` | — (see `01-development/frontend-web.md`) | Checklists update score live (no per-keystroke server calls); save persists + reload restores; **frontend<->backend parity tests pass**. |
| 4 — Auth + roles + admin | `backend-builder` + `frontend-builder` | `add-endpoint-group`, `add-cqrs-usecase` | Central OIDC SSO: IdP owns password/OTP/Google; web Auth.js (Auth Code + PKCE) lands authenticated; the API (JWT resource server, no `/api/Auth/*`) accepts the IdP JWT; identity server-resolved (no client `<RequireAuth>`); non-admin gets 403 from `/api/Admin/*` and the `/admin` server-layout gate hides admin UI; `GET /api/Users/me` -> `{ id, email, phoneNumber, roles, isAdmin }` from JWT claims; `dotnet test` (mocks the OIDC JWT scheme) + `npm run build` pass. |
| 5 — Landing page | `frontend-builder` | — | `/` renders for anonymous users in both locales with correct `dir`; `npm run build` passes. |
| 6 — Subscriptions + PDF | `backend-builder` + `frontend-builder` | — (see `01-development/subscriptions.md`, `file-storage-pdf.md`) | An inactive account returns a **`Subscription`-field 400** (not 500); active users create unlimited projects (no cap — ADR-020); a report PDF generates, uploads, downloads via presigned URL; the script font renders. |
| 7 — Shared package | `frontend-builder` (+ `mobile-builder` for Metro) | `setup-monorepo-shared-package` | `npm install` at root links the workspace; web imports from `@<SCOPE>/<CORE_PACKAGE>`; web build still passes; package Vitest tests pass; **scores unchanged** vs Phase 3. |
| 8 — Mobile app | `mobile-builder` | `setup-monorepo-shared-package` | `expo start` runs; `tsc --noEmit` passes; sign-in works on device/emulator; assessment computes **identically to web**. |
| 9 — Deploy behind Traefik | `devops-deployer` | `deploy-behind-traefik` | `https://<WEB_DOMAIN>`, `https://<API_DOMAIN>`, `https://<S3_DOMAIN>` serve over valid TLS; migrations applied + admin seeded; prod smoke test passes; **only `api`/`web` recreated**, other stacks untouched, shared daemon not restarted. |
| 10 — DB migration (if needed) | `backend-builder` | `swap-database-provider` | `dotnet build`/`dotnet test` pass on the new provider; migrate-on-startup creates the schema; prod smoke test passes on the new DB. |
| 11 — Release APK | `mobile-builder` | `build-android-apk` | EAS produces an APK; installed app signs in + runs the assessment against production. |

> **Reviewer gate:** after each phase, run the `reviewer` agent. It RUNS the build/test commands,
> checks the diff against the blueprint conventions and `gotchas.md`, and returns a
> merge / changes-requested verdict with file:line evidence. Do not advance on a red gate.

---

## 4. Building a NEW app from scratch

1. **Plan (Phase 0).** Fill `00-planning/project-charter.template.md` and `requirements.template.md`
   for `<APP_NAME>`. Run the `architect` agent to confirm/append ADRs and refresh
   `roadmap-and-phases.md` with concrete names. Decide the DB provider now (start on SQL Server to
   skip Phase 10).
2. **Scaffold the repo.** Copy from `05-templates/`: `Directory.Build.props`, `.gitignore`; create
   `Directory.Packages.props`; run `scaffold-clean-architecture`. Stand up backing services with
   `docker-compose.dev.template.yml`.
3. **Walk the phases 1 -> 11** in dependency order (§2), one driver agent + skill per phase (§3),
   gating on `checklist.md` each time. Use `prompts.md` to kick off each phase.
4. **Document** (`02-documentation/`) and hand off.

---

## 5. Migrating an EXISTING app onto the blueprint

The blueprint is shaped for an app whose **interactive domain logic** (scoring/calculation) can run
client-side, with the backend as the **system of record**. To migrate an existing app:

1. **Map the existing domain onto the reference shapes.**
   - List the existing app's core nouns and pick the **entities** (each -> `src/Domain/Entities`,
     inheriting `BaseAuditableEntity`; see `sample-entity.cs`).
   - List the operations and pick the **use cases** — one MediatR command/query per operation
     (`sample-usecase-command.cs` + validator + DTO). CRUD + the domain actions.
   - Identify the **numerically-sensitive engine** (the equivalent of Mabhas19's Section-19
     calculators). This is the highest-risk artifact.
2. **Port the logic into the shared package (single source of truth).**
   - Move the interactive engine into `packages/<CORE_PACKAGE>` as **pure TypeScript** (no
     framework deps), with `src/index.ts` exports and reference data tables. Use
     `setup-monorepo-shared-package`.
   - Port the **same** calculation into `Domain/Services` (a faithful port) **only** for the
     parts the backend must validate/store; keep the interactive scoring in the package/frontend.
   - **Write parity tests both ways:** package Vitest fixtures and Domain unit tests must produce
     **numerically identical** results to the legacy implementation. This gate protects the
     migration — get it green before building UI on top.
3. **Then follow the phases.** With entities, use cases, and the ported engine in hand, run the
   normal phase order (§2): expose CRUD (Phase 1), build the web shell + scoring UI (2-3), auth
   (4), the rest of the cross-cutting features (5-6), confirm the shared package (7), mobile (8),
   deploy (9), and a DB-provider swap if the legacy DB differs from the target (10, using
   `swap-database-provider`).
4. **Data migration (if carrying legacy data).** Map legacy rows to the new schema; remember
   assessment input/result are stored as **text columns** (`nvarchar(max)`), so JSON payloads are
   portable across providers. Re-run the full test suite + a prod smoke test after loading data.

> Migration invariants to preserve: domain-parity-first; **scoring in the frontend/shared package**
> with the backend as system of record; **central OIDC SSO** (OpenIddict IdP owns password/OTP/Google;
> the API is a JWT resource server with **no** `/api/Auth/*`; web is an Auth.js v5 OIDC client) + roles
> + the subscription account-gate (project cap removed — ADR-020); the strict build flags; the APK monorepo fixes scheduled as their own
> phase; and the image-transfer / existing-Traefik deploy that **never restarts the shared daemon**.

---

## 6. Deploy specifics (Phase 9) — the network-restricted server

The production server is in a network-restricted environment (`<SERVER_IP>`, under
`/srv/<PROJECT_NAME>`) where `mcr.microsoft.com` and Docker Hub's blob CDN are **blocked**, and it
runs **other production stacks**. The `devops-deployer` agent + `deploy-behind-traefik` skill own
this; the essentials:

- **Build `api`/`web` images locally** (where the base-image registry works), then
  `docker save | gzip` -> `pscp` -> `docker load` on the server. Do **not** build on the server.
- **Pull DB/MinIO base images via `<REGISTRY_MIRROR>`** (referenced directly in the server compose).
- **Attach to the existing external `traefik` network**; keep the `traefik.*` labels with cert
  resolver `<CERT_RESOLVER>`; hosts `<WEB_DOMAIN>` / `<API_DOMAIN>` / `<S3_DOMAIN>`.
- **MinIO is reached via its public host** with `UseSSL=true` so presigned report URLs are valid in
  browsers.
- **Recreate ONLY `api`/`web`** (and the **OIDC IdP** if it ships in this stack — `auth`);
  **never restart the shared Docker daemon**; leave the other stacks untouched.
- The API has **no** password/OTP/Google endpoints — those live in the **OIDC IdP**, which owns the
  user store. **Admin user / role seeding is IdP-side** (`AdminUser:Email/Password` is seeded by the
  IdP on startup), not by the API. The API just **migrates its own schema** on startup.
- Web runs **Auth.js v5** as the OIDC client (Authorization Code + PKCE, httpOnly session cookie);
  `lib/api-server.ts` uses `auth()` to attach the bearer token for **RSC server-prefetch**.
- Secrets come from `deploy/.env` (regenerated by `decrypt-env.sh`, never committed): DB, MinIO public
  host + SSL, the **OIDC client id/secret + authority**, and the admin user for the IdP.

See `checklist.md` for the exact deploy gate.
