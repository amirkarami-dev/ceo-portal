# plan_development — Build & Migrate Blueprint

This folder is a **reusable blueprint** for building a new application (or migrating an
existing one) using the **same architecture, conventions, and battle-tested build order**
as the reference project in this repo (**Mabhas19** — a full‑stack Clean‑Architecture
platform: .NET 10 API + Next.js 16 web + Expo mobile + a shared TypeScript engine,
SQL Server, MinIO, Docker/Traefik, fa‑IR/RTL, auth with password/OTP/Google,
subscriptions, and PDF reporting).

> **How to use it in one line:** open a new (or existing) repo, copy this `plan_development/`
> folder into it, and tell Claude:
> **“Read `plan_development/` and build (or migrate) `<APP_NAME>` following this blueprint.”**

It is self-contained: planning templates, development guides, documentation templates,
Claude **subagent** definitions, reusable **skills**, copy-ready **scaffolding templates**,
and a step-by-step **migration runbook**.

---

## What's inside

| Folder | What it gives you | Start here when… |
|---|---|---|
| **`00-planning/`** | The **base scaffold plan** (project-agnostic skeleton), charter + requirements templates, the reference tech stack & rationale, ADRs, the real phased **roadmap**, a task-breakdown template | You're starting the skeleton, or scoping a new app and deciding what to build, in what order |
| **`01-development/`** | "How to build it" guides per area (backend Clean Architecture, web, mobile, shared package, auth, i18n/RTL, storage/PDF, OTP, subscriptions), the **gotchas** list, and local **setup** | You're writing code and need the conventions + recipes ("how to add an entity / use case / endpoint") |
| **`02-documentation/`** | Templates for `README`, `CLAUDE.md`, an API reference, a self-contained **HTML guide**, and a Mermaid **diagram guide** | You're documenting the new project |
| **`03-agents/`** | Claude Code **subagent** definitions: `architect`, `backend-builder`, `frontend-builder`, `mobile-builder`, `devops-deployer`, `reviewer` | You want specialized agents to drive each phase |
| **`04-skills/`** | Reusable **`SKILL.md`** workflows: scaffold the solution, add a CQRS use case, add an endpoint group, set up the monorepo + shared package, build the Android APK, deploy behind Traefik, swap the DB provider | You're doing a recurring task and want the exact steps |
| **`05-templates/`** | Copy-ready scaffolding (`Directory.Build.props`, `.gitignore`, the 3 `docker-compose` files, both `Dockerfile`s, `eas.json`, `metro.config.js`, sample entity/use-case/DTO/endpoint) with `<PLACEHOLDER>` tokens | You're creating files and want a correct starting point |
| **`06-migration/`** | The **runbook** ("point Claude here to build/migrate"), a per-phase **checklist**, and ready-to-paste **prompts** | You're ready to actually execute |

```
plan_development/
├─ README.md                      ← you are here
├─ 00-planning/        (charter, requirements, tech-stack, ADRs, roadmap, task breakdown)
├─ 01-development/     (coding standards + per-area build guides + gotchas + setup)
├─ 02-documentation/   (README / CLAUDE.md / API / HTML guide / diagram templates)
├─ 03-agents/          (6 Claude Code subagent definitions)
├─ 04-skills/          (7 reusable SKILL.md workflows)
├─ 05-templates/       (copy-ready config + sample code, parametrized)
└─ 06-migration/       (runbook + checklist + phase prompts)
```

---

## How to start a NEW project with this blueprint

There are **two kickoffs** — run them in order. First the reusable skeleton, then this app's
features.

### Step 1 — Base project structure (the *basic* plan, same for every project)

Create an empty repo, copy `plan_development/` into it, and just tell Claude:

> **"Implement the base project structure according to `plan_development`."**

You get an **empty but running skeleton** — monorepo + .NET 4-layer API (`/scalar`) + web shell +
shared package + auth/docker/Traefik wiring, all placeholders, **no domain features**. This follows
**`00-planning/base-scaffold-plan.md`**; ready prompt: `06-migration/prompts.md` → **Base project
structure**.

### Step 2 — Project-specific build (the plan for *this* app)

With the skeleton green:

1. **Fill** `00-planning/project-charter.template.md` + `requirements.template.md` (target app,
   domain, any stack changes), and confirm the stack in `00-planning/tech-stack.md` /
   `architecture-decisions.md` (note swaps, e.g. a different DB or dropping mobile).
2. **Follow** `06-migration/migrate-runbook.md`, which walks the phased **roadmap**
   (`00-planning/roadmap-and-phases.md`), invoking the matching **agent** (`03-agents/`) and
   **skill** (`04-skills/`) per phase, and gating each with `06-migration/checklist.md`.
3. **Paste** the per-phase prompts from `06-migration/prompts.md` to drive Claude.

## How to MIGRATE an existing app onto this architecture

See `06-migration/migrate-runbook.md` → "Migrating an existing app": map the old domain
onto entities + use cases, **port the business/scoring logic into the shared TS package**
(with parity tests), then run the same phases. The old app becomes the requirements source.

---

## Conventions used throughout

- **`<PLACEHOLDER>` tokens** mark everything project-specific. The common ones:
  `<PROJECT_NAME>` (e.g. solution + namespaces), `<PROJECT_NAME>Db` (database),
  `@<SCOPE>/<CORE_PACKAGE>` (the shared package), `Add<PROJECT_NAME>Services` (DI extension),
  `<WEB_DOMAIN>` / `<API_DOMAIN>` / `<S3_DOMAIN>`, `<CERT_RESOLVER>`, `<REGISTRY_MIRROR>`,
  `<SERVER_IP>`, `<SA_PASSWORD>`, `<ROUTER_PREFIX>`. Each template lists its tokens
  (see `05-templates/README.md`).
- **Reference values** (the real Mabhas19 names) appear only as worked examples, never as
  defaults to copy blindly.
- **The reference project itself** is the live example — when a guide says "like the
  reference project", look at the actual code in this repo (and its root `CLAUDE.md`).

## The one decision to make before building

Pick your **reuse level** and **stack deltas** up front (record them in the charter):
- *Reuse level*: full platform (API + web + mobile + shared package) · backend-only ·
  web-only · API + web (no mobile), etc.
- *Stack deltas*: different database provider, different reverse proxy, open vs.
  restricted (blocked-registry) network, no PDF/SMS, etc.

Everything else follows the phased roadmap.

---

*Generated from the Mabhas19 reference project. If the reference code and a guide ever
disagree, trust the code — then update the guide.*
