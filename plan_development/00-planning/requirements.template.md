# Requirements — `<PROJECT_NAME>`

> Checklists you tick off as you build. Each box is a contract.
> Keep functional ("what it does") separate from non-functional ("how well").
> Mark items you cut as `~~struck through~~ (out of scope, see charter)`.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done & verified.

---

## A. Functional requirements

### A1. Core domain workflow
- [ ] The domain calculation is a **faithful port of `<reference source>`** and is covered by unit tests that assert numeric equality.
- [ ] The calculation lives in the **shared TS package** (`@<scope>/<core>`) and/or backend `Domain/Services`, with **one source of truth**.
- [ ] A user can run the workflow end to end and see a live result/score.
- [ ] Inputs and results are persisted per project (system of record = backend).

### A2. Projects & persistence
- [ ] Create / read / update / delete a `<Project>`.
- [ ] A project owns one or more `<Assessment>` records.
- [ ] Each assessment stores raw **input JSON**, **result JSON**, and denormalised **score(s)** (`TotalScore`/`MaxScore`).
- [ ] List shows only the signed-in user's projects (ownership enforced server-side).

### A3. Authentication (central OIDC SSO)
- [ ] Sign-in is delegated to a **central OIDC identity provider** (`<IdP host>`); the API does **not** issue its own tokens — it is a **JWT resource server** that validates the IdP's tokens (`authority=<IdP>`, `audience=<api>`).
- [ ] The IdP offers the sign-in methods (**username / password**, **mobile OTP**, **Google**); the resource API has **no** `MapIdentityApi` and **no** `/api/Auth/*` endpoints.
- [ ] **Web** signs in via **Auth.js** (generic OIDC, **Authorization Code + PKCE**), storing an **httpOnly session cookie** — **no tokens in `localStorage`**.
- [ ] **Mobile** signs in via PKCE (`expo-auth-session`), tokens in secure storage (`expo-secure-store`), **not** `localStorage`.
- [ ] Session survives a page refresh (resolved server-side from the session cookie); sign-out clears the session.
- [ ] *(cut any method the IdP doesn't offer and note it here)*

### A4. Roles & access control (RBAC)
- [ ] Roles seeded on startup: **`Administrator`** and **`User`** (default for new sign-ups).
- [ ] Admin-only endpoints gated server-side (`RequireRole(Administrator)` on `/api/Admin/*`).
- [ ] `GET /api/Users/me` returns `{ roles, isAdmin }`.
- [ ] Client hides admin UI unless `isAdmin` (defence in depth — server is the real gate).
- [ ] Admin can **list users** and **change a user's role / plan / active status**.

### A5. Subscriptions (account gate; project cap optional)
- [ ] Each user has a plan; `MaxProjects` is recorded but **not enforced** by default — active users create **unlimited** projects.
- [ ] An **active-account gate** runs **server-side** before project creation (`EnsureCanCreateProjectAsync`). To enforce a real cap, re-add a count check (opt-in — see `subscriptions.md` §5).
- [ ] An inactive account (or, if enabled, an exceeded cap) returns a **validation error surfaced under a `Subscription` field**, not a 500.
- [ ] Admin can change a user's plan / active status (`MaxProjects` is cosmetic unless enforcement is re-enabled).

### A6. Reports / PDF
- [ ] Server generates a **PDF from the stored result** (not from a live recompute).
- [ ] PDF renders the primary language correctly (font embedding for `<RTL/script language>`).
- [ ] PDF is uploaded to object storage and returned to the client as a **presigned URL**.
- [ ] Re-downloading an existing report does not regenerate unnecessarily *(or document that it does)*.

### A7. File / object storage
- [ ] An `IFileStorage` abstraction with an S3/MinIO implementation.
- [ ] Bucket auto-created/verified on startup.
- [ ] Presigned URLs are generated against the **public host** so browsers can open them.
- [ ] Object keys are namespaced (e.g. per user / per project) to avoid collisions.

### A8. Internationalisation / RTL *(if applicable)*
- [ ] Two locales: `<primary, RTL>` (default) + `<secondary, LTR>`.
- [ ] `localePrefix: "as-needed"` → default locale at `/`, secondary at `/<locale>/...`.
- [ ] Correct `<html lang dir>` per locale.
- [ ] All user-facing strings come from message catalogs, not hardcoded.
- [ ] Locale-aware navigation (`Link`/`useRouter` from the i18n nav module, not raw `next/link`).

### A9. Mobile app *(if applicable)*
- [ ] Expo app consumes the **same shared scoring package** as web.
- [ ] Sign-in works on device (tokens in secure storage, not localStorage).
- [ ] Core workflow + result are usable on a phone screen.
- [ ] A release **Android APK** can be produced.
- [ ] *(cut if mobile is out of scope)*

### A10. Admin area (UI)
- [ ] Admin route group, visible only when `isAdmin`.
- [ ] User list with plan/role and an edit action.
- [ ] Actions call `/api/Admin/*` and reflect server responses.

---

## B. Non-functional requirements

### B1. Architecture & code quality
- [ ] Clean Architecture layering respected: **Domain → Application → Infrastructure → Web** (dependencies point inward).
- [ ] Use cases are **CQRS** commands/queries (MediatR); inputs validated (FluentValidation).
- [ ] **Central package management** (`Directory.Packages.props`) — versions in one place.
- [ ] Build is **strict**: `TreatWarningsAsErrors=true` passes (audit-only advisories explicitly demoted, documented).
- [ ] Web **production build** (`npm run build`) passes; lint passes.

### B2. Security
- [ ] CORS restricted to known origins (no `*` with credentials).
- [ ] Security headers set (HSTS, X-Content-Type-Options, etc.).
- [ ] Rate limiting on auth/OTP endpoints.
- [ ] Secrets come from config/environment/secret store — **never committed**.
- [ ] OTP codes expire and are attempt-limited.
- [ ] AuthZ enforced on the server for every protected resource (client checks are cosmetic).

### B3. Reliability & data
- [ ] EF Core **migrations apply automatically on startup**; roles + admin user seeded idempotently.
- [ ] Health check endpoint exposed.
- [ ] DB provider is `<SQL Server | Postgres>`; large JSON stored as a **text column** (`nvarchar(max)` / `text`), not a provider-specific JSON type.
- [ ] No data loss on redeploy (volumes for DB + object storage).

### B4. Performance
- [ ] Interactive scoring runs **client-side** (instant feedback, no round-trips per keystroke).
- [ ] List/detail endpoints paginate or scope by owner (no unbounded queries).
- [ ] PDF generation is acceptable for a single request `<target, e.g. < 3s>`.

### B5. Observability
- [ ] Structured logging; OpenTelemetry/ServiceDefaults wired (if using Aspire).
- [ ] API docs served in dev (`/scalar` or equivalent).

### B6. Deployment & ops
- [ ] One-command local dev for backing services (DB + object storage via compose).
- [ ] Production runs in Docker Compose **attached to the existing reverse proxy** (`<Traefik network/cert resolver>`), not its own.
- [ ] Web image uses `output: "standalone"`; the public API base is baked at build time.
- [ ] **Image-transfer pipeline** documented if a registry/CDN is blocked (build locally → `docker save | gzip` → `pscp`/scp → `docker load`); backing images via an allowed mirror.
- [ ] Domains + TLS configured: `<web>`, `<api>`, `<storage>`.
- [ ] Redeploy does not disturb other stacks on a shared host.

### B7. Documentation
- [ ] `CLAUDE.md` (or README) documents commands, architecture, and gotchas.
- [ ] `.env.example` for web/mobile; required config keys listed.
- [ ] This requirements file kept in sync as scope changes.

---

## C. Mabhas19 reference (how the boxes were ticked)
- A1–A2: scoring engine in `@mabhas19/assessment-core` (6 checklist modules under `src/scoring`), mirrored by `Domain/Services` (`BuildingGroupCalculator`, `ClimateData`); `Assessment.InputJson`/`ResultJson` = `nvarchar(max)` + `TotalScore`/`MaxScore`.
- A3–A4: central OIDC SSO via the OpenIddict IdP `auth.myceo.ir` (password/OTP/Google live in `src/Auth`); the `src/Web` API is a JWT resource server (`AddJwtBearer`, `audience=mabhas19.api`); web uses Auth.js (httpOnly session cookie); roles `Administrator`/`User` come from the `role` claim; `/api/Admin/*` behind `RequireRole`. [ADR-013]
- A5: `ISubscriptionService.EnsureCanCreateProjectAsync` — active-account gate only; the project cap was removed (ADR-020), error under `Subscription`.
- A6–A7: `QuestPdfReportGenerator` + `MinioFileStorage`; presigned URLs against `s3.mabhas19.myceo.ir`.
- A8: next-intl `fa-IR` (default RTL) + `en-US`; `localePrefix: "as-needed"`.
- A9: Expo SDK 54 app consuming the shared package; release APK at `mobile/mabhas19.apk`.
- B6: `deploy/docker-compose.server.yml` attaches to external `traefik` network, cert resolver `myresolver`.
