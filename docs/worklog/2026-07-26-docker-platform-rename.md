# CEO Portal Docker project and volume migration

- **Date:** 2026-07-26
- **Area:** infra
- **Branch / commits:** `main` — `83cd1d2`, working tree not committed
- **Status:** shipped to production

## Goal

Replace the remaining `mabhas19-*` platform Docker identities with `ceo-portal-*`, including a
physical SQL Server and MinIO volume migration. Keep only the product-specific web named
`mabhas19-web` and preserve rollback data.

## What changed

- `deploy/docker-compose*.yml` — renamed the Compose project, platform images, containers,
  Traefik routers/services, and explicitly named production state volumes.
- `scripts/deploy.ps1` — aligned archive/image names and added a guard that refuses to start when
  legacy state exists but the migrated destination volume does not.
- `docs/ai/{PROJECT-MAP,OPERATIONS,GOTCHAS}.md` and deploy docs — documented naming ownership,
  migration procedure, rollback policy, and the implicit-volume trap.

## Root cause

The application rebrand changed hosts, catalogs, and source paths but deliberately retained the
old Compose project to avoid selecting empty implicit volumes. That left platform containers and
images branded `mabhas19`. Changing top-level `name:` without migrating state would silently mount
new empty SQL Server and MinIO volumes.

## Decisions

- Platform services use `ceo-portal-*`; `mabhas19-web` remains product-specific.
- Production state is mounted from explicit external volumes `ceo-portal_mssqldata` and
  `ceo-portal_miniodata` so future Compose project renames cannot change physical storage.
- Old `mabhas19_*` volumes, verified backups, and rollback image tags remain untouched.

## Verification

- Stopped-volume copies matched the old volumes by byte count, file inventory, and deterministic
  content hashes before startup; SQL `COPY_ONLY` backups passed `RESTORE VERIFYONLY`.
- Compose reports project `ceo-portal` with 13 running services. Every service with a health check
  is healthy; no legacy platform containers remain.
- `CeoDb` and `CeoAuthDb` are online with 32 and 13 tables. MinIO is ready, and active mounts point
  to the two explicit `ceo-portal_*` volumes.
- Canonical API, Auth, portal, analytics, admin, landing, municipality, Kurdnezam, welfare, S3,
  and Mabhas19 hosts passed origin checks; compatibility API/S3 hosts still work. OIDC discovery
  advertises `ceo.api` and analytics serves the new dashboard bundle.
- Public TLS verification passed for routed hosts. `status.myceo.ir` resolves through both
  ArvanCloud authoritative nameservers and Google/Cloudflare public resolvers; both ArvanCloud
  edges present a trusted certificate and return the expected Basic Auth 401. Existing
  `myresolver` DNS-01 renewals fail with ArvanCloud 403; current certificates remain valid, but
  resolver maintenance is still required.
- API logs contain only known ephemeral data-protection warnings and the municipality's expired
  upstream certificate failure. No Traefik router conflicts were found.

## Follow-ups

- Move direct-DNS routes from broken `myresolver` DNS-01 to `httpresolver` before certificate
  renewal is needed; do not restart the shared Traefik daemon during that change.
- Perform the authenticated analytics create/save/view/edit production smoke test.