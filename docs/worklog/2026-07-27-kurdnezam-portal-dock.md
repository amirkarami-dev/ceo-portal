# Kurdnezam portal dock: welfare first, same-size tiles, no mobile rail

- **Date:** 2026-07-27
- **Area:** kurdnezam-web
- **Branch / commits:** `feat/kurdnezam-portal-dock-redesign` → merged to `main` as `04aa244`
- **Status:** **shipped to production** 2026-07-27

## Goal

Move «سامانه رفاهی مهندسین» (the welfare portal) to the first position in the service dock on the
Kurdnezam home page, and modernise that section with motion. Scope was explicitly limited by the
user to the dock `<ul>` — not the hero, slider, or skyline.

## What changed

- `kurdnezam-web/src/components/Hero.tsx` — `PortalDock` only:
  - Extracted the tile into a `PortalTile` component; **every** portal renders through it,
    including the pinned one.
  - Pins the `welfare` link to the first cell in the component. The API orders `quickLinks` by
    `sortOrder` and welfare ships as **8 of 8**, so order cannot be fixed without a CMS edit.
  - Replaced `sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7` with `grid-cols-2` plus a computed
    `--dock-cols` from `balancedColumns()`. Eight links now resolve to 2 columns on a phone and
    4 from `md` — no stranded last-row tile at any width.
  - Wrapper is now `<nav aria-label>` with `role="list"` on the `<ul>`; added an `ExternalLink`
    affordance and an `sr-only` «در پنجرهٔ جدید باز می‌شود» for the `target="_blank"` links, and
    `rel="noopener noreferrer"`.
  - Motion: 40 ms staggered entrance, hover lift + shadow, icon colour swap, all behind
    `motion-safe:` / `useReducedMotion()`; transform and opacity only.
- `kurdnezam-web/.env.local` — points at `http://api.localhost:5000`; the API's dev CORS allow-list
  is now `*.localhost` only.

## Root cause

Nothing was broken; two design defects were fixed in passing:

- `xl:grid-cols-7` was hardcoded against a **CMS-managed** list. Eight links produced a 7 + 1
  orphan row, and any future count would strand tiles again. `balancedColumns()` picks the column
  count leaving the fewest empty cells, so the bug cannot come back when a ninth service is added.
- The tiles were `target="_blank"` with no visual or assistive affordance at all.

## Decisions

- **Uniform tiles, not a featured banner.** A first pass promoted welfare to a full-width spotlight
  card with a badge, host line, and cursor-tracking glow. The user rejected it: the welfare portal
  should look like every other service and simply come first. Reverted to one tile shape.
- **Wrapping grid, never a horizontal rail.** The same first pass used a snap-scroll rail below
  `md`. The user rejected it — every service must be visible on a phone without sideways scrolling.
- Pinned in the component rather than by editing `sortOrder` in the CMS, so the ordering holds even
  if content editors re-sort the list.
- Kept the existing `useHydrated()` SSR guard and the project's own colour tokens; no new colours.

## Verification

- `npx eslint src/components/Hero.tsx` — clean. `npx tsc --noEmit` — clean.
- `npm run build` — compiled successfully, 5/5 static pages generated.
- Browser at `http://kurdnezam.localhost:3100`:
  - Desktop 1106px: `grid-template-columns` = 4 × 247.2px, two full rows, first tile is
    «سامانه رفاهی مهندسین», no horizontal page scroll.
  - Mobile 375px: 2 × 148.8px, `overflow-x: visible`, all 8 tiles inside the viewport,
    neither the list nor the page scrolls horizontally, tap target 149 × 150px.
  - Console clean of errors.
- **Not verified:** no screen-reader pass, no real-device test, and no automated test — this app has
  no test suite. Reduced-motion was implemented but not exercised with the OS setting enabled.

### Production deploy (2026-07-27)

Incremental, not `scripts/deploy.ps1` — that script rebuilds all ten services with `--no-cache` and
force-recreates the whole stack including SQL Server and MinIO, which is disproportionate for a
one-component change. Shipped three files (`Hero.tsx` plus the `Dockerfile`/`next.config.ts`
rebrand edits), tagged the running image `:rollback`, built only `kurdnezam-web`, and recreated it
with `--no-deps`.

- `BUILD_EXIT=0`, `UP_EXIT=0`; container healthy 58 s after start.
- **The other 11 `ceo-portal` containers stayed "Up 2 days"** — nothing else was touched.
- `kurdnezam.ir` and `kurdnezam.myceo.ir` both 200.
- Verified against the live public HTML: first portal link is now
  `https://refahi.kurdnezam.ir`; `dock-cols` ×2, `lucide-external-link` ×8 (one per tile),
  `role="list"` ×1; `xl:grid-cols-7` ×0 (old orphan grid gone) and `snap-x` ×0 (no mobile rail).

## Follow-ups

- A multi-agent design workflow was used to explore approaches; one agent **wrote directly to
  `Hero.tsx`** instead of returning its code. Constrain such agents to read-only next time.
- The API crashed once with a **stack overflow in Application Insights'
  `SelfDiagnosticsConfigRefresher`** (`Microsoft.ApplicationInsights` 2.23.0). Unrelated to this
  change; worth investigating separately.
- Running `dotnet run` for `src/Auth` and `src/Web` **at the same time fails the build** — they race
  on `artifacts/obj/ServiceDefaults/debug/Mabhas19.ServiceDefaults.dll`. Start them one at a time.
- `main` is one commit ahead of `origin/main`; the push was blocked by the permission classifier and
  still needs to be run.
- Stray untracked `web/src/auth.config.ts` remains from the earlier folder rename.
