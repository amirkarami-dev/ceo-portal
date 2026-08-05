# Access step 2: an admin only gets the services you give them

**Date:** 2026-08-04
**Area:** auth (IdP) / admin-web / all 8 SPAs
**Status:** shipped to production and verified live

## Goal

> "when add the user as role admin and not assign any services is ok and the admin user can access
> to all service, but i want when assign any service for this admin user that only access that
> service/s and show only that service/s."

Plus the user's decision on the two entitlement services: **gate them for admins, leave engineers
alone.**

## The bug was not where it looked

`AuthorizationController` already implemented the requested rule exactly — empty grant list means
everything, non-empty means only those. What was missing was the **map**: `ClientToKey` covered 7
clients, leaving `election-web`, `room-web`, `vms-web` and `admin-web` at `null`, so those four were
never gated no matter what an admin was assigned. There was also no `vms` key at all, so cameras
could not be granted even in principle.

## What changed

**`ServiceKeys.cs` — three tiers instead of two.**

| Tier | Gates | Members |
| --- | --- | --- |
| `ClientToKey` | everyone | the original 7 |
| `AdminGatedClientToKey` *(new)* | administrators only | `election-web`, `room-web`, `vms-web` |
| in neither | nobody | `admin-web` |

`vms` was added to `All` so it becomes grantable. `admin-web` stays ungated deliberately: it is the
only place a narrowed administrator can widen their own grants again.

**The gate moved into `DenyServiceAsync`** and now runs in **two** places. It was previously only on
`Authorize()`; `Exchange()` — which serves the `refresh_token` grant — had no check at all. No client
requests `offline_access` today so no refresh token is issued, but every client is registered with
the RefreshToken grant, so the hole was one scope string from being real.

Order of the rules: SuperUser is never gated → empty grant list allows everything → admin-only
clients are consulted only for admins → otherwise the grant must contain the key.

**The launcher (`AppSwitcher.tsx`, ×8 identical)** got a `canSee()` that mirrors the server, a new
`alwaysForAdmin` flag on the user-admin tile, and — closing a gap step 1 left — an `isAdmin` that
reads `ADMIN_ROLES` instead of the hardcoded string `"Administrator"`, so a SuperUser is recognised.

**`admin-web`'s user drawer** now shows a warning when an Administrator's row has any service ticked,
because an empty list means "everything": the first tick is not an addition, it is a restriction, and
it silently removes elections, meetings and cameras too.

## What the adversarial review caught

Nine agents (5 investigators, 3 skeptics, 1 synthesis) raised 30 candidate defects; 2 of 3 skeptics
returned **"flawed"** on the original plan. Verified by hand, these were real and are fixed here:

1. **Self-promotion voided the entire feature.** `AdminController.SetRoles` guarded only the
   *removal* of roles. A restricted administrator could open the admin panel — which is never gated,
   by design — tick `SuperUser` on their own row, and be permanently exempt from every grant.
   `CreateUser` had the same hole. Both now refuse unless the **caller** is already a SuperUser
   (checking the caller, not `IsSelf`: two restricted admins could otherwise promote each other).
   `GetRoles` no longer returns `SuperUser` to callers who are not one.
2. **`vms-web` in the everyone-gated map would have changed engineer behaviour** for no benefit —
   VMS is admin-only in its own right. Moved to the admin-only map; not one of the 413 is touched.
3. The comments in `ServiceKeys.cs` and in all eight launchers still said these clients "never block
   anyone at authorize". Now false for admins; all rewritten.

**Rejected after checking:** the review claimed the plan's baseline hash was stale. It compared
`md5sum` against a `git hash-object` value — different algorithms, both correct. All eight copies
were and are identical.

**Settled by data, not argument:** the strongest objection was that gating `election-web` for admins
would disenfranchise an engineer who is also an administrator — the exact harm `ServiceKeys.cs` was
written to prevent. Queried production: **all 6 administrators have a `PasswordHash` (staff); all 413
granted users have none (engineers).** Zero overlap, so nobody loses a ballot. The trap is now
documented in the file and in `GOTCHAS.md`, because it becomes real the day an engineer is made an
admin.

## Verified

- New `tests/Auth.FunctionalTests/ServiceKeyMappingTests.cs` — **16/16 pass in 19 ms**. Asserts every
  mapping, both absences, that no client is in both tables, that every mapped key is grantable, and
  case-insensitivity. It lives in a sibling namespace so NUnit's `[SetUpFixture]` does not boot the
  Aspire host for it.
- `src/Auth` builds **0 Errors**; all 8 SPAs typecheck clean.
- Built and recreated `auth` + 8 SPAs; all 9 containers healthy, no errors in the auth log.
- Fetched all eight deployed bundles over HTTPS: every one contains `alwaysForAdmin` and `SuperUser`.
- Discovery 200, `api/alive` 200.

## Effect on the real accounts

| Account | Grants | Result |
| --- | --- | --- |
| `admin` (SuperUser) | none | everything |
| `amirkarami.dev@gmail.com`, `arman`, `horaman` | none | everything (grandfathered) |
| `admin2` | landing-panel, mun-sanandaj | admin panel + those two **only** |
| `rashidi` | walfare | admin panel + walfare **only** |
| 413 engineers | various | **unchanged** |

`admin2` and `rashidi` lose VMS, elections and meetings — that is the requested behaviour, not a
regression. Grant them `vms`/`election`/`room` in the admin panel to give any of it back. Because
silent renew re-authorises in the background, this takes effect within roughly 30 minutes rather
than at next login.

## Not done, deliberately

- **No backfill** of `vms` to `admin2`/`rashidi`. Backfilling would defeat the feature that was asked
  for; the admin panel is the intended way to hand it back.
- **The gate is login-time, not an API permission.** The resource server validates issuer and
  audience only and never checks which client minted a token, so a token from one SPA is accepted by
  every API endpoint. Per-endpoint authorisation remains the role checks on the API. Now recorded in
  `GOTCHAS.md` so nobody mistakes service grants for an API firewall.
- **Account lockout is not enforced on 3 of 4 sign-in paths** (OTP, engineer login, Fars login) —
  found during the review, pre-existing, spun off as its own task.
