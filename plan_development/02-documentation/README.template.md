# `<PROJECT_NAME>`

> Project README template, derived from the reference project (Mabhas19).
> Replace every `<PLACEHOLDER>`. Delete the guidance in *italics* and any rows/sections you don't ship.

`<PROJECT_NAME>` (`<PROJECT_NAME_LOCALIZED>`) — *one sentence a stakeholder understands, e.g.* `<a full-stack app that runs the X assessment, stores each project's result, and produces an official PDF report>`.

It has three parts that all share one domain engine:

- A **web app** (Next.js) for desktop use.
- A **mobile app** (Expo / React Native) for phones.
- A **backend API** (.NET) that stores all data and is the system of record.

The interactive domain logic (scoring/calculation) runs in the **frontend**, in a shared TypeScript package both clients import. The backend stores inputs, results, and scores, and renders the PDF. See `plan_development/01-development/shared-package.md` for why.

---

## Tech stack

| Area | Technology |
|------|------------|
| Backend | .NET 10, C# — Clean Architecture (Domain / Application / Infrastructure / Web) + .NET Aspire |
| Backend patterns | MediatR (CQRS), FluentValidation, AutoMapper |
| Database | Microsoft SQL Server via EF Core 10 (`<PLACEHOLDER>Db`) |
| Auth | OIDC SSO via a central IdP (OpenIddict); web Auth.js v5 generic OIDC (Auth Code + PKCE); mobile expo-auth-session; API validates IdP JWTs |
| Object storage | MinIO (S3-compatible) — stores generated PDF reports |
| PDF | QuestPDF (community license) |
| Web | Next.js 16 (App Router, `output: "standalone"`), React 19, Tailwind CSS v4 |
| Web i18n / fonts | next-intl (`<PRIMARY_LOCALE>` default + `<SECONDARY_LOCALE>`), `<WEBFONT>` |
| Mobile | Expo SDK 54, React Native, expo-router, expo-secure-store |
| Shared package | `@<SCOPE>/<CORE_PACKAGE>` — pure TypeScript domain engine, no framework deps |
| Monorepo | npm workspaces (`packages/*`, `web`, `mobile`) |
| Deploy | Docker Compose, behind an existing Traefik reverse proxy (TLS via `<CERT_RESOLVER>`) |

---

## Monorepo layout

```
<repo-root>/
  src/                         # .NET backend, Clean Architecture layers
    Domain/                    #   entities, enums, domain calculators
    Application/               #   CQRS use cases, validators, mapping
    Infrastructure/            #   EF Core + SQL Server, Identity, MinIO, SMS, ...
    Web/                       #   Minimal-API endpoints (auto-mapped at /api/{ClassName})
  web/                         # Next.js 16 web app (App Router)
  mobile/                      # Expo / React Native app
  packages/<CORE_PACKAGE>/     # shared TypeScript domain engine + reference data
  deploy/                      # Docker Compose files, Dockerfiles, fonts, env templates
  <PROJECT_NAME>.slnx          # .NET solution
```

The solution file is `<PROJECT_NAME>.slnx`. Build output goes to `./artifacts/` (not per-project `bin/obj`).

---

## Local setup

### 0. Prerequisites

- **.NET 10 SDK** (pinned via `global.json`).
- **Node.js >= 20.9**.
- **Docker** (for SQL Server + MinIO).
- **Mobile only**: Android SDK + JDK 17, Expo CLI (via `npx`).

Install JS dependencies once from the **repo root** (npm workspaces hoists web / mobile / packages):

```bash
npm install
```

### 1. Start backing services (SQL Server + MinIO)

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```

Runs only **SQL Server** (`sa`) and **MinIO** (`minioadmin`) — the two services the API needs. MinIO console at `http://localhost:9001`; SQL Server on `1433`.

### 2. Backend (.NET 10)

```bash
dotnet build <PROJECT_NAME>.slnx          # build all (output -> ./artifacts/)
dotnet run --project src/Web              # API on http://localhost:5000 (docs at /scalar)
dotnet test                               # all tests
```

On startup the API **applies migrations and seeds** automatically: it creates the `Administrator`/`User` roles and an admin user from `AdminUser:Email`/`AdminUser:Password`.

### 3. Web (Next.js 16)

```bash
cd web && npm install      # or: npm install at the repo root
npm run dev                # http://localhost:3000
npm run build              # production build (must pass before deploy)
npm run lint
```

Create `web/.env.local`:

```
NEXT_PUBLIC_API_BASE=http://localhost:5000
# Auth.js v5 generic OIDC provider (central IdP):
AUTH_<PROJECT>_ISSUER=https://<AUTH_DOMAIN>
AUTH_<PROJECT>_ID=<oidc-client-id>
AUTH_<PROJECT>_SECRET=<oidc-client-secret>
AUTH_URL=https://<WEB_DOMAIN>     # https; the app's own public base URL
AUTH_TRUST_HOST=true              # required behind a reverse proxy
```

`NEXT_PUBLIC_API_BASE` is **baked at build time**. The `AUTH_*` vars configure the Auth.js generic OIDC provider that points at the central IdP. Keep `output: "standalone"` in `next.config.ts` for the Docker image.

> **Deployment caution:** behind a reverse proxy, do **not** wrap `next-intl` in Auth.js's `auth()` middleware helper. With `AUTH_TRUST_HOST` + `AUTH_URL` set, `auth()` rebases next-intl's default-locale rewrite (e.g. `/`→`/<PRIMARY_LOCALE>`) to an absolute URL the standalone server then proxies (`EAI_AGAIN`), breaking the default-locale site. Use a plain session-cookie-presence check in middleware and resolve roles server-side (in an RSC via `auth()`), not in middleware.

### 4. Mobile (Expo)

```bash
cd mobile
npm run start              # Metro dev server (Expo Go / dev client)
npm run android            # build & run on a device/emulator (needs Android SDK)
npm run typecheck
```

Set `EXPO_PUBLIC_API_BASE` to reach the API from a physical device (e.g. your machine's LAN IP, `http://192.168.x.x:5000`).

---

## Deployment (summary)

Three Docker Compose files in `deploy/`:

| File | What runs | Use |
|------|-----------|-----|
| `docker-compose.dev.yml` | SQL Server + MinIO only | Local dev; API/web run on host |
| `docker-compose.local.yml` | SQL Server + MinIO + API + web | Full stack on localhost, no proxy |
| `docker-compose.server.yml` | All four, attached to existing Traefik | Production |

Production attaches to the host's **existing Traefik** (external network, cert resolver `<CERT_RESOLVER>`). App images (`api`, `web`) are built where the base-image registry is reachable, then transferred to the server with `docker save | gzip` -> transfer -> `docker load`; backing images are pulled via `<REGISTRY_MIRROR>`.

**Live domains:**

| Domain | Purpose |
|--------|---------|
| `<WEB_DOMAIN>` | Web (Next.js) |
| `<API_DOMAIN>` | Backend API |
| `<S3_DOMAIN>` | MinIO S3 (presigned PDF links) |

See `plan_development/01-development/` and the deployment guide for full details.

---

## Links

- **API docs (Scalar):** `http://localhost:5000/scalar` in dev, `https://<API_DOMAIN>/scalar` in prod.
- **Developer & system guide:** `docs/<PROJECT_NAME>-guide.html` (self-contained HTML with diagrams).
- **Project instructions for AI tools:** `CLAUDE.md`.
- **API reference:** `plan_development/02-documentation/api-reference.template.md`.
- **Plan & development notes:** `plan_development/`.

---

> *This blueprint is based on the reference project **Mabhas19** (Iran National Building Code, Section 19 Appendix 5 energy assessment). Where this template says `<PLACEHOLDER>`, the reference value is shown in the development docs under `plan_development/`.*
