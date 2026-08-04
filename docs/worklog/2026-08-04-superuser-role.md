# Access step 1: a working `SuperUser` role

**Date:** 2026-08-04
**Area:** auth (IdP) / api / all 8 SPAs
**Status:** shipped to production and verified live

## Goal

Step 1 of the plan to make per-service access actually restrict administrators.

Today an `Administrator` is all-or-nothing. To gate admins by service without the risk of
locking every one of them out, we first need a second role that is *never* gated —
`SuperUser` — recognised by every permission check in the system. This step only teaches
the code the role and creates it; nothing is gated yet, so the change is inert by design.

The user's note for this step: *"set the SuperUser role to admin user."*

## What changed

**`src/Domain/Constants/Roles.cs`** — the crux.

```csharp
public const string AdminOrSuper = Administrator + "," + SuperUser;
public static bool HasAdminPowers(IEnumerable<string>? roles) =>
    roles is not null && roles.Any(r => r == Administrator || r == SuperUser);
```

Server-side, every place that said "administrator" now says "administrator **or** super user":

| Where | Count |
| --- | --- |
| `[Authorize(Roles = Roles.AdminOrSuper)]` on commands/queries | 85 across 29 files |
| `RequireRole(Roles.Administrator, Roles.SuperUser)` on endpoints | 10 |
| Imperative role reads (`IsInRole`, claim checks) | 7 |

**`src/Auth/`** (the IdP — it cannot reference `Domain`, so the strings are repeated there):

- `AdminController` accepts `[Authorize(Roles = "Administrator,SuperUser")]`.
- Both "don't delete the last administrator" guards now count **admin powers**, not the
  `Administrator` role alone — `CountAdministratorsAsync()` unions the members of both roles,
  and `SetRoles` compares `HasAdminPower(current)` against `HasAdminPower(desired)`.
  Without this, removing `Administrator` from the only `SuperUser` would have passed the guard.
- `AuthDbInitialiser` seeds the `SuperUser` role and grants it to the seeded admin
  **additively** — it adds any missing role rather than replacing, so re-running it is safe.

**All 8 SPAs** (`src/auth/oidc.ts`): a shared `ADMIN_ROLES = ["Administrator", "SuperUser"]`,
and `isAdmin` widened to match either. `analytics-web/src/contracts/rbac.ts` maps
`SuperUser → SuperAdmin` (that is analytics-web's own vocabulary, not the IdP's).

## The trap that nearly shipped

`AuthorizationBehaviour.cs:37` splits the attribute's role list on `,` and compares with `==`
— **no trimming**. So `"Administrator, SuperUser"` (with a space) would silently match nothing
and every gated command would have thrown `ForbiddenAccessException`. `AdminOrSuper` is built
by concatenation precisely so the no-space form cannot be lost to a stray reformat.

Three adversarial reviews of the wider plan came back "flawed". All five objections were
verified by hand and all five were real — the original plan would have locked every
administrator out of the admin panel within about 30 minutes of deploying. That is why the
role is introduced *first*, alone, and gating comes later.

## Verified

- 8/8 SPAs typecheck clean; `src/Web` and `src/Auth` both build **0 Errors**.
- `Application.UnitTests` **387/387** pass.
- Built and recreated `api`, `auth` and all 8 SPAs on production — all 10 containers healthy.
- IdP roles table now reads `Administrator`, `SuperUser`, `User`.
- All eight deployed bundles contain the string `SuperUser` (fetched over HTTPS, not assumed).
- `auth.myceo.ir/.well-known/openid-configuration` → 200, `api.myceo.ir/alive` → 200.

## Found while verifying — matters for step 2

**Two accounts share the email `amirkarami.dev@gmail.com`.** ASP.NET Identity makes
`UserNameIndex` unique but leaves `EmailIndex` non-unique, so both exist:

| UserName | Roles |
| --- | --- |
| `admin` | SuperUser + Administrator ← the seeded account, `ADMIN_EMAIL` |
| `amirkarami.dev@gmail.com` | Administrator only |

Only the first got `SuperUser`. Whoever logs in as the second is a plain administrator.

**The grant gate is already correct.** `AuthorizationController.cs:130-134`:

```csharp
if (grants.Count > 0 && !grants.Contains(serviceKey, StringComparer.OrdinalIgnoreCase))
```

Empty grant list ⇒ everything; non-empty ⇒ only those services. That is exactly the rule
asked for. **The bug is not the gate — it is `ServiceKeys.ClientToKey`,** which maps only 7
clients and leaves `election-web`, `room-web`, `vms-web` and `admin-web` at `null`, meaning
those four are never gated no matter what grants a user holds. `ServiceKeys.All` is also
missing a `vms` key.

Current admin population (this is what step 2 will act on):

| Account | Grants | After step 2 |
| --- | --- | --- |
| `admin` | none | everything (SuperUser) |
| `amirkarami.dev@gmail.com` | none | everything (empty list = grandfathered) |
| `arman`, `horaman` | none | everything (same rule) |
| `admin2` | landing-panel, mun-sanandaj | those two only |
| `rashidi` | walfare | walfare only |

413 non-admin users hold grants, so the grandfather rule must not be weakened.

## Left to do

Step 2 onward, in this order — the order is the safety property:

1. `SuperUser` bypasses the grant gate in `AuthorizationController`.
2. Add a `vms` key to `ServiceKeys.All`.
3. **Backfill** `vms` to every administrator who already holds grants (`admin2`, `rashidi`)
   — before mapping the client, or they lose VMS the moment it is mapped.
4. Only then map `vms-web` in `ClientToKey`.
5. Launcher filtering last, across all 8 `AppSwitcher.tsx` copies, keeping the admin tile
   always visible.

`admin-web` stays role-gated and unmapped; `election-web` / `room-web` stay unmapped
(engineers carry `["walfare"]` and would lose them).
