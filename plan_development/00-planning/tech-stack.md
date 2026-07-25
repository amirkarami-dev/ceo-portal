# Tech Stack — Reference (Mabhas19) blueprint

The exact stack the reference project uses, the **version pinned**, and **why** it was chosen.
A new project should adopt this verbatim unless its charter overrides a row. Versions are the
ones in `Directory.Packages.props`, `global.json`, and the `package.json` files at the time of writing.

---

## 1. Backend (.NET)

| Component | Version | Why this choice |
|-----------|---------|-----------------|
| .NET SDK | `10.0.201` (`global.json`, `rollForward: latestFeature`) | Latest LTS-track runtime; pinned so every machine/CI builds identically. |
| Target framework | `net10.0` | Single TFM across all projects (`Directory.Build.props`). |
| Solution format | `.slnx` (`Mabhas19.slnx`) | New XML solution format; cleaner diffs than `.sln`. |
| Clean Architecture base | Jason Taylor template + **.NET Aspire** | Battle-tested layering (Domain/Application/Infrastructure/Web) + Aspire AppHost/ServiceDefaults for orchestration, telemetry, health, resilience out of the box. |
| CQRS / mediator | **MediatR `12.5.0`** (Apache-2.0, free) | Thin command/query dispatch + pipeline behaviours (validation, logging). **Pinned to the last free version** — MediatR 13.0+ needs a commercial license; no license/replacement needed here. See ADR-002. |
| Validation | FluentValidation.DI `12.1.1` | Declarative request validators plugged into the MediatR pipeline. |
| Mapping | AutoMapper `16.1.1` | DTO↔entity mapping; profiles declared as nested `Mapping : Profile` inside DTOs. |
| ORM | EF Core `10.0.5` | Migrations applied on startup; `dotnet-ef` global tool **must match** EF Core 10. |
| Database | **Microsoft SQL Server** (`Microsoft.EntityFrameworkCore.SqlServer 10.0.5`, `Aspire.Hosting.SqlServer 13.2.0`) | Migrated from Postgres for ops parity with the target environment. Large JSON kept as `nvarchar(max)` (provider-portable), not a JSON column type. |
| Identity / auth | **Central OIDC SSO** — OpenIddict IdP (`src/Auth`, `auth.myceo.ir`) owns password/OTP/Google login + issues signed JWTs; web = **Auth.js v5** (generic OIDC, httpOnly cookie), mobile = **expo-auth-session** (PKCE); the API is a **JWT resource server** (`AddJwtBearer`, authority `auth.myceo.ir`, audience `mabhas19.api`). | Single sign-on across all `*.myceo.ir` services; the API validates JWTs via JWKS. Supersedes the per-app `MapIdentityApi` bearer model. See ADR-013 / ADR-017. |
| Google sign-in | `Google.Apis.Auth 1.68.0` | Server-side validation of Google ID-tokens. |
| Object storage client | `Minio 6.0.5` | S3-compatible client behind an `IFileStorage` abstraction. |
| PDF generation | **QuestPDF `2024.12.3`** | Code-first PDF with reliable embedded-font support (needed for RTL/Persian). |
| API surface | Minimal APIs + `Microsoft.AspNetCore.OpenApi 10.0.5` + **Scalar `2.13.13`** (`/scalar`) | Endpoint-group classes auto-mapped at `/api/{ClassName}`; Scalar for interactive docs. |
| Guard clauses | `Ardalis.GuardClauses 5.0.0` | `Guard.Against.NotFound(...)` → consistent 404s. |
| Telemetry | OpenTelemetry `1.15.x` (via Aspire ServiceDefaults) | Traces/metrics/logs; exporter advisories demoted to warnings (see below). |
| Resilience / discovery | `Microsoft.Extensions.Http.Resilience 10.4.0`, `Microsoft.Extensions.ServiceDiscovery 10.4.0` | Standard HTTP resilience handlers + service discovery from Aspire. |
| Secrets (prod) | `Azure.Identity 1.19.0`, `Azure.Extensions.AspNetCore.Configuration.Secrets 1.5.0` | Pluggable secret source; secrets never committed. |
| Testing | NUnit `4.5.1` + `NUnit3TestAdapter 6.2.0`, Moq `4.20.72`, Shouldly `4.3.0`, Respawn `7.0.0`, `Microsoft.AspNetCore.Mvc.Testing 10.0.5`, `Aspire.Hosting.Testing 13.2.0`, coverlet `8.0.1` | Unit (Domain/Application), integration (Infrastructure, Respawn to reset DB), functional (Aspire-hosted Web). |

**Build conventions (`Directory.Build.props` / `Directory.Packages.props`):**
- `ManagePackageVersionsCentrally=true` — **central package management**; every version lives in `Directory.Packages.props`, none in `.csproj`.
- `TreatWarningsAsErrors=true` — strict build. NuGet-audit advisories on transitive template packages are demoted via `WarningsNotAsErrors=NU1608;NU1902;NU1903` (documented, not silenced blindly).
- `ArtifactsPath=./artifacts` — output goes to `artifacts/`, not per-project `bin/obj`.
- `.NET 10` turns some deprecations into errors (e.g. use `KnownIPNetworks`, not `KnownNetworks`).

---

## 2. Web frontend (`web/`)

| Component | Version | Why this choice |
|-----------|---------|-----------------|
| Framework | **Next.js `16.2.6`** (App Router, `output: "standalone"`) | RSC + file routing; standalone output → small self-contained Docker image. |
| React | `19.2.4` / react-dom `19.2.4` | Matches Next 16. |
| i18n | **next-intl `^4.13.0`** | App-Router-native locales; `localePrefix: "as-needed"` → default locale at `/`. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss ^4`) | Utility CSS; v4 PostCSS pipeline. Design tokens as CSS variables (shadcn-style), emerald primary, light/dark. |
| Fonts | `@fontsource/vazirmatn ^5.2.8` | Self-hosted Persian/RTL webfont (no external CDN). |
| Lint | ESLint `^9` + `eslint-config-next 16.2.6` | Next's recommended rules. |
| Language | TypeScript `^5` | Strict types; shared package consumed as TS source. |
| Node engine | `>=20.9.0` | Build/runtime floor. |

`web/.env.local` sets `NEXT_PUBLIC_API_BASE` — **baked at build time**. `next.config.ts` keeps `output: "standalone"`, `transpilePackages: ["@<scope>/<core>"]`, and `outputFileTracingRoot` at the repo root (monorepo).

---

## 3. Mobile (`mobile/`)

| Component | Version | Why this choice |
|-----------|---------|-----------------|
| Platform | **Expo SDK `~54.0.0`** | Managed RN with EAS build; ships an APK without local Android toolchain pain. |
| Routing | expo-router `~6.0.0` (typed routes) | File-based routing mirroring the web mental model. |
| React Native | `^0.81.5`, React `19.1.0` | **New Architecture enabled** (`newArchEnabled: true` in `app.json`). |
| Secure storage | expo-secure-store `~15.0.0` | Tokens in the OS keystore (not localStorage). |
| Localization | expo-localization `~17.0.0` | Device locale → same i18n strategy as web. |
| Browser/auth | expo-web-browser `~15.0.0`, expo-linking `~8.0.0` | OAuth/Google redirect handling. |
| Config | expo-constants `~18.0.0` | `extra.apiBase` points at the prod API. |
| Build | EAS (`eas.json`) | Cloud build → release **APK**. |

Mobile depends on the shared package via `"@<scope>/<core>": "*"` and Metro is configured (`metro.config.js`) to resolve it from the monorepo root.

---

## 4. Shared workspace package (`packages/<core>`)

| Aspect | Choice | Why |
|--------|--------|-----|
| Name | `@<scope>/<core>` (ref: `@mabhas19/assessment-core`) | Scoped workspace package. |
| Form | **Pure TypeScript, shipped as source** (`main`/`module`/`types` → `./src/index.ts`) | No build step; web (`transpilePackages`) and mobile (Metro) compile it. One source of truth for the domain scoring engine. |
| Layout | `src/scoring/*` (the checklist modules + `types.ts`) and `src/data/*` (lookup tables) | Mirrors the backend `Domain/Services`; both are faithful ports of the legacy calculator. |
| Tests | Vitest `^2` | Fast unit tests asserting numeric parity. |

---

## 5. Monorepo & deployment

| Aspect | Choice | Why |
|--------|--------|-----|
| Monorepo | **npm workspaces** (`workspaces: ["packages/*","web","mobile"]`) | No extra tooling; one `node_modules`, simple `*` linking of the shared package. |
| Backend orchestration (dev) | .NET Aspire AppHost | Spins up SQL Server + MinIO + the API with wiring/telemetry. |
| Backing services (dev) | `deploy/docker-compose.dev.yml` | SQL Server (`sa`) + MinIO (`minioadmin`) only — enough to run the API locally. |
| Full local stack | `deploy/docker-compose.local.yml` | Everything in containers. |
| Production | `deploy/docker-compose.server.yml` | **Attaches to the host's existing Traefik** (external `traefik` network, cert resolver `myresolver` = ArvanCloud DNS-01) instead of running its own proxy. |
| Images | `deploy/Dockerfile.api`, `deploy/Dockerfile.web` | App images built **locally**. |
| Restricted-network delivery | `docker save \| gzip` → `pscp -pw` (PuTTY) → `docker load` | Target host (Iran) blocks `mcr.microsoft.com` + Docker Hub blob CDN. `postgres`/`minio` pulled via the **`docker.arvancloud.ir`** mirror. Do **not** restart the shared Docker daemon (other prod stacks run on it). |

---

## 6. How to swap parts

The blueprint is modular. Common substitutions and what they touch:

### Swap the database provider (SQL Server → PostgreSQL, or back)
- Replace the EF provider package (`Microsoft.EntityFrameworkCore.SqlServer` ↔ `Npgsql.EntityFrameworkCore.PostgreSQL`) and the `Aspire.Hosting.SqlServer` ↔ `Aspire.Hosting.PostgreSQL` package.
- Change the `UseSqlServer(...)` / `UseNpgsql(...)` call in `Infrastructure/DependencyInjection.cs` and the connection string.
- **Re-create migrations** (delete `Data/Migrations`, `dotnet ef migrations add Initial`). Providers generate different SQL.
- Update the DB service + volume in the compose files.
- **Keep large JSON as a text column** (`nvarchar(max)` / `text`) — this is provider-portable, so entity mapping needs no change. (Mabhas19 migrated Postgres→SQL Server exactly this way; see ADR-005 in `architecture-decisions.md`.)

### Drop the mobile app
- Delete `mobile/`; remove `"mobile"` from root `package.json` workspaces.
- The shared package and web are unaffected (web still `transpilePackages` it).
- Remove mobile-only items from requirements (A9) and the roadmap (phase 8) and the APK phase (11).

### Drop the shared package (web-only, no code sharing)
- If there's exactly one client and no mobile, you may fold the scoring engine into `web/src/features/...` and delete `packages/*` + `transpilePackages`.
- Trade-off: you lose the single-source-of-truth guarantee — only do this if mobile is permanently out of scope.

### Different reverse proxy (Traefik → Nginx/Caddy, or run your own)
- Replace the Traefik labels in `docker-compose.server.yml` with the equivalent for your proxy (or add a proxy service if the host has none).
- Set TLS/cert source for the new proxy; keep the three hostnames (web/api/storage).
- Everything else (images, app config) is unchanged.

### Object storage (MinIO → AWS S3 / other S3)
- Keep the `IFileStorage` abstraction and the `Minio` client (it speaks S3); just point endpoint/keys at the new bucket.
- Ensure **presigned URLs use a publicly reachable host** so browsers can open report links.

### Open network (no blocked registry)
- Skip the `docker save`/`load` + `pscp` dance: push images to any registry and `docker compose pull` on the host. Drop the `docker.arvancloud.ir` mirror references.
