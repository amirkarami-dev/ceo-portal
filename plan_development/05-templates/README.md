# 05 — Templates (copy-ready scaffolding)

Parametrized, copy-ready files derived from the reference project (**Mabhas19**). Each is valid
on its own; you copy it into the right place, drop the `.template` suffix where present, and
replace the `<PLACEHOLDER>` tokens. They cover the build config, the monorepo `.gitignore`, the
three Docker Compose files, the two Dockerfiles, the Expo build config, and minimal C# samples
for the backend conventions.

Read this alongside `plan_development/01-development/*` (the prose guides) and the
`04-skills/*` skills (which walk through *generating* these files). These templates are the
"already-correct" copies to start from.

---

## Files in this folder

| File | Copy to | What it is |
|------|---------|------------|
| `Directory.Build.props.template` | repo root `Directory.Build.props` | Shared build conventions: `net10.0`, `TreatWarningsAsErrors=true`, `WarningsNotAsErrors=NU1608;NU1902;NU1903`, `ArtifactsPath=./artifacts`, nullable + implicit usings. **No placeholders.** |
| `gitignore.template` | repo root `.gitignore` | Monorepo ignore set: `bin/obj`, `artifacts/`, `node_modules`, `web/.next`, generated `mobile/{android,ios}`, `*.apk/*.aab/*.zip`, `.env*.local`, secrets — **plus** the `**/[Pp]ackages/*` NuGet rule and the explicit re-include that rescues the shared TS workspace package. |
| `docker-compose.dev.template.yml` | `deploy/docker-compose.dev.yml` | Local dev backing services only: **SQL Server + MinIO**. API/web run on the host. |
| `docker-compose.local.template.yml` | `deploy/docker-compose.local.yml` | Full stack on localhost (sqlserver + minio + api + web), no proxy/TLS. |
| `docker-compose.server.template.yml` | `deploy/docker-compose.server.yml` | Production: attaches to an **existing external `traefik` network** with cert resolver `<CERT_RESOLVER>`; sqlserver (Express) + minio + **auth (OpenIddict OIDC IdP)** + api + web; Traefik labels for the four hosts; base images via `<REGISTRY_MIRROR>`; `auth`/`api`/`web` images loaded from transferred tars. |
| `Dockerfile.api.template` | `deploy/Dockerfile.api` | .NET SDK build -> aspnet runtime, with `fontconfig` (QuestPDF) and an optional script font for non-Latin PDFs. |
| `Dockerfile.web.template` | `deploy/Dockerfile.web` | Monorepo-aware Next.js standalone: scoped `npm install` that drops the `mobile` workspace, builds the shared-package consumer, `HOSTNAME=0.0.0.0`, copies the standalone monorepo layout (`server.js` under `web/`). |
| `eas.template.json` | `mobile/eas.json` | EAS `development` / `preview` (apk) / `production` (app-bundle) profiles; each `env` sets `EXPO_NO_METRO_WORKSPACE_ROOT=1` and `EXPO_PUBLIC_API_BASE`. |
| `metro.config.template.js` | `mobile/metro.config.js` | Monorepo Metro config (`watchFolders`, `nodeModulesPaths`) + the `resolveRequest` that forces a single `react`/`react-native`. **No placeholders.** |
| `sample-entity.cs` | `src/Domain/Entities/<Entity>.cs` | A `BaseAuditableEntity` with `required` fields; persistence config stays out of the entity. |
| `sample-usecase-command.cs` | `src/Application/<Feature>/Commands/<Name>/<Name>.cs` | A MediatR `[Authorize]` command + handler in one file, using `IApplicationDbContext` + `IUser`. |
| `sample-usecase-validator.cs` | `src/Application/<Feature>/Commands/<Name>/<Name>CommandValidator.cs` | An auto-discovered `AbstractValidator<T>` (-> 400 with field errors). |
| `sample-dto-with-mapping.cs` | `src/Application/<Feature>/<Entity>Dto.cs` | A DTO with a private nested `Mapping : Profile` (enum->string, navigation->bool via `.ForMember`). |
| `sample-endpoint-group.cs` | `src/Web/Endpoints/<Group>.cs` | An `IEndpointGroup` auto-mapped at `/api/{ClassName}`; static handlers, `TypedResults`, `Guard.Against.NotFound` in the query. |

---

## Placeholder tokens (what to replace, and where)

Use the **same tokens across the whole blueprint** so a single find/replace per token works. The
reference (Mabhas19) value is shown for orientation.

| Token | Meaning | Reference value | Appears in |
|-------|---------|-----------------|------------|
| `<PROJECT_NAME>` | Solution / assembly root **and** lowercase compose/image/bucket slug | `Mabhas19` / `mabhas19` | server + local + dev compose, both Dockerfiles |
| `<RootName>` | The .NET namespace root (same string as `<PROJECT_NAME>`) | `Mabhas19` | all four `sample-*.cs` |
| `<PROJECT_NAME>Db` | EF Core DB name **and** `ConnectionStrings__` key | `Mabhas19Db` | local + server compose |
| `<PROJECT_NAME>AuthDb` | The OIDC IdP's **own** DB name (separate from the app DB) | `Mabhas19AuthDb` | server compose (`auth` service) |
| `<PROJECT_NAME_UPPER>` | UPPER_SNAKE form for Auth.js env-var names | `MABHAS19` | server compose (`AUTH_MABHAS19_ISSUER/ID/SECRET`) |
| `<SCOPE>` | npm scope of the shared package | `mabhas19` | (referenced in Dockerfile.web comments / package config) |
| `<CORE_PACKAGE>` | Shared TS package dir under `packages/` | `assessment-core` | `gitignore`, `Dockerfile.web` |
| `<Feature>` | Application feature folder / endpoint group | `Projects` | `sample-usecase-*`, `sample-dto`, `sample-endpoint-group` |
| `<Entity>` | Domain entity / DTO base name | `Project` | `sample-entity`, `sample-usecase-command`, `sample-dto`, `sample-endpoint-group` |
| `<Group>` | PascalCase endpoint group = route segment | `Projects` | `sample-endpoint-group` |
| `<Name>` | A command/query name | `CreateProject` | `sample-usecase-command`, `sample-usecase-validator` |
| `<Owner>` | An owning/child aggregate entity | `Assessment` | `sample-entity`, `sample-dto` |
| `<SA_PASSWORD>` | SQL Server `sa` password (meets complexity rules) | *(secret)* | dev + local compose; server compose reads `${MSSQL_SA_PASSWORD}` from `deploy/.env` |
| `<CERT_RESOLVER>` | Cert resolver provided by the existing Traefik | `myresolver` | server compose |
| `<REGISTRY_MIRROR>` | Registry mirror reachable from the restricted server | `docker.arvancloud.ir` | server compose |
| `<ROUTER_PREFIX>` | Short unique Traefik router/service id prefix | `m19` | server compose |
| `<WEB_DOMAIN>` | Public web host | `mabhas19.myceo.ir` | server compose (`${WEB_DOMAIN}`) |
| `<API_DOMAIN>` | Public API host (also baked into the web image) | `api.mabhas19.myceo.ir` | server compose, `Dockerfile.web`, `eas.template.json` |
| `<AUTH_DOMAIN>` | Public OIDC IdP host (issuer / JWKS / login UI) | `auth.myceo.ir` | server compose (`${AUTH_DOMAIN}`) |
| `<S3_DOMAIN>` | Public MinIO/S3 host for presigned URLs | `s3.mabhas19.myceo.ir` | server compose (`${S3_DOMAIN}`) |
| `<SCRIPT_FONT>` | (optional) apt font for non-Latin PDF text | `fonts-vazirmatn` | `Dockerfile.api` |
| `<SERVER_IP>` | Production server address | `10.249.52.216` | not in these files — used in the deploy runbook (`06-migration/`) |

> Files marked **"No placeholders"** (`Directory.Build.props.template`, `metro.config.template.js`)
> are project-agnostic — copy them as-is.

### Secrets

Never hard-code real secrets. In `docker-compose.server.template.yml` every secret/host is a
`${VAR}` resolved from `deploy/.env` (e.g. `MSSQL_SA_PASSWORD`, `MINIO_ROOT_USER/PASSWORD`,
`ADMIN_EMAIL/PASSWORD`, the OIDC/Auth.js values `OPENIDDICT_CERT_PASSWORD`,
`WEB_CLIENT_SECRET`, `AUTH_SECRET`, and provider keys). That `deploy/.env` is
**not committed** — it is decrypted on the server from the committed `deploy/prod.enc.env` via SOPS+age
(`deploy/decrypt-env.sh`) before `compose up` (ADR-015). The dev/local compose files inline a
`<SA_PASSWORD>` for convenience only — change it and keep it out of any public history.

---

## Order of use

1. Repo scaffold: `Directory.Build.props.template`, `gitignore.template`, plus
   `Directory.Packages.props` (see `04-skills/scaffold-clean-architecture`). **Note:**
   `Directory.Packages.props` pins **MediatR to `12.5.0`** (Apache-2.0, the last free version — 13.0+
   requires a commercial license), so no license is needed. See ADR-002.
2. Backend conventions: the four `sample-*.cs` files when adding entities / use cases / endpoints.
3. Local run: `docker-compose.dev.template.yml` (then `docker-compose.local.template.yml` for the
   full containerized stack).
4. Mobile: `metro.config.template.js` + `eas.template.json`.
5. Deploy: `Dockerfile.api.template`, `Dockerfile.web.template`, `docker-compose.server.template.yml`
   (see `04-skills/deploy-behind-traefik` and the runbook in `06-migration/`).
