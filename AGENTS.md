# AGENTS.md

Instructions for any AI coding agent working in this repository. **This file is the single
source of truth**; `CLAUDE.md` points here.

## Before you start — load the project context

**Read [`docs/ai/START-HERE.md`](docs/ai/START-HERE.md) first.** It is the entry point for any
assistant and points at:

- [`docs/ai/PROJECT-MAP.md`](docs/ai/PROJECT-MAP.md) — what exists, which app owns what, live URLs
- [`docs/ai/GOTCHAS.md`](docs/ai/GOTCHAS.md) — **traps that already cost hours; read in full**
- [`docs/worklog/`](docs/worklog/README.md) — what was done recently, and why
- [`docs/ai/OPERATIONS.md`](docs/ai/OPERATIONS.md) — build / deploy / verify on the server

**And when you finish a task, you MUST write `docs/worklog/YYYY-MM-DD-<slug>.md`**
from `docs/worklog/TEMPLATE.md`, add it to the worklog index, and update `GOTCHAS.md` /
`PROJECT-MAP.md` / `OPERATIONS.md` if the task taught something reusable. A task is not
finished until that file exists.

## What this is

This repo (`ceo-portal`) is a **Persian/RTL monorepo**: one .NET 10 Clean Architecture
backend + a central OIDC identity provider serving **several front ends**. The flagship app is
**Mabhas19 (مبحث ۱۹)** — Iran's National Building Code **Section 19, Appendix 5 (5th ed.)**
building‑energy assessment. For the app‑by‑app map and live URLs see
[`docs/ai/PROJECT-MAP.md`](docs/ai/PROJECT-MAP.md).

### Apps at a glance

| Folder | App | Stack |
|---|---|---|
| `src/` | API (all features) + `src/Auth` OIDC IdP | .NET 10 Clean Architecture |
| `mabhas19-web/` | Mabhas19 energy assessment | Next.js 16 |
| `mabhas19-mobile/` | Mabhas19 mobile app | Expo / React Native |
| `portal-web/` | MyCEO public service directory (`myceo.ir`) | Vite + React, no API/OIDC calls |
| `kurdnezam-web/` | Kurdnezam public site | Next.js (own `AGENTS.md`/`CLAUDE.md`) |
| `analytics-web/`, `admin-web/`, `landing-panel/`, `mun-sanandaj-web/`, `walfare-web/` | analytics / user admin / CMS / municipality / engineers' welfare | Vite SPAs (shared shape) |
| `packages/` | `assessment-core` (scoring), `ui`, `api-types` | shared TS packages |

Conventions for the five shared Vite SPAs — including the byte‑identical `AppSwitcher.tsx` rule —
live in [`.github/instructions/spa-frontends.instructions.md`](.github/instructions/spa-frontends.instructions.md).

## Commands

### Backend (.NET 10, solution `ceo-portal.slnx`)

```bash
dotnet build ceo-portal.slnx                                 # build all
dotnet run --project src/Auth                                # OIDC IdP on http://localhost:5100
dotnet run --project src/Web                                 # API on http://localhost:5000  (Scalar at /scalar)
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj   # one project
dotnet test --filter "FullyQualifiedName~ClimateDataTests"   # one test/class
```

**NuGet reachability on the dev machine is intermittent.** `docs/ai/GOTCHAS.md` records it as
blocked, but a full `dotnet build ceo-portal.slnx` **succeeded locally on 2026-07-27** (0 errors,
~9 s, 202 NuGet‑audit warnings) off the populated local package cache. So: try locally first; if
the *restore* fails, fall back to the server SDK container with the cached NuGet volume
([`docs/ai/OPERATIONS.md`](docs/ai/OPERATIONS.md)) — **never** change package versions to make a
restore pass.

Build output goes to `./artifacts/` (not `bin/obj`, via `ArtifactsPath` in `Directory.Build.props`).

EF Core migrations (the `dotnet-ef` global tool MUST match EF Core 10 — `dotnet tool update -g dotnet-ef --version "10.0.*"`):

```bash
dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```

Migrations are applied automatically on API startup (every environment) by
`ApplicationDbContextInitialiser`, which also seeds the `Administrator`/`User` roles and an admin
user from `AdminUser:Email`/`AdminUser:Password`.

### Front ends — dev servers and ports

`npm install` once per app (all nine are already installed). Ports are not arbitrary: the IdP's
registered redirect URIs and the API's CORS allow‑list are keyed to them.

| App | Dev command | Port |
|---|---|---|
| `mabhas19-web` | `npm --prefix mabhas19-web run dev` | 3000 |
| `kurdnezam-web` | `npm --prefix kurdnezam-web run dev -- -p 3100` | 3100 |
| `portal-web` | `npm --prefix portal-web run dev` | 5173 |
| `landing-panel` | `npm --prefix landing-panel run dev` | 5175 |
| `admin-web` | `npm --prefix admin-web run dev` | 5180 |
| `analytics-web` | `npm --prefix analytics-web run dev -- --port 5273 --strictPort` | 5273 |
| `mun-sanandaj-web` | `npm --prefix mun-sanandaj-web run dev -- --port 5274 --strictPort` | 5274 |
| `walfare-web` | `npm --prefix walfare-web run dev -- --port 5275 --strictPort` | 5275 |

**`walfare-web` and `admin-web` both pin 5180 in their `vite.config.ts`** — walfare needs the
explicit `--port 5275 --strictPort` override above or whichever starts second dies.

Before shipping any front end: `npm run build` **and** `npm run lint` (plus `npx vitest run` where
tests exist) must pass. `mabhas19-web/.env.local` bakes `NEXT_PUBLIC_API_BASE` at build time, and
`next.config.ts` must keep `output: "standalone"` for the Docker image.

Preview configs for all of the above live in `.claude/launch.json`.

## Local development

The local stack is **not** started from `deploy/docker-compose.dev.yml` — the running containers
predate its `name: ceo-portal-dev` project rename:

| What | Container | Holds |
|---|---|---|
| SQL Server, port 1433 | `ceo-portal-sql-local` (plain `docker run`, volume `mabhas19_sqldata`) | `CeoDb` + `CeoAuthDb` |
| MinIO, ports 9000/9001 | `mabhas19-dev-minio-1` (volume `mabhas19-dev_miniodata_dev`) | report bucket |

> **Do not run `docker compose -f deploy/docker-compose.dev.yml up -d` against this machine.**
> Its project name (`ceo-portal-dev`) no longer matches the running containers' (`mabhas19-dev`),
> so Compose creates **new empty** volumes and then collides on ports 1433/9000. Same trap as the
> production Compose rename — see [`docs/ai/GOTCHAS.md`](docs/ai/GOTCHAS.md).

Start order: `src/Auth` (5100) → `src/Web` (5000) → front ends. Credentials and connection strings
for local runs are in `src/Web/appsettings.Development.json` and
`src/Auth/appsettings.Development.json`.

**Don't run all ten dev servers at once.** Eight Node dev servers (Next.js ~1–2 GB each, Vite
~0.3–0.6 GB each) plus two `dotnet` processes plus SQL Server will exhaust a 32 GB machine — it
froze one on 2026-07-27. Run the API, the IdP, and only the front end you are working on. Two caps
are now in place and must stay:

- SQL Server `max server memory` = **2048 MB** (`sp_configure`, persisted in `master`). Its default is *unlimited* and it never releases what it takes.
- WSL2 = **8 GB + 4 GB swap** via `~/.wslconfig` (`memory`, `swap`, `autoMemoryReclaim=gradual`). Without that file WSL2 helps itself to half the host's RAM.

Containerising the front ends does **not** help: on Windows they would run in the same WSL2 VM,
adding overhead and forcing polled file watching.

`analytics-web` runs fully mocked locally (`VITE_AUTH_MODE=mock`, `VITE_USE_MOCK_API=true` in
`.env.development`). To point it at the real local IdP you must also add a `Clients:AnalyticsWeb`
block to `src/Auth/appsettings.Development.json` — `AuthDbInitialiser` **skips** seeding the
`analytics-web` and `walfare-web` clients entirely when their redirect URI is unconfigured.

## Architecture

### Backend layering (`src/`, Jason Taylor Clean Architecture template + .NET Aspire)

- **Domain** — entities (`Project`, `Assessment`, `Subscription`, `AssessmentReport`) and the Section 19 calculators in `Domain/Services`: `BuildingGroupCalculator` and `ClimateData`. **These are faithful ports of the legacy JS calculator — keep them numerically identical; they're covered by unit tests.**
- **Application** — CQRS use cases (MediatR), FluentValidation validators, AutoMapper profiles (defined as nested `Mapping : Profile` classes inside DTOs). Service contracts live in `Application/Common/Interfaces`.
- **Infrastructure** — EF Core + **Microsoft SQL Server** and the implementations: `MinioFileStorage` (IFileStorage), `QuestPdfReportGenerator` (IReportGenerator), `SubscriptionService`, `UserAdminService`, `NezamMohandesiProjectProvider`, `IranKishGateway`. Auth is **JWT bearer validation** (`AddJwtBearer`) against the central OIDC IdP.
- **Web** — Minimal‑API endpoints. Each `IEndpointGroup` class is auto‑mapped at **`/api/{ClassName}`**; handler names are globally unique. The API is a **JWT resource server** — **no `MapIdentityApi`**. The DI extension lives in `Infrastructure/DependencyInjection.cs` → `AddMabhas19Services`.
- **Auth** (`src/Auth`) — the OpenIddict identity provider, its own database, the only token issuer.

### Key architectural decision: where scoring lives

The interactive **6‑checklist scoring engine runs in the FRONTEND**. The pure scoring logic lives
in the shared package **`@mabhas19/assessment-core`** (`packages/assessment-core`, no React,
vitest‑tested); the UI in `mabhas19-web/src/features/assessment` renders it. The **backend is the
system of record**: `Assessment.InputJson`/`ResultJson` are stored as SQL Server **`nvarchar(max)`**
plus denormalised `TotalScore`/`MaxScore`, and the PDF is generated from the stored result. So
scoring changes go in `packages/assessment-core/*` (math) / `mabhas19-web/src/features/assessment/*`
(UI), **not** the backend.

### Auth & roles — central OIDC SSO

- Auth is a **central OIDC Identity Provider** (OpenIddict, app `src/Auth`, own **`CeoAuthDb`**). All sign‑in methods — username/password, **mobile OTP**, **Google ID‑token**, and کد ملی + SMS for welfare — live in the IdP, the sole token issuer. The API (`src/Web`, database **`CeoDb`**) is a **JWT resource server** (`AddJwtBearer`, authority = `auth.myceo.ir`, `RoleClaimType="role"`, `NameClaimType="name"`); it has **no `MapIdentityApi` / no `/api/Auth/*`**.
- **`ceo.api` is the canonical OAuth resource/audience**; `mabhas19.api` is still accepted as a transitional scope/audience until old browser and mobile bundles age out. `ceo.api` is a resource name, not a host.
- **Web** signs in with **Auth.js v5** generic OIDC (Authorization Code + PKCE, httpOnly session cookie); the **Vite SPAs** use `oidc-client-ts` (PKCE); **mobile** uses **expo-auth-session** (PKCE, expo-secure-store).
- Roles: **`Administrator`** (manage users + subscriptions) and **`User`** (default). `/api/Admin/*` is gated with `RequireRole(Administrator)`; `GET /api/Users/me` returns `{ roles, isAdmin }`.
- **Subscriptions** — every user gets a Free plan, but the per‑user project cap is **no longer enforced** (active users create **unlimited** projects). `ISubscriptionService.EnsureCanCreateProjectAsync` only throws a `ValidationException` (under the `Subscription` field) when the account is **inactive**; `MaxProjects` is retained for admin display only. **User‑facing subscription UI is hidden** — admins still manage plans under `/api/Admin/*`.

### Mabhas19 front-end structure (`mabhas19-web/src`)

- Next.js App Router under `app/[locale]`. **i18n via next-intl**: `fa-IR` (default, **RTL**) + `en-US` (LTR), `localePrefix: "as-needed"` → fa is served at `/`, en at `/en/...`. The real `<html lang/dir>` + providers are in `app/[locale]/layout.tsx`.
- Route groups: **root `/` = public landing page** (`components/landing/*`); `(auth)` = public login (redirects to the IdP); `(dashboard)` = **protected server-side** — `middleware.ts` does a session-cookie presence gate, and `(dashboard)/layout.tsx` (Server Component) resolves identity via `auth()` and seeds `<AuthProvider initialUser>`. The admin area (`admin/users`) is gated by `(dashboard)/admin/layout.tsx` (server). **No client `<RequireAuth>`.**
- **Design system**: shadcn‑style CSS variable tokens in `app/globals.css` (emerald primary) with light/dark via `components/theme-provider.tsx`. Shared UI primitives in `components/ui` — **keep its export surface stable (restyle, don't rename)** since every page imports from it.
- Data layer is **TanStack Query + RSC server-prefetch** (`lib/queries.ts` hooks; `lib/api-server.ts` prefetches read pages via `auth()`). API layer in `lib/`: `api.ts` (fetch wrapper; attaches the bearer from Auth.js `getSession()`), `endpoints.ts`, `auth-context.tsx` (`useAuth` → `{ user, roles, isAdmin, ready, logout }`, **server-seeded**, no `me` fetch). Tokens are an **httpOnly Auth.js session cookie** — `lib/tokens.ts` / localStorage are **gone**. Use locale‑aware `Link`/`useRouter` from `@/i18n/navigation`, not `next/link`.

## Gotchas

Runtime and data traps — Iran Kish, `SqlParameter`, `ProblemDetails`, Jalali dates, AntD
responsiveness, the five‑copy app launcher, Compose volume renames — are in
[`docs/ai/GOTCHAS.md`](docs/ai/GOTCHAS.md). **Read it in full before debugging anything.**
The build‑time traps that live only here:

- **Build is strict**: `TreatWarningsAsErrors=true`. NuGet‑audit advisories on transitive template packages (`OpenTelemetry`, `System.Security.Cryptography.Xml`) are demoted to warnings via `WarningsNotAsErrors` (`NU1608;NU1902;NU1903`) in `Directory.Build.props`. .NET 10 also turns deprecations into errors (e.g. use `KnownIPNetworks`, not `KnownNetworks`).
- **`ValidationException` is ambiguous** between `FluentValidation.ValidationException` (a global using) and the app's `Application.Common.Exceptions.ValidationException` — alias the app one when using it.
- **Aspire namespace clash**: the `Mabhas19.Application.Projects` namespace shadows Aspire's generated global `Projects` namespace in functional tests — qualify as `global::Projects.TestAppHost`.
- **MediatR** is pinned to free **12.5.0** (Apache‑2.0) in `Directory.Packages.props` — 13+ needs a commercial license, so don't bump it. **AutoMapper** uses the same vendor model but its license is **accepted** (stays on 16.x).
- **Don't wrap next-intl in Auth.js's `auth()` middleware.** Behind Traefik it rebases next-intl's `/`→`/fa` rewrite to an absolute URL the standalone server proxies → `EAI_AGAIN` (it broke the fa site in prod). Keep next-intl owning the response; gate with a cookie-presence check; do role checks server-side (RSC `auth()`).
- Use `Guard.Against.NotFound(...)` (Ardalis) for 404s; `ForbiddenAccessException` → 403 (see `ProblemDetailsExceptionHandler`).

## Deployment

Full procedure — host paths, the deploy loop, verification commands, log triage, and the variable
table — is in [`docs/ai/OPERATIONS.md`](docs/ai/OPERATIONS.md). Read it before touching production.
The rules that are never negotiable:

- **Build one service at a time.** The host has 4 GB; parallel image builds get killed.
- **Never restart the shared Docker daemon or Traefik.** Other production stacks run there.
- **Only rebuild what changed** — *plus every SPA that embeds a changed shared component*. Deploying the API alone is not enough.
- **Production state is in the explicitly named volumes `ceo-portal_mssqldata` and `ceo-portal_miniodata`.** Changing a Compose project `name:` silently repoints implicit volumes; never use `down -v`.
- **No CI** — push to `main` and verify yourself. **Never commit secrets**: real values live in `deploy/.env` (committed encrypted as `deploy/prod.enc.env`, regenerated by `deploy/decrypt-env.sh`). Reference the *variable name* in docs, never the value.
