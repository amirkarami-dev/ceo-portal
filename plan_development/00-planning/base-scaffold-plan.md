# Base project structure (starter scaffold)

This is the **basic, project-agnostic plan**: the steps that build an **empty but running
skeleton** for a new app on this blueprint — *before* any domain features. It is the same for
every project. Use it when you say:

> **"Implement the base project structure according to `plan_development`."**

(Ready prompt: `06-migration/prompts.md` → **Base project structure**.)

When the skeleton runs, switch to the **project-specific plan** to build the real app.

> **Two plans, one blueprint:**
> - **This file = the *basic* plan** — the reusable skeleton (no domain). Same for every project.
> - **`roadmap-and-phases.md` = the *project-specific* plan** — the real features for *this* app,
>   driven by your filled `project-charter.template.md`.

---

## 0. One decision first

Pick your **reuse level** and **stack deltas** (record them in the charter — see `README.md` →
"The one decision to make before building"):

- Reuse level (default): **API + web + shared TS package**. Add **mobile** and the **production
  server deploy** as their own later phases; drop a layer you don't need.
- Stack deltas: different DB provider, no PDF/SMS, open vs. blocked-registry network, etc.

The base structure below is the foundation for whatever you picked — **placeholders only, no
business logic**.

## 1. What the skeleton contains (no domain yet)

- **Monorepo**: npm workspaces (`packages/*`, `web/`, optional `mobile/`).
- **.NET 10 solution**: the 4 Clean-Architecture layers (`Domain` / `Application` /
  `Infrastructure` / `Web`) that build and serve `/scalar`, with the strict-build conventions —
  but **no entities, use cases, or endpoints** beyond the cross-cutting plumbing.
- **Shared TS package** (`packages/<CORE_PACKAGE>`): empty engine + a passing vitest, wired into
  the web build.
- **Web app** (`web/`): Next.js shell — i18n (default locale + RTL if needed), the design-token
  layer, and the auth client — **landing + login only, no feature pages**.
- **Auth wiring**: the API is a **JWT resource server** (validates the IdP's tokens) exposing only
  `GET /api/Users/me`; the web signs in via the OIDC client. No domain gating yet.
- **Local infra**: `docker-compose.dev` (DB + MinIO), the `web`/`api` `Dockerfile`s, and the
  Traefik labels — enough to run locally and to deploy later.
- **Project docs**: `CLAUDE.md` + `README` generated from the templates.

## 2. Steps (each reuses an existing skill / template / guide)

Do these in order. Every step points at the doc that already has the details — **don't duplicate
it, follow it**.

1. **Repo + monorepo** — npm workspaces layout. → `01-development/shared-package.md`, `setup.md`.
2. **.NET solution + 4 layers + build conventions** — `Directory.Build.props` /
   `Directory.Packages.props`, `IEndpointGroup` auto-mapping, the ProblemDetails handler.
   → skill `04-skills/scaffold-clean-architecture/SKILL.md` + `05-templates/`.
3. **Shared TS package** — empty `src` + vitest; `transpilePackages` in `next.config`.
   → `01-development/shared-package.md`.
4. **Web app shell** — Next.js App Router, next-intl, design tokens, UI primitives; landing +
   login only. → `01-development/frontend-web.md`, `i18n-rtl.md`.
5. **Auth as a JWT resource server** — `AddJwtBearer` against the IdP, `GET /api/Users/me`, the
   web OIDC client. → `01-development/auth-and-roles.md`, `sso-oidc.md`.
6. **Local infra + deploy wiring** — `docker-compose.dev` (DB + MinIO), the `Dockerfile`s, the
   Traefik labels. → `05-templates/` (`docker-compose.*.template.yml`, the `Dockerfile`s),
   `01-development/file-storage-pdf.md` (MinIO).
7. **Project docs** — fill `CLAUDE.md` + `README` from `02-documentation/*.template.*`.

(Mobile and the production server deploy are **not** part of the base skeleton — they are their
own phases in `roadmap-and-phases.md`.)

## 3. Done when (verify — evidence, not assumptions)

- [ ] `dotnet build <PROJECT_NAME>.slnx` passes with `TreatWarningsAsErrors=true`.
- [ ] `dotnet run --project src/Web` serves `/scalar`; `GET /api/Users/me` exists.
- [ ] `npm run build` (web) passes; the home + login pages render; the default locale / RTL is correct.
- [ ] `npm test -w packages/<CORE_PACKAGE>` passes (the empty engine).
- [ ] `docker compose -f deploy/docker-compose.dev.yml up -d` brings up the DB + MinIO.
- [ ] **No domain code yet** — no business entities, use cases, or feature pages.

## 4. Next → the project-specific plan

With the skeleton green, fill `00-planning/project-charter.template.md` +
`requirements.template.md`, then build the real app by following
`00-planning/roadmap-and-phases.md` (per-phase agents + skills, gated by
`06-migration/checklist.md`). Paste the **Project-specific build** prompts from
`06-migration/prompts.md`.
