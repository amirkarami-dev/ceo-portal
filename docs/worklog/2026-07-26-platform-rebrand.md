# MyCEO: new name and a move to a new host

- **Date:** 2026-07-26
- **Area:** infra
- **Branch / commits:** `main` — `83cd1d2`
- **Status:** shipped to production

## Goal

Rename the Mabhas19 web and mobile folders, move the platform to the MyCEO host names, rename
the two SQL Server catalogs without data loss, introduce the public service portal, and make
`ceo.api` the canonical OAuth resource.

## What changed

- `mabhas19-web/`, `mabhas19-mobile/` — renamed the former `web/` and `mobile/` workspaces and updated package, Docker, ignore, and deploy references.
- `src/Shared/Services.cs`, `src/Auth/Program.cs`, appsettings, compose, and test factories — renamed connection-string keys/catalogs to `CeoDb` and `CeoAuthDb`.
- `src/Auth/Data/AuthDbInitialiser.cs`, `src/Infrastructure/DependencyInjection.cs`, and client OIDC modules — registered/requested `ceo.api` while retaining `mabhas19.api` as a transitional scope/audience.
- `deploy/docker-compose*.yml`, Dockerfiles, and environment templates — made `api.myceo.ir` and `s3.myceo.ir` canonical, retaining legacy API/S3 Traefik routers temporarily.
- `portal-web/` — added the Persian RTL public MyCEO service directory and its Traefik service at `myceo.ir`.
- `docs/ai/PROJECT-MAP.md`, `docs/ai/OPERATIONS.md`, deployment/readme/runbook files — documented current ownership, deployment variables, compatibility routing, and server cutover actions.

## Decisions

- Used SQL Server `ALTER DATABASE ... MODIFY NAME` after verified `.bak` backups rather than recreating databases, so all existing data remains intact.
- Kept `auth.myceo.ir` as the OIDC issuer; `ceo.api` is an OAuth resource/audience, not a host name.
- Accepted both `ceo.api` and `mabhas19.api` at the API and IdP during migration, allowing existing browser/mobile clients to continue working while rebuilt clients request the new scope.
- Kept legacy API/S3 Traefik routers until old bundles and short-lived presigned URLs have naturally expired.

## Verification

- Local SQL Server: `CeoDb` and `CeoAuthDb` are online; old catalog names are absent. Counts: 32 and 13 user tables. Dated backup files remain in `backups/`.
- Production deployed to `/data/apps/ceo-portal` on `185.206.94.116`; the prior source tree remains
	in `/data/apps/mabhas19` only as a rollback copy. The initial cutover retained legacy Docker
	identities; the follow-on migration to `ceo-portal` containers and volumes is recorded in
	`2026-07-26-docker-platform-rename.md`.
- Production SQL Server: verified `COPY_ONLY` checksum backups and `RESTORE VERIFYONLY` before in-place `ALTER DATABASE` renames. Backups are retained at `/data/apps/ceo-portal/backups/ceo-cutover-20260726-083207/` (SHA-256 recorded on the server). `CeoDb` and `CeoAuthDb` are online with 32 and 13 user tables; the retired catalog names are absent.
- Production API, Auth, Mabhas19 web, portal, and all rebuilt SPA services are healthy. `myceo.ir`, `api.myceo.ir`, and `auth.myceo.ir` return HTTP 200; `s3.myceo.ir` returns MinIO's expected anonymous HTTP 403. Legacy API/S3 host routers also reach their services.
- The Auth startup log confirms creation of `ceo.api`; direct query in `CeoAuthDb` confirms the scope exists.
- `npm run lint --workspace mabhas19-web` and `npm run typecheck --workspace mabhas19-mobile` passed.
- `npm run build` passed for analytics, admin, landing-panel, municipality, and welfare SPAs; only existing Vite chunk-size warnings were emitted.
- `portal-web`: build and lint passed; browser smoke test at `http://127.0.0.1:5173/` confirmed all eight RTL service links render.
- All updated compose variants passed `docker compose ... config --quiet`; `git diff --check` passed, with expected missing local secret-variable warnings only.
- Local Auth/API smoke checks previously returned discovery metadata containing `ceo.api` and API Scalar HTTP 200. A full .NET solution build/test remains server-side because NuGet is blocked on the development machine.

## Follow-ups

- Update the Iran Kish registered callback to `https://api.myceo.ir/api/walfare/payments/irk-return` before enabling payments on the new host.
- Retain the legacy API/S3 DNS records and Traefik routes until old browser/mobile bundles and outstanding short-lived presigned URLs have aged out.
- The municipality sync worker still reports the known expired upstream certificate (`NotTimeValid`); unrelated to this deployment.