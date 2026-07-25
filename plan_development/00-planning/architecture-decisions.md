# Architecture Decisions (ADRs) — Reference (Mabhas19) blueprint

These ADRs capture the load-bearing choices distilled from the reference project. A new project
built from this blueprint inherits them by default. To deviate, copy the ADR, set **Status: Superseded
by ADR-XXX**, and write the new one — don't silently diverge.

Each ADR: **Context** (forces in play) · **Decision** (what we chose) · **Consequences** (good + bad, and what it costs you).

---

## ADR-001 — Clean Architecture layering (Domain / Application / Infrastructure / Web)
**Status:** Accepted

**Context.** The domain (a regulated building-code calculation) must stay correct and testable for years, independent of frameworks, DB, or delivery mechanism. The team is small and needs a layout that scales without becoming a ball of mud.

**Decision.** Use the Jason Taylor Clean Architecture template (+ .NET Aspire). Dependencies point inward: `Web → Application → Domain` and `Infrastructure → Application/Domain`. Domain has no framework references. Service contracts live in `Application/Common/Interfaces`; their implementations live in `Infrastructure` and are wired in `Infrastructure/DependencyInjection.cs` (`Add<App>Services`).

**Consequences.**
- (+) Domain is pure and unit-testable; swapping DB/storage touches only Infrastructure.
- (+) Clear home for every kind of code → low onboarding cost.
- (−) More projects/indirection than a single API project; small features cross several layers.
- (−) Template ships extras (telemetry, sample code) you must prune.

---

## ADR-002 — CQRS use cases via MediatR + FluentValidation pipeline
**Status:** Accepted — pinned to last free version (12.5.0) as of 2026-06-03

**Context.** We want each use case isolated, with cross-cutting concerns (validation, logging) applied uniformly, and thin endpoints.

**Decision.** Model every use case as a MediatR command/query handler. Validation runs as a pipeline behaviour using FluentValidation; mapping uses AutoMapper profiles declared as nested `Mapping : Profile` classes inside the DTOs. Endpoints just send the request.

**Resolution (2026-06-03).** MediatR 13.0+ (owned by jbogard + LuckyPennySoftware) requires a commercial license for production. To remove this release-blocker `Directory.Packages.props` was pinned to **MediatR 12.5.0** (Apache-2.0, released 2025-04-01), the last version published before the commercial-license change. `MediatR.Contracts` stays at 2.0.1 (Apache-2.0) — it is a dependency of MediatR 12.5.0 and unaffected. The `LuckyPennySoftware.MediatR.License: None` log-filter suppressor was removed from `appsettings.json`. Zero API changes were required; the 12.x → 14.x public surface is backward-compatible for all patterns used here (`IPipelineBehavior<,>`, `IRequestPreProcessor<>`, `AddOpenBehavior`, `AddOpenRequestPreProcessor`, `ISender`, `IMediator`, `INotification`).

**Forward options (choose before next major upgrade):**
1. **Purchase a MediatR v14+ commercial license** from mediatr.io — restores access to the latest features and security fixes.
2. **Migrate to `Mediator` (martinothamar/Mediator, MIT, source-generated)** — zero runtime overhead, no license cost, but requires replacing `AddMediatR`/`ISender`/`IPipelineBehavior` registrations with the Mediator equivalents (a medium-effort, low-risk refactor).

MediatR 12.5.0 is actively maintained on the Apache-2.0 branch but will not receive new features. Treat it as a **maintained-but-older stopgap** until one of the options above is executed.

**Consequences.**
- (+) Endpoints stay tiny; behaviours give consistent validation/error shaping.
- (+) Each handler is independently testable.
- (+) Commercial-license requirement removed — no blocker for go-live.
- (−) Indirection — a request hops through the mediator before reaching logic.
- (−) Pinned to 12.5.0 — won't receive MediatR 13/14 feature additions; must eventually migrate or license.

---

## ADR-003 — The interactive scoring engine runs in the FRONTEND
**Status:** Accepted

**Context.** The assessment is an interactive, multi-checklist form where the score updates as the user types. Round-tripping every keystroke to the server is slow and chatty. The original logic already existed as a legacy React/JS calculator.

**Decision.** Run the scoring engine **client-side**. The backend is the **system of record only**: it stores the raw **input JSON**, the computed **result JSON**, and denormalised **scores** — it does not run the interactive scoring. The PDF is rendered from the *stored* result.

**Consequences.**
- (+) Instant feedback; no server load per keystroke; offline-capable computation on mobile.
- (+) Faithful reuse of the proven legacy algorithm.
- (−) The authoritative computation lives outside the backend, so the server trusts client-submitted results. Acceptable here (not a security boundary — the score is the user's own assessment), but **must be reconsidered** for any flow where the score gates money or access.
- (−) Backend cannot recompute; if the algorithm changes, historical stored results are frozen as-was (often desirable for audit).

---

## ADR-004 — A shared TS package is the single source of truth for the engine
**Status:** Accepted

**Context.** Two clients (web + mobile) must compute identical scores. Copy-pasting the engine guarantees drift.

**Decision.** Extract the engine into a pure-TypeScript workspace package `@<scope>/<core>` (ref: `@mabhas19/assessment-core`), **shipped as source** (no build step). Web compiles it via `transpilePackages`; mobile via Metro from the monorepo root. Backend `Domain/Services` mirrors it as a faithful port, and both sides are locked by parity unit tests.

**Consequences.**
- (+) One place to change the algorithm; both clients update together.
- (+) No publish/build/versioning ceremony — it's just TS in the repo.
- (−) Consumers must be configured to transpile raw TS (Next `transpilePackages`, Metro resolver tweaks).
- (−) Two ports exist (TS engine + backend Domain mirror); they must be kept in sync by tests, not by sharing code across the language boundary.

---

## ADR-005 — Store assessment input/result as TEXT columns, not jsonb / native JSON
**Status:** Accepted

**Context.** Inputs/results are large, evolving JSON blobs the backend never queries *into*; it only stores and returns them whole. The project also migrated DB providers (Postgres → SQL Server).

**Decision.** Persist `InputJson`/`ResultJson` as a plain **large-text column** (`nvarchar(max)` on SQL Server; `text` on Postgres) plus denormalised scalar columns (`TotalScore`/`MaxScore`) for listing/sorting.

**Consequences.**
- (+) Provider-portable — the same mapping survived the Postgres→SQL Server migration unchanged.
- (+) Simple; no JSON-operator coupling to one database.
- (−) Cannot query inside the JSON in SQL (acceptable — we never need to). If you later need server-side JSON queries, revisit.

---

## ADR-006 — Bearer-token auth with three sign-in methods on one Identity scheme
**Status:** Superseded by ADR-013 (central OIDC SSO) for multi-service deployments

**Context.** Users sign in by password, **mobile OTP**, or **Google ID-token**. We want one consistent session model across web and mobile and don't want to hand-roll JWT issuance.

**Decision.** Use ASP.NET Identity with `MapIdentityApi` (bearer tokens) under `/api/Users/*`. OTP (`/api/Auth/otp/*`) and Google (`/api/Auth/google`) flows **issue the same Identity bearer tokens** by setting `signInManager.AuthenticationScheme = IdentityConstants.BearerScheme` then `SignInAsync`. Clients store tokens (web: localStorage with auto-refresh in the API layer; mobile: secure store) and refresh transparently.

**Consequences.**
- (+) One token model for every sign-in path and both clients.
- (+) Leverages Identity's user store, hashing, refresh.
- (−) Bearer-in-localStorage on web has an XSS exposure surface (mitigated by CSP/headers; mobile uses secure store).
- (−) Custom OTP/Google flows must carefully reuse the bearer scheme; easy to get subtly wrong.

---

## ADR-007 — Roles + server-side quota; client checks are cosmetic
**Status:** Accepted — the per-user **project-quota** portion is **superseded by ADR-020** (cap removed); the roles + server-side admin-gating portion still stands.

**Context.** Two roles (`Administrator`, `User`) and a per-user project cap (Free = 5). Authorization must not be bypassable from the client.

**Decision.** Seed roles + an admin user on startup (idempotent, from config). Gate admin endpoints with `RequireRole(Administrator)`. Enforce quota **server-side** in the service layer (`EnsureCanCreateProjectAsync`), throwing a validation error surfaced under a `Subscription` field. The client merely *hides* admin UI (via `useAuth().isAdmin`) and shows the quota message.

**Consequences.**
- (+) Security decisions live on the server; the UI can't grant access it shouldn't.
- (+) Quota errors are typed field errors, not 500s — clean UX.
- (−) Some logic is duplicated for UX (client hides what the server also forbids).
- (−) "Subscription" exists as enforcement only — **no billing**; adding real payments is a later, separate effort.

---

## ADR-008 — Server-rendered PDF (QuestPDF) stored in S3/MinIO, served via presigned URLs
**Status:** Accepted

**Context.** Users need an official, printable report in an RTL/Persian script. Client-side PDF struggles with embedded fonts and consistency.

**Decision.** Generate the PDF on the server with **QuestPDF** from the *stored* result (ADR-003), upload it to **MinIO (S3)** behind an `IFileStorage` abstraction, and return a **presigned URL** generated against the **public storage host** so browsers can open it directly.

**Consequences.**
- (+) Consistent, font-correct PDFs; storage decoupled via the abstraction (swap MinIO↔S3 freely).
- (+) Large files don't stream through the API on download.
- (−) Presigned URLs must target a publicly reachable host (prod uses `s3.<domain>` with SSL), or browser links break.
- (−) QuestPDF community-license terms apply at scale — check before commercial go-live.

---

## ADR-009 — npm-workspaces monorepo (web + mobile + shared package)
**Status:** Accepted

**Context.** Web, mobile, and the shared engine must live and version together with minimal tooling for a small team.

**Decision.** Use **npm workspaces** (`packages/*`, `web`, `mobile`). The shared package is linked with `"*"`. No Turborepo/Nx/pnpm — plain npm.

**Consequences.**
- (+) Zero extra tooling; one install; trivial local linking of the shared package.
- (+) Atomic commits across engine + both clients.
- (−) No built-in task graph/caching (fine at this size; revisit if builds slow down).
- (−) Hoisting can surprise React Native — Metro needs explicit monorepo-root resolution.

---

## ADR-010 — Deploy behind the host's EXISTING Traefik, in a restricted network
**Status:** Accepted

**Context.** The production server already runs Traefik for other stacks (mailcow, supabase) and is in Iran, where `mcr.microsoft.com` and Docker Hub's blob CDN are **blocked**. We must not disturb the existing stacks.

**Decision.** The production compose **attaches to the existing `traefik` external network** (cert resolver `myresolver`, ArvanCloud DNS-01) rather than starting its own proxy. App images are **built locally**, exported with `docker save | gzip`, transferred via PuTTY `pscp -pw`, and `docker load`-ed on the host. Backing images (`postgres`/`minio`) are pulled via the **`docker.arvancloud.ir`** mirror. The shared Docker daemon is **never restarted**.

**Consequences.**
- (+) One proxy/cert setup for the whole host; no port conflicts; other stacks untouched.
- (+) Reproducible deploys despite blocked registries.
- (−) Manual image-transfer step (slower than `docker pull`); needs the `save/load` discipline.
- (−) Tight coupling to that host's Traefik labels/network names; portability to a fresh host needs the proxy recreated (see "swap reverse proxy" in `tech-stack.md`).

---

## ADR-011 — Expo with the React Native New Architecture
**Status:** Accepted

**Context.** We want a maintainable RN app aligned with RN's future, buildable to an APK without a heavy local toolchain.

**Decision.** Use **Expo SDK 54** with **`newArchEnabled: true`**, expo-router (typed routes), and EAS for the release build. Tokens go in `expo-secure-store`; config (`extra.apiBase`) points at the prod API.

**Consequences.**
- (+) Future-proof (Fabric/TurboModules); EAS produces an APK without local Android SDK pain.
- (+) Shares routing mental model and the scoring package with web.
- (−) Some older RN libraries are incompatible with the New Architecture — vet dependencies.
- (−) Native debugging is harder than on the legacy bridge.

---

## ADR-012 — Central package management + artifacts output + strict build
**Status:** Accepted

**Context.** Version drift across many .NET projects is a common rot source; we want one place to bump versions and a build that fails on real problems.

**Decision.** Turn on **central package management** (`Directory.Packages.props`, no versions in `.csproj`). Set `TreatWarningsAsErrors=true`, demoting only specific, understood NuGet-audit advisories via `WarningsNotAsErrors=NU1608;NU1902;NU1903`. Redirect build output to `./artifacts` via `ArtifactsPath`.

**Consequences.**
- (+) Single source of truth for versions; strict build catches issues early; clean repo (no scattered `bin/obj`).
- (−) Every new package needs an entry in `Directory.Packages.props` (intentional friction).
- (−) Demoted advisories must be revisited when upstream fixes land (documented in the props file).

---

## ADR-013 — Central OIDC Identity Provider for cross-service SSO
**Status:** Accepted — **deployed to production 2026-06** (supersedes ADR-006). The web client's auth boundary is refined by **ADR-017**.

**Context.** The product grows from one app into a portal of services under `*.myceo.ir` (e.g. `mabhas19`, `plan`, …). Users must log in once and move between services without re-authenticating. ADR-006's `MapIdentityApi` bearer tokens are app-local (DataProtection-encrypted, validatable only by the issuing app) and stored per-origin in `localStorage`, so they cannot be shared across services — they don't support SSO.

**Decision.** Stand up a dedicated **OpenIddict** OIDC Identity Provider as its own app (`src/Auth`, `auth.myceo.ir`) with its **own database** (`Mabhas19AuthDb`); migrate existing users into it **preserving their IDs**. It owns all login methods (password/OTP/Google) and issues **signed JWT access tokens** (encryption disabled, JWKS-published). Every service becomes an **OIDC client**: `mabhas19` web via **Auth.js** (httpOnly cookie), mobile via **expo-auth-session** (PKCE), and the `mabhas19` API becomes a **resource server** validating JWTs via stock `AddJwtBearer`. The token shape is a **frozen contract** (see `01-development/sso-oidc.md` §4). Built and integrated wave-by-wave (IdP+API → clients → infra) to prevent contract drift; production cutover is a separate gated step.

**Consequences.**
- (+) True SSO across all `*.myceo.ir` services; new services join by registering a client — no per-service auth code.
- (+) Single source of truth for identity; httpOnly cookies remove the web localStorage XSS exposure.
- (+) Standard, federable JWTs that any service validates independently via JWKS.
- (−) A new app, database, container, and Traefik route to build/operate; login UI moves out of the polished Next.js page into the IdP.
- (−) One-time user migration (IDs/password-hashes preserved) and a careful production cutover.
- (−) Admin user-management must move to the IdP (flagged follow-up); the IdP's signing key must be persisted (not ephemeral).

---

## ADR-014 — Trunk-based: push directly to `main`, no CI
**Status:** Accepted (2026-06-04)

**Context.** A solo owner ships this project. The template shipped a GitHub Actions CI (build/test/lint gate on branches/PRs). For one operator who verifies locally, that gate adds latency/maintenance without catching anything a local run wouldn't.

**Decision.** **Remove the CI workflow** (commit `607db97`); push directly to `main`. Verify locally before pushing: `dotnet build`/`dotnet test` (warnings-as-errors), `npm run build`/`lint`, the `@mabhas19/assessment-core` vitest suite. Use **short-lived feature branches** for risky multi-commit work, merged to `main` after local verification.

**Consequences.**
- (+) Simpler; no CI cost/maintenance; fastest path for one person.
- (−) No automated gate — the discipline is manual; a skipped local check can land on `main`.
- (−) Anything CI would have done (e.g. image CVE scan) becomes a **manual pre-deploy step**.

---

## ADR-015 — Production secrets via SOPS + age (server-less, git-committed encrypted)
**Status:** Accepted (2026-06-03)

**Context.** The single-server compose deploy reads a `.env` of prod secrets (DB/MinIO/admin/SMS/OIDC). That file previously lived only as plaintext on the server — unversioned, un-backed-up. The server cannot reach GitHub (Iran), so a tool that needs network at deploy time is out.

**Decision.** Encrypt the deploy secrets with **SOPS + age** (no secrets server — right-sized). Commit **`deploy/prod.enc.env`** (each value AES-256-GCM). **`deploy/decrypt-env.sh`** regenerates the git-ignored `deploy/.env` on the server at deploy time. **`.sops.yaml`** holds the age **public recipient**. The age **private key lives only on the server** (`/srv/mabhas19/secrets/age.key`, `chmod 600`) with an off-server backup; `sops`/`age` binaries were **hand-transferred** to `/srv/mabhas19/bin`.

**Consequences.**
- (+) Secrets are versioned + backed up safely in git; repeatable decrypt; nothing extra to run/secure.
- (−) The age private key is the single recovery point — it **must** be backed up off-server.
- (−) Changing a secret is a server-side `sops` edit → recommit `prod.enc.env` → redeploy.

---

## ADR-016 — Frontend data layer: TanStack Query + bounded RSC prefetch
**Status:** Accepted (2026-06-03)

**Context.** The dashboard hand-rolled `useState`/`useEffect` fetches per page — no caching, duplicated loading/error state, `set-state-in-effect` lint debt. We wanted the 2026-standard data layer without disturbing the backend system-of-record (ADR-003) or the interactive scoring.

**Decision.** Adopt **TanStack Query v5** for all client reads + mutations (mutations invalidate the relevant query keys). Add **RSC server-prefetch + `HydrationBoundary`** on the read pages via a server-side fetch (`lib/api-server.ts` using `auth()`), so they render server-first with a warm cache. Components consume the **tested pure scorers** from `@mabhas19/assessment-core` (ADR-004) instead of duplicating the math inline. The backend remains the system of record (ADR-003 unchanged).

**Consequences.**
- (+) Caching/dedup/background refetch; the fetch-in-effect boilerplate (and its lint disables) is gone; scoring is now test-backed via the shared package.
- (−) One added dependency; a second (server-side) fetch path to maintain (`api-server.ts`).
- (−) RSC's first-paint benefit was initially capped by the client auth gate — **fully unlocked by ADR-017**.

---

## ADR-017 — Server-side auth boundary (middleware gate + identity from the OIDC token + RSC role gate)
**Status:** Accepted — **in-flight on `feat/server-auth-ssr`**; deployed to production for owner verification, pending merge.

**Context.** Under ADR-013, web auth was still **client-side** (`SessionProvider` + `useSession` + a client `<RequireAuth>`), which caused an auth flicker and blocked true SSR of the private dashboard.

**Decision.** Move route protection to the **Edge middleware** as a cheap **session-cookie presence gate** (`next-intl` owns the response). Lift identity (`role`/`email`/`name` → `isAdmin`) from the OIDC token into the **Auth.js session JWT** at sign-in; resolve it **server-side** in the dashboard layout (Server Component) and seed `<AuthProvider initialUser>` — no client `/api/Users/me` fetch. Gate **`/admin`** in a **Server Component layout** via `auth()`. **Remove** the client `<RequireAuth>`. Keep the client session only for the API bearer token. **Hard constraint:** do **NOT** wrap `next-intl` in Auth.js's `auth()` middleware helper — behind Traefik (`AUTH_TRUST_HOST` + `AUTH_URL`) it rebases the `/`→`/fa` rewrite to an absolute URL the standalone server proxies (`EAI_AGAIN`), breaking the default-locale site (learned in production; see `gotchas.md`).

**Consequences.**
- (+) No auth flicker; true SSR-first; protection enforced before render; admin gate server-side; identity without an extra round-trip.
- (−) Sessions minted before the change lack the new role claim → users (esp. admins) must **re-login once**.
- (−) The middleware presence-gate is a **UX gate, not validation** — real validation stays at the API JWT layer + the RSC `auth()` checks.

---

## ADR-018 — AutoMapper licensing accepted as a non-blocker
**Status:** Accepted (2026-06-03) — contrast ADR-002 (MediatR pinned to free)

**Context.** AutoMapper 16.x uses the same vendor commercial-license model as MediatR (last free = 12.x). The roadmap previously tracked "resolve before go-live."

**Decision.** The owner **accepts** the AutoMapper commercial-license terms as a **non-blocker**. Stay on **16.x**; no migration to Mapperly, no pin to 12.x. (Unlike MediatR, which was pinned to free 12.5.0 in ADR-002.)

**Consequences.**
- (+) No mapping refactor; keep the current `Mapping : Profile` API.
- (−) A commercial-license obligation is **accepted** for production use of AutoMapper; revisit if terms/cost change.

---

## ADR-019 — ArvanCloud CDN posture: proxy the web, DNS-only for api/auth/s3
**Status:** Accepted (2026-06-03)

**Context.** All domains sit behind ArvanCloud. A CDN/proxy in front of dynamic/auth/storage endpoints breaks things: cached authenticated responses, **broken MinIO presigned-URL signatures** + large uploads, and ACME/cert + OIDC round-trip issues. Container DNS for the proxied IdP host is also intermittently flaky (`EAI_AGAIN`).

**Decision.** Keep the CDN **ON** (orange) **only** for `mabhas19.myceo.ir` (static web — edge cache + DDoS). Set **`api.*` / `auth.*` / `s3.*` to DNS-only** (grey). Keep the **`auth.myceo.ir → 185.143.234.234` IP pin** (`extra_hosts` on web + api) so Auth.js/JWKS resolution is deterministic; update only if the edge IP rotates.

**Consequences.**
- (+) Web gets edge caching/DDoS; dynamic/auth/storage avoid CDN-induced breakage; deterministic IdP resolution.
- (−) The IP pin is a manual fragility (rotate ⇒ update `extra_hosts`).
- (−) Web behind the CDN needs cache-busting discipline on deploys.

---

## ADR-020 — Remove the per-user project cap; subscription becomes an account gate
**Status:** Accepted (2026-06-04) — supersedes the project-quota portion of ADR-007

**Context.** The Free plan capped projects at 5 (ADR-007). The product decision is to neither limit nor advertise plans: hide all user-facing subscription UI (landing pricing, dashboard nav/cards, the `/subscription` page) and let users create projects freely. Keeping the cap while hiding the upgrade path would trap users at 5 with no recourse.

**Decision.** Drop the project-count check in `EnsureCanCreateProjectAsync`; it now throws only when the account is **inactive** (`IsActive == false`). `MaxProjects` stays on the `Subscription` record for **admin display only** (not enforced). The subscription entity, `GET /api/Subscriptions/me`, and the admin `/api/Admin/users/{id}/subscription` tools are **kept** — only the user-facing UI is removed. Logic-only change (no DB migration), so existing users with a stored cap are freed immediately.

**Consequences.**
- (+) Users create unlimited projects; no dead-end at a hidden paywall.
- (+) No schema/data migration; reversible (re-add the count check — see `subscriptions.md` §5).
- (−) Admin's per-user `MaxProjects` field is now cosmetic; the `IsActive` toggle is the real gate.
- (−) The "subscription quota" stays a documented blueprint pattern but is no longer the live default (docs frame it as opt-in).
