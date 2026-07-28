# Agent instruction refresh and local stack bring-up

- **Date:** 2026-07-27
- **Area:** docs / local dev
- **Branch / commits:** `main` — working tree not committed
- **Status:** complete, local only (nothing deployed)

## Goal

Refresh the repo's agent customization files after the 2026-07-26 rebrand, and run the stack
locally against the existing database.

## What changed

- `AGENTS.md` — rewritten as the **single source of truth**: corrected the `web/`→`mabhas19-web/`
  paths, added `portal-web/`, added a dev-port table for all nine front ends, added a
  Local development section, replaced the obsolete Deployment section with a pointer to
  `OPERATIONS.md` plus the four non-negotiable rules, and delegated SPA conventions to
  `.github/instructions/spa-frontends.instructions.md` instead of restating them.
- `CLAUDE.md` — reduced from a 119-line near-duplicate to a 15-line pointer at `AGENTS.md`
  plus the two Claude-specific skills.
- `.claude/launch.json` — the `web` entry pointed at a directory that no longer exists; repointed
  to `mabhas19-web` on 3000 and added `kurdnezam-web`, `portal-web`, `landing-panel`, `admin-web`.
- `docs/ai/GOTCHAS.md` — two new entries (local memory exhaustion; the dev-compose rename trap) and
  a correction to the "NuGet is blocked" claim.
- `src/Web/appsettings.Development.json` — added the analytics/admin/walfare dev origins to CORS.
- `admin-web/.env`, `landing-panel/.env`, `walfare-web/.env` — created; these three had no local
  env file at all.
- `~/.wslconfig` (outside the repo) — created with `memory=8GB`, `swap=4GB`.

## Root cause

Two separate ones.

**Stale docs:** the rebrand updated `docs/ai/*` but not the root instruction files, so `AGENTS.md`
still described `web/src`, server `10.249.52.216` under `/srv/mabhas19`, and
`docker-compose.server.yml`. Worse, it told agents to run `dotnet build` locally while
`GOTCHAS.md` said NuGet was blocked — an agent reading both got contradictory instructions.

**Local freeze:** starting all ten services took a 32 GB machine to 100% RAM and forced a restart.
Not the dev servers alone — SQL Server's `max server memory` defaults to *unlimited* and never
releases memory, and WSL2 with no `~/.wslconfig` claims ~50% of host RAM. Eight Node dev servers
then ran on the host on top of both.

## Decisions

- `AGENTS.md` is the single source; `CLAUDE.md` points at it. The two files had already drifted as
  duplicates, so keeping both in sync was the failure mode, not the fix.
- Documented "NuGet is intermittent" rather than deleting the GOTCHAS claim: a full solution build
  succeeded locally today, but the server path stays authoritative and package versions must never
  be changed to force a restore.
- Capped SQL Server at 2048 MB and WSL2 at 8 GB rather than containerising the front ends —
  on Windows containers land in the same WSL2 VM, adding overhead rather than removing it.
- Left the local `analytics-web` in its existing mock mode; did not add the missing
  `Clients:AnalyticsWeb` / `Clients:WalfareWeb` blocks (see Follow-ups).

## Verification

- `dotnet build ceo-portal.slnx` — **0 errors**, 202 NuGet-audit warnings, ~9 s. NuGet restore
  worked locally, contradicting the standing "blocked" note.
- `docker rename mabhas19-sql-local ceo-portal-sql-local` — container stayed up; `CeoDb` and
  `CeoAuthDb` both still present. The container carries no Compose labels, so nothing recreates it.
- Auth (:5100) started against `CeoAuthDb`: migrations already up to date, roles and all six
  configured OIDC clients seeded. Discovery returns 200 and advertises `ceo.api`.
- API (:5000) `/scalar` returns 200.
- All ten services were confirmed reachable (HTTP 200) in one earlier run before the memory work.
- After the caps, with Auth + API + analytics-web up: **12.7 GB of 31.7 GB** used, WSL VM limit
  7.76 GiB, SQL Server 1.08 GiB.
- **Not verified:** no end-to-end browser sign-in through the local IdP, and no front-end
  `npm run build` / `lint` / test run — this task changed no application code.

## Follow-ups

- `analytics-web` and `walfare-web` OIDC clients are **never seeded locally**:
  `AuthDbInitialiser` skips them when `Clients:AnalyticsWeb:Redirect` / `Clients:WalfareWeb:Redirect`
  are unset, and neither is in `src/Auth/appsettings.Development.json`. Sign-in for those two fails
  locally until the blocks are added.
- `walfare-web/vite.config.ts` and `admin-web/vite.config.ts` both pin port **5180**; walfare needs
  an explicit `--port 5275 --strictPort` override.
- Stray untracked `web/` directory containing only `src` — leftover from the rename, not deleted.
- Root `package.json` is still named `mabhas19-monorepo`; its `workspaces` list omits the five SPAs
  and `portal-web`.
- OIDC env var naming is inconsistent: `VITE_AUTH_AUTHORITY` (analytics, mun-sanandaj) vs
  `VITE_AUTH_ISSUER` (admin, landing-panel, walfare).
- 225 uncommitted changes sit on `main`, which has only two commits.
