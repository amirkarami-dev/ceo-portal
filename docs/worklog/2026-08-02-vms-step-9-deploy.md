# VMS step 9 — deployed, and an IdP outage on the way

- **Date:** 2026-08-02
- **Area:** VMS — production (`185.206.94.116`) and the media VPS; `src/Auth`
- **Branch / commits:** `main` — **not pushed** (see below)
- **Status:** **live at `https://vms.myceo.ir`.** No camera has been added through the UI yet.

## Criterion

> *Deploy: compose, OIDC client, CORS, DNS, AppSwitcher ×8. Done when `https://vms.myceo.ir` serves it.*

From the public internet, through the CDN:

| | |
|---|---|
| `https://vms.myceo.ir` | **200**, and the bundle carries `cam.myceo.ir`, `VmsAdmin`, `VmsMedia`, client `vms-web` |
| `/api/VmsGateway/config`, `/api/VmsMedia/check`, `/api/VmsAdmin` | **401** — present and refusing |
| `cam.myceo.ir/api/ws` (upgrade, no cookie) | **401** |
| `cam.myceo.ir/api/streams` | **404** — still unrouted |
| the other seven panels | **200**, all healthy, all carrying the VMS tile |

## ⚠ The IdP went down during this deploy

**`ceo-portal-auth` crash-looped with exit 139 for about twenty minutes.** Every login for every
service was down.

**Cause, and it was not the VMS change.** `SeedAdminUserAsync` calls
`UserManager.FindByEmailAsync`, which is `SingleOrDefault` underneath. Two accounts share
`amirkarami.dev@gmail.com` — `admin` and one named after the address, both with passwords and a
role. The seeder threw `Sequence contains more than one element`, `SeedAsync` rethrows, and
`Program.cs` lets that kill the process.

**It was already broken; it just could not show it.** The container had been up 47 hours. The crash
only happens at *startup*, so the duplicate had been sitting there harmlessly until something
restarted the IdP. Rolling back the image would not have helped — the old code has the same call.

**Fix:** query `userManager.Users.Where(NormalizedEmail == …)` and take the first, logging a warning
that names both accounts. An ambiguous admin address is worth a warning; it is not worth refusing
every login for every service. Live output now:

```
warn: 2 accounts share the administrator address amirkarami.dev@gmail.com (admin,
      amirkarami.dev@gmail.com). Using admin. Resolve the duplicate: whichever one is not the
      administrator should have its email changed.
```

**Nothing in the database enforces one user per email**, and it never did: engineer logins are
created with a placeholder, and **112 accounts share `a@b.com`** today. Any future code that looks a
user up by email is the same landmine. Two follow-ups below.

## What was deployed

| | |
|---|---|
| `auth` | the `vms-web` OIDC client + the duplicate-email fix |
| `api` | `VmsAdmin`, `VmsGateway`, `VmsMedia` — **and the held `321c819` discipline fix** |
| `vms-web` | new |
| the other seven SPAs | rebuilt for the launcher tile only |

The API deploy also shipped the election discipline fix that step 2's worklog recorded as held. It
was committed and tested on 2026-08-02 and could not matter until an election exists; it is now live.

### Secrets

`VMS_GATEWAY_TOKEN` and `VMS_MEDIA_TOKEN_SECRET` were generated **on the production box** with
`openssl rand`. The media secret never left it. The gateway token had to reach the media VPS, and
travelled as base64 with its SHA-256 alongside — **digests compared before anything was written**,
and the token file on the VPS is `600 root:root`. Same handling as the LiveKit secret, for the reason
in GOTCHAS.

### The VPS is now self-maintaining

Two timers, both enabled and confirmed running:

- **`vms-sync.timer` — every 2 minutes.** Without it an admin adds a camera in the panel and nothing
  picks it up; step 4's whole point was that adding a camera is not a YAML edit, and a sync that only
  runs by hand puts the YAML edit back with extra steps. It costs one HTTPS request when nothing
  changed, and only restarts go2rtc when the rendered config actually differs.
- **`vms-health.timer` — every 5 minutes**, with a 30 s randomised delay.

Production currently holds **zero cameras**, so the sync wrote an empty streams block and go2rtc is
serving nothing. That is correct — production is the source of truth, and the camera used through
steps 1–8 only ever existed in the local dev database.

## What is still unverified

**Nobody has signed in.** Every route is Administrator-only and I do not complete password logins, so
the wall, the camera form and live video in the browser remain unseen — carried forward from step 6.

**To finish it, sign in at `https://vms.myceo.ir` and add the first camera:**
host `78.39.233.70`, port `554`, channel `1`, substream `2`, main stream **empty**, credential key
`default`, city بانه. Within two minutes `vms-sync` picks it up; within five the sweep stamps
«آخرین اتصال». If the tile shows a picture, every step from 1 to 9 is proven together.

## Follow-ups

1. **Resolve the duplicate admin email.** Two accounts, one address. Whichever is not the
   administrator should have its email changed — until then the IdP picks `admin` and warns.
2. **`a@b.com` is on 112 engineer accounts.** Harmless today because nothing looks those up by
   email. Worth a unique index or a per-user placeholder before something does.
3. **The commits are not pushed.** `git push` was refused by the permission classifier this session,
   so `origin/main` is 15 commits behind the deployed tree. The server was updated by file copy, as
   `OPERATIONS.md` prescribes, so production and the working tree agree — but the remote does not.
4. **No test covers the auth seeder.** `src/Auth` has no test project; the fix is verified only by
   the live warning above.
5. Still open from step 1: **is ~0.41 Mbit/s typical of every site?**
