# Election service step 6: `election-web` admin panel

- **Date:** 2026-07-30
- **Area:** election (new SPA) + auth
- **Branch / commits:** `main` — uncommitted at time of writing; builds on `e20b8c2` (step 5)
- **Status:** in progress — code complete, lint/typecheck/tests green, **UI click-through not yet run**

## Goal
"start step 6" — the admin panel of the election service, from the agreed build order:
*`election-web`: admin panel — done when an election can be created end to end.*

## What changed

**New SPA `election-web/`** (boilerplate copied from `mun-sanandaj-web`, rebranded):

- `src/lib/types.ts` — DTO mirrors + **numeric** enums (`ElectionStatus`, `ElectionPhase`,
  `EligibilityMode`) as const objects, the same pattern as `walfare-web/src/api/walfareApi.ts`.
  Also `RESHTE_OPTIONS` (the seven real codes), `PHASE_LABELS`/`PHASE_COLOURS`, and
  `toWireTime`/`fromWireTime` for the `"HH:mm"` ↔ `"HH:mm:ss"` gap between the picker and `TimeOnly`.
- `src/lib/api.ts` — replaced the copied helper. Adds `ApiError` (carrying `status` + `errors`) and
  `apiGet/apiPost/apiPut/apiDelete` over one `request<T>`; tolerates 204/empty bodies. The old one had
  no PUT/DELETE and threw `"POST failed: 400"`, discarding the Persian reason the API returns.
- `src/lib/queries.ts` — TanStack hooks. The list polls every 15 s only while some election is `Open`.
- `src/features/elections/ElectionsList.tsx` — table with phase tag, candidate/ballot **counts**,
  and the publish / cancel / delete / tally / result actions gated by status and phase.
- `src/features/elections/ElectionForm.tsx` — create + edit. Read-only (with a reason banner) when the
  server says `isEditable: false`.
- `src/features/elections/ElectionResults.tsx` — ranked candidates, tie banner, purge banner, and the
  copyable digest.
- `src/app/router.tsx` — all routes behind `RequireAuth` + `RequireAdmin` **for now** (see Follow-ups).
- `src/layout/AppLayout.tsx` — rebranded to «سامانه انتخابات»; menu selection matches child routes.
- `src/components/StatusTag.tsx` — **deleted**, a leftover from `mun-sanandaj-web`.
- `eslint.config.js` — `no-redeclare: off`; see Decisions.

**Auth / API wiring:**

- `src/Auth/Data/AuthDbInitialiser.cs` — seeds the `election-web` public PKCE client, guarded on
  `Clients:ElectionWeb:Redirect` like the other optional SPAs.
- `src/Auth/appsettings.Development.json` — `Clients:ElectionWeb:*` + CORS origin for
  `http://election.localhost:5276`.
- `src/Web/appsettings.Development.json` — the same origin in the API's CORS list.
- `.claude/launch.json` — `election-web` on port **5276**.

**Tests:**

- `tests/Application.UnitTests/Elections/ElectionWireContractTests.cs` — new. Pins the JSON contract
  between the SPA and `/api/ElectionAdmin` in both directions.

## Root cause (a trap caught before it shipped)
The first cut of `types.ts` typed `status`/`phase`/`eligibilityMode` as **string unions**
(`"Draft" | "Published" | ...`). The Web host registers **no `JsonStringEnumConverter`**, so those
fields arrive as numbers. That version compiled cleanly and would have failed **silently** at runtime:
every comparison is just `false`, so a draft shows no publish button, no tag renders, and nothing
errors. Caught by checking `walfare-web`, which already uses numeric const-object enums.

The dangerous direction is the request: `"eligibilityMode": "ByReshte"` is rejected outright (good),
but if a `JsonStringEnumConverter` were ever added, a numeric mismatch could bind to `AllMembers` and
open a restricted election to everybody. `ElectionWireContractTests` now fails if that converter
appears, so the TypeScript side has to be changed with it.

## Decisions
- **Numeric const-object enums**, not string unions and not TS `enum` — matches `walfare-web` and
  matches the wire. Documented at the top of `types.ts` with the failure mode.
- **`no-redeclare` off** rather than the `@typescript-eslint` version. `export const X` +
  `export type X` is the repo's enum pattern; both rules flag it (the TS-aware one only exempts
  interface/namespace merging). `tsc` still reports a genuine duplicate as "Duplicate identifier", so
  nothing is lost. Note `walfare-web` **fails `npm run lint` today** for exactly this reason —
  pre-existing, and its Docker build is unaffected because `npm run build` runs `typecheck`, not lint.
- **`election-web` is deliberately NOT a grantable service** in `ServiceKeys.cs` — same treatment as
  `admin-web`. Admin screens are gated by the `Administrator` role at `/api/ElectionAdmin`, and the
  step-7 voter screens must stay open to every authenticated member, because eligibility is decided
  per election by the API from the org directory, never by a service grant.
- **No image uploader on the candidate form**, just a path field. The only file endpoint the API
  exposes is the kurdnezam CMS bucket (`/api/kurdnezam/media`); pointing an election at it would tie
  the two services together. The card falls back to initials, so the field is optional.
- **Eligibility is shown under the title everywhere** (list rows and the form's help text) because
  the title restricts nobody — «واحد گاز» in a title does not limit voters to مکانیک. That trap is
  called out in `Election.cs` and had to surface in the UI.
- **Read-only comes from the server's `isEditable`**, never re-derived on the client. Guessing it
  would let the form accept typing it is about to be refused for.
- `sortOrder` is sent as the **array index**, matching `ElectionMapper`'s `SortOrder == 0 ? order`
  fallback. A test pins it.
- **No admin route lists who voted**, and none was added. The list shows ballot *counts*.

## Verification
- `npm run typecheck` — clean.
- `npm run lint` — clean (0 problems).
- `npm run build` — succeeded in 12.5 s. The `NativeCommandError` in the PowerShell output is the
  known 5.1 stderr-wrapping gotcha, not a failure; the 1.5 MB chunk warning matches the other SPAs.
- `dotnet build src/Auth` and `src/Web` — 0 errors.
- `dotnet test tests/Application.UnitTests --filter Elections` — **115 passed, 0 failed**, including
  the 11 new contract tests.
- Auth log on startup: `Created OIDC client election-web.`
- API, unauthenticated: `GET /api/ElectionAdmin` → **401**, `GET /api/Election/1/result` → **401**.
- CORS preflight from `http://election.localhost:5276` → **204** with
  `Access-Control-Allow-Origin: http://election.localhost:5276`.
- SPA served at `http://election.localhost:5276` → 200, `<html lang="fa" dir="rtl">`,
  title «سامانه انتخابات»; login screen renders; **no console errors**.
- OIDC handshake reaches the IdP with the right `client_id` and `redirect_uri` (confirmed from the
  authorize URL on the login page).

**Not verified:** the actual click-through — fill the form, POST, see the row, publish. It stops at
the login screen because completing it means typing the seeded admin password, which the assistant
will not do. A human needs to sign in once at `http://election.localhost:5276` and then create one
election. Nothing else in step 6 is outstanding.

Also not verified: the results page against real tallied data (needs step 7 to cast votes first), and
`antd-jalali`'s Persian calendar panel rendering in this app (the picker is byte-identical to
`walfare-web`'s, which is in production).

## Follow-ups
- **Complete the click-through** and record it. Ports: auth 5100, api 5000, SPA 5276.
- **Step 7 — voter flow.** The router puts *everything* behind `RequireAdmin`; that must be relaxed to
  admin-only on the `/elections*` admin routes, with the voter surface open to any authenticated
  member. `election-web` is intentionally absent from `ServiceKeys.cs` so that works without a grant.
- **`AppSwitcher.tsx` has no `election` entry.** It is byte-identical across five SPAs, so adding one
  means rebuilding all of them — a step-9 deploy item. `AppLayout` passes `currentKey="election"`,
  which today matches nothing and simply highlights no tile.
- `npm install` in `election-web` needs **`--legacy-peer-deps`** (`antd-jalali` declares React 18;
  the app is on React 19) — same as `walfare-web`, already in `GOTCHAS.md`. Its `deploy/Dockerfile`
  block in step 9 must carry the flag.
- Before production: generate `Elections__VoterPepper` and `Elections__BallotMasterKey`
  (`openssl rand -base64 32` each, and they must differ).
- Optional, out of scope: `walfare-web`'s pre-existing `npm run lint` failure has the same one-line
  fix applied here.
