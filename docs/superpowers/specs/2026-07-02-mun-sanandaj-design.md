# mun-sanandaj integration service — design

> **Date:** 2026-07-02 · **Status:** approved (design greenlit) · **Author:** Amir + Claude

## Goal

Automate two recurring (every 12h) synchronization jobs between the read-only **KurdNezam**
SQL Server database (Sanandaj municipality's engineering-body system) and the Sanandaj
municipality's **mahyapardaz** REST API (supervising-engineer PDF reports, and building
engineer-assignment maps), persist a full audit trail of every attempt, and give an admin a
live web dashboard (`mun-sanandaj.myceo.ir`) to watch runs happen and inspect history.

## Non-goals

- No changes to the Section 19 building-energy assessment domain (Project/Assessment/etc.).
- No new database server — everything lives in the existing `Mabhas19Db` on the `185.206.94.116`
  stack, using EF Core migrations like every other feature in this backend.
- No push-based real-time transport (SignalR/WebSockets) — the dashboard polls.
- No general-purpose external-integration framework — this is a `MunSanandaj`-specific feature
  with hardcoded stored-procedure names, endpoint URLs, and field mappings (they're municipality
  contracts, not something to abstract over).

## Architecture

New bounded feature `MunSanandaj`, added to the **existing** Clean-Architecture backend
(`src/Domain`, `src/Application`, `src/Infrastructure`, `src/Web`) and deployed as part of the
**same `api` container** on the `185.206.94.116` stack (`deploy/docker-compose.newserver.yml`) —
same `Mabhas19Db`, same central OIDC IdP (`auth.myceo.ir`), same Traefik.

```
KurdNezam SQL Server (185.10.73.114, read-only login)
   │  sp1: WebS_GetListRepToShahrdari
   │  sp2: WebS_GetReportFullInfo @TraceCode
   ▼
IMunSanandajSourceReader (Infrastructure/MunSanandaj/Sql)
   │
   ▼
IMunSanandajSyncService (Application/MunSanandaj) ──uses──> IMunSanandajGatewayClient (Infrastructure/MunSanandaj/Http)
   │                                                             │  saveEngineerReport / saveEngMap / addEngineer
   │                                                             ▼
   │                                                    mahyapardaz REST API
   │                                                    (185.172.68.98, eeshahr.sanandaj.ir)
   ▼
mun_sync_runs / mun_report_logs  (Mabhas19Db, via ApplicationDbContext)
   ▲
   │  polled every ~5s while a run is active
mun-sanandaj-web (new Vite/React/AntD SPA @ mun-sanandaj.myceo.ir)
   │  OIDC (central IdP, Administrator role only)
   ▼
src/Web MunSanandaj endpoints (Runs, Logs, trigger)
```

Two `BackgroundService`s (`SaveEngineerReportWorker`, `SaveEngMapWorker`) each wrap a
`PeriodicTimer` (12h) and call the *same* `IMunSanandajSyncService` methods that the admin
"run now" endpoint calls — the timer is just a trigger, all business logic lives in one place.

## Data model

Two new tables in `Mabhas19Db`, both `BaseAuditableEntity` (gets `Created`/`CreatedBy`/
`LastModified`/`LastModifiedBy` for free), added to `ApplicationDbContext`.

### `mun_sync_runs` — one row per worker execution

| Column | Type | Notes |
|---|---|---|
| `Id` | `int` (PK) | |
| `RunId` | `Guid` | Public identifier used by the frontend/API (indexed, unique) |
| `WorkerType` | `string` (enum: `SaveEngineerReport`, `SaveEngMap`) | |
| `StartedAt` | `DateTimeOffset` | |
| `CompletedAt` | `DateTimeOffset?` | null while running |
| `Status` | `string` (enum: `Running`, `Completed`, `Failed`) | `Failed` = the run itself crashed (e.g. sp1 unreachable), not "some rows failed" |
| `TotalRows` | `int` | rows returned by sp1 for this run |
| `SuccessCount` | `int` | |
| `FailedCount` | `int` | |
| `TriggeredBy` | `string` (enum: `Timer`, `Manual`) | + `TriggeredByUser` (`string?`, admin email, when `Manual`) |

### `mun_report_logs` — one row per attempt at posting a single source row

Append-only: every attempt (including retries on a later run) inserts a **new** row; never
updated in place. "Current status of a Peygiri" = its latest row by `CreatedAt`.

| Column | Type | Notes |
|---|---|---|
| `Id` | `int` (PK) | |
| `RunId` | `int` (indexed, references `mun_sync_runs.Id` by convention — no DB-level FK constraint, since RunId is always set from an in-memory run just persisted) | |
| `WorkerType` | `string` | denormalized copy of the run's type, for simpler queries |
| `Peygiri` | `string` | tracking code from sp1 (e.g. `90038565090216074508`) |
| `ProjectNo` | `string` | `darkhast_id` |
| `ReqId` | `string` | `melk_id` |
| `Nosazi` | `string?` | pass-through from sp1, not otherwise used |
| `Status` | `string` (enum: `Success`, `Failed`) | |
| `AttemptNumber` | `int` | 1-based count of attempts at this `(WorkerType, Peygiri)` across all runs |
| `RemoteSubmissionId` | `string?` | the `peigiri` value the endpoint returns on success |
| `ResponseBody` | `string?` (`nvarchar(max)`) | raw JSON response, for debugging |
| `ErrorMessage` | `string?` | |
| `CreatedEngineerCodes` | `string?` | comma-separated `code_meli` values auto-created via `addEngineer` during this attempt (SaveEngMap only) |
| `StartedAt` | `DateTimeOffset` | |
| `CompletedAt` | `DateTimeOffset` | |

Index: `(WorkerType, Peygiri, CreatedAt DESC)` — used both to compute "latest status per Peygiri"
and to decide, at the start of a run, which rows already succeeded (skip them) vs. need
(re)attempting.

## External systems

### KurdNezam SQL Server (read-only)

New config key `ConnectionStrings:KurdNezamDb` (env `ConnectionStrings__KurdNezamDb`), same
pattern as `FarsNezamDb`/`AnalyticsDb` — placeholder empty in `appsettings.json`, real value only
via env/`.env` on the server, never committed. Accessed via raw `SqlConnection`/`SqlCommand`
(`CommandType.StoredProcedure`), matching the existing `SqlQueryEngine` style — no new ORM/Dapper
dependency.

- **sp1** `[dbo].[WebS_GetListRepToShahrdari]` — no parameters. Returns rows: `Peygiri`,
  `ProjectNo`, `Nosazi`, `ReqId`. Called by both workers, independently, once per run.
- **sp2** `[dbo].[WebS_GetReportFullInfo] @TraceCode = N'{Peygiri}'` — called once per sp1 row by
  `SaveEngMapWorker` only. Returns one row per assigned engineer: `Ozviat`, `ShomarehNezam`,
  `FName`, `LName`, `TarikhSodur`, `TarikhTamdid`, `TarikhPayanEtebar`, `PesronTyp`, `NationalId`,
  `Mob`, `Payeh_Nezarat_Temp`, `Major`. (A Peygiri may have more than one assigned engineer —
  the worker iterates every row sp2 returns.)

### PDF fetch

`GET https://eservice.kurdnezam.ir/sm/pdf/{ProjectNo}.pdf` → bytes → base64. If the PDF 404s
(not generated yet), the row's attempt is logged `Failed` with `ErrorMessage = "pdf not found"`
and retried on the next 12h run (no special-casing needed beyond the normal retry-forever policy).

### mahyapardaz REST API

Bearer token auth (`Authorization: Bearer {token}`), config key `MunSanandaj:ApiToken`
(env `MunSanandaj__ApiToken`) — the token value pasted in chat goes only into `deploy/.env`
on the server, never committed (redacted here — see chat history / rotate before go-live).
Called via a typed `HttpClient` registered **without** Aspire's default resilience handler (same
fix already applied to `ArvanReportAiService` — base64 PDF uploads over a slow municipal link
would otherwise hit the 10s default per-attempt timeout) — a 120s timeout instead.

**`saveEngineerReport`** — `POST https://185.172.68.98/cakephp/mahyapardaz/services/restapi?method=saveEngineerReport&darkhast_id={ProjectNo}&melk_id={ReqId}`

```json
{ "supervising_engineers_report": { "file": "data:image/jpg;base64,..." } }
```
Success: `{ "supervising_engineers_report": { "success": true, "peigiri": 2583267 } }` →
`Status=Success`, `RemoteSubmissionId="2583267"`.

**`saveEngMap`** — `POST https://185.172.68.98/cakephp/mahyapardaz/services/restapi?method=saveEngMap&darkhast_id={ProjectNo}`

```json
{
  "engineers": [ { "code_meli": "3732087395", "branch": 1, "task": 2 } ],
  "engReport": { "file": "data:image/jpeg;base64,..." }
}
```
- `branch` = the engineer's `PesronTyp` (sp2) as-is; `task` hardcoded `1`.
- Two failure shapes to handle:
  - Top-level `{ "error": "..." }` (e.g. bad `darkhast_id`) → whole attempt `Failed`.
  - Per-engineer `{ "engineers": { "<code_meli>": { "success": false, "msg": "مهندس یافت نشد..." } } }`
    → trigger the `addEngineer` fallback (below) for that `code_meli`, then re-POST `saveEngMap`
    for the same row **once** more.
- Success shape: `{ "engineers": {...}, "files": { "building": { "success": true, "peigiri": N } } }`
  → `Status=Success`, `RemoteSubmissionId` from `files.building.peigiri`.

**`addEngineer`** — `POST https://eeshahr.sanandaj.ir/cakephp/mahyapardaz/services/restapi?method=addEngineer`
(note: **different host** from `saveEngMap`/`saveEngineerReport`).

Field mapping from the sp2 row (`// map from X` comments are authoritative over the example
literal values in the source spec; `// set hard code to Y` values are literal constants):

| addEngineer field | Source |
|---|---|
| `first_name` | sp2 `FName` |
| `last_name` | sp2 `LName` |
| `father_name` | hardcoded `"none"` |
| `code_persontype_id` | hardcoded `1` |
| `national_code` | sp2 `NationalId` |
| `mobile` | sp2 `Mob` |
| `membership_number` | sp2 `Ozviat` |
| `membership_date` | sp2 `TarikhSodur` |
| `renewal_date` | sp2 `TarikhSodur` (per source comment — not `TarikhTamdid`) |
| `membership_expire_date` | sp2 `TarikhPayanEtebar` |
| `license[0].license_number` | sp2 `Ozviat` |
| `license[0].license_issue_date` | sp2 `TarikhSodur` |
| `license[0].license_renewal_date` | sp2 `TarikhSodur` |
| `license[0].license_expire_date` | sp2 `TarikhPayanEtebar` |
| `license[0].economic_code` | hardcoded `"41123456789"` |
| `license[0].signature_code` | hardcoded `"SGN-4589"` |
| `license[0].description` | hardcoded `"none"` |
| `license[0].branch[0].code_engineeringbase_id` | sp2 `Payeh_Nezarat_Temp` |
| `license[0].branch[0].code_engineeringbranch_id` | hardcoded `1` |
| `license[0].branch[0].code_engineeringtask_id` | sp2 `PesronTyp` |
| `license[0].branch[0].issue_date` | sp2 `TarikhSodur` |
| `license[0].branch[0].expire_date` | sp2 `TarikhPayanEtebar` |

Body is a JSON **array** (one engineer per call, per the source spec's example — a single-element
array). Success: `{ "<national_code>": { "success": true } }`. Failure:
`{ "success": false, "msg": "..." }` → log the failure onto the same `mun_report_logs` attempt row
(`saveEngMap` stays `Failed` for this cycle, retried next run).

## Backend components

- `Domain/MunSanandaj/MunSyncRun.cs`, `MunReportLog.cs` — entities above.
- `Application/Common/Interfaces/MunSanandaj/` — `IMunSanandajSourceReader` (sp1/sp2),
  `IMunSanandajGatewayClient` (the 3 REST calls), `IMunSanandajSyncService` (orchestration).
- `Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs` — raw ADO.NET against
  `KurdNezamDb`.
- `Infrastructure/MunSanandaj/Http/MunSanandajGatewayClient.cs` — typed `HttpClient`, static
  120s client (Aspire-resilience bypass, as noted above).
- `Application/MunSanandaj/MunSanandajSyncService.cs` — the two orchestration methods
  (`RunSaveEngineerReportAsync`, `RunSaveEngMapAsync`), each: open a `mun_sync_runs` row, call
  sp1, skip Peygiris whose latest `mun_report_logs` row is already `Success`, iterate the rest
  sequentially (no parallelism — polite to the municipal server), write one `mun_report_logs`
  row per attempt, close out the run row with final counts.
- `Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs`,
  `Infrastructure/MunSanandaj/SaveEngMapWorker.cs` — `BackgroundService` + `PeriodicTimer(12h)`
  wrappers calling the sync service.
- `Web/Endpoints/MunSanandaj/Runs.cs` — `GET /api/MunSanandaj/Runs` (recent runs, for the KPI
  tiles/chart), `GET /api/MunSanandaj/Runs/{runId}` (a run + its `mun_report_logs` rows, for the
  live table), `POST /api/MunSanandaj/Runs/{workerType}/trigger` (manual run-now). All gated
  `RequireRole(Administrator)`.
- `Web/Endpoints/MunSanandaj/Logs.cs` — `GET /api/MunSanandaj/Logs` (paginated/filterable
  history: `workerType`, `status`, `peygiri`, `projectNo`, date range).

## Frontend — `mun-sanandaj-web`

New folder `mun-sanandaj-web/`, same stack as `analytics-web` (Vite + React 19 + TS + AntD 5 +
ECharts + framer-motion), same OIDC pattern (`oidc-client-ts`, PKCE, new IdP client
`mun-sanandaj-web` seeded in `AuthDbInitialiser`, gated to the `Administrator` role — non-admins
who authenticate successfully see a 403 screen, matching the existing `RequireRole` pattern from
`analytics-web`).

Two screens:
- **Dashboard** (`/`, the post-login landing page): KPI tiles (last run per worker + its status,
  pending/success/failed counts), an ECharts line/bar chart of runs over time (success vs.
  failed rows per run), and a live table of the current/most-recent run's `mun_report_logs` rows
  — polled every ~5s while `Status=Running`, otherwise polled at a slower cadence (~30s).
  framer-motion handles row-enter and status-change transitions. Two "Run now" buttons
  (SaveEngineerReport / SaveEngMap).
- **Logs** (`/logs`): filterable, paginated table over `GET /api/MunSanandaj/Logs`.

## Deployment

- Add `mun-sanandaj-web` service to `deploy/docker-compose.newserver.yml`, mirroring the
  `analytics-web` block exactly (own `Dockerfile.mun-sanandaj-web`, nginx SPA, Traefik router
  `m19munsanandaj`, `Host(\`${MUN_SANANDAJ_DOMAIN}\`)`).
- Add `Clients__MunSanandajWeb__Redirect/Silent/PostLogout` to the `auth` service env, and a
  `mun-sanandaj-web` seeded PKCE client in `AuthDbInitialiser` (guarded the same way
  `AnalyticsWeb` is — skipped when its redirect URL is unset).
- Add `Cors__AllowedOrigins__2` (next free index) for the new SPA origin.
- Add `ConnectionStrings__KurdNezamDb` and `MunSanandaj__ApiToken` to the `api` service env,
  sourced from `deploy/.env` on the server (never committed) — same handling as
  `ANALYTICS_DB_CONN`/`ANALYTICS_AI_API_KEY`.
- User action (outside this repo): add a `mun-sanandaj.myceo.ir` A-record → `185.206.94.116` in
  ArvanCloud, CDN mode ON (matching the `analytic.myceo.ir` web-host convention).
- Secrets pasted in chat (KurdNezam DB password, mahyapardaz bearer token) are third-party
  credentials — rotating them is the municipality's call, but they must never be committed;
  they live only in `deploy/.env` on the server.

## Status tracking

Add a `mun-sanandaj` service entry to `roadmap/roadmap.json` (same schema as the existing
`analytic`/`mabhas19`/etc. entries) with its own task/todo breakdown, instead of building a
second bespoke static status page — the roadmap board already exists for exactly this purpose.

## Testing

- `Domain`/`Application` unit tests: field-mapping functions (sp2 row → `addEngineer` payload,
  sp2 row → `saveEngMap` engineer entry) — pure functions, easy to golden-test against the
  exact example payloads in this spec.
- `MunSanandajSyncService` tests against fake `IMunSanandajSourceReader`/`IMunSanandajGatewayClient`
  covering: skip-already-succeeded rows, the `addEngineer`-then-retry flow, and the two
  `saveEngMap` failure shapes (`error` vs. per-engineer `msg`).
- No integration tests against the real KurdNezam DB or mahyapardaz API (external, credentialed,
  third-party — not safe to hit from CI/local runs).

## Assumptions (confirm or correct before/while implementing)

1. Both workers process **every** row sp1 returns — no filtering on `Nosazi` or anything else.
2. `addEngineer` field mappings follow the `//` comments literally, including the two mappings
   that look like they might be copy-paste quirks (`renewal_date` from `TarikhSodur` rather than
   `TarikhTamdid`; `description` hardcoded to `"none"` overriding the example's
   `"تمدید سالانه"`).
3. Live updates are polling-based (~5s while a run is active), not SignalR/WebSocket push.
4. `mun-sanandaj.myceo.ir` deploys to the `185.206.94.116` stack, not the original
   `10.249.52.216` server.
