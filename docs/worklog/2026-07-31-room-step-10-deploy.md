# Room step 10: deploy — room.myceo.ir

- **Date:** 2026-07-31
- **Area:** room / infra
- **Branch / commits:** `main` — `ef1bfab` "room steps 4-10"
- **Status:** **live** — `https://room.myceo.ir` serves the SPA and the room API is up with its schema

## Goal

Step 10's success criterion: **`https://room.myceo.ir` serves it**.

## What changed

- `deploy/docker-compose.newserver.yml` — the `room-web` service, the `RoomWeb` OIDC client and CORS
  origin on `auth`, and on `api`: the room CORS origin, `Rooms__PublicBaseUrl`, and the four
  `LiveKit__*` settings.
- `scripts/remote-provision.sh` — backfills `ROOM_DOMAIN` and the four `LIVEKIT_*` keys.
- `AppSwitcher.tsx` — the `room` tile, synced so all **seven** copies are byte-identical again.
- `src/Web/appsettings.json` — a `LiveKit` block with empty credentials, so the shape is documented
  and production supplies the values by environment.
- `docs/ai/OPERATIONS.md` — a room section covering the four keys and how to move the secret.

## Deployed incrementally, not with `scripts/deploy.ps1`

That script is still the wrong tool here and this deploy is the third time it has been avoided:

- it runs `up -d --force-recreate` over the **whole** stack, which recreates `sqlserver` and `minio`
  — the database and the object store — for a change that touches neither;
- its build list omits `election-web`, `walfare-web` and now `room-web`;
- it opens with `docker builder prune -af`, throwing away the cache that makes a retry cheap.

Instead: upload → tag every current image `:rollback` → build → `up -d --no-deps <named services>`.
Compose leaves a container alone when neither its image nor its config changed, so everything not
named stayed up untouched.

Order mattered. `room-web` first, because nothing depends on a brand-new container and it cannot
disturb a running service. Then `api`, which is the one step with a real blip for every other product
on the box. Then `auth` and the six SPAs whose only change was the launcher tile.

## The secret that had to move without being seen

The API mints join tokens that `lk.myceo.ir` must accept, so both machines need the same LiveKit key
pair — and the secret existed only on the VPS, generated there in step 1 and never transmitted.

It was relayed VPS → local file → server as **base64 with a SHA-256 alongside**, and the receiving
script verified the digest **before writing anything**. It never appeared in this session in plaintext;
only the key id (`ceo7124ba4a4e4b`, which is the token's public `iss` claim) was read.

The guard earned its keep immediately: the first upload died with `Network error: Software caused
connection abort`, and the apply script found an empty payload and **refused**, printing
`DIGEST MISMATCH` instead of overwriting a good value with nothing. Digests matched on the retry
(`dfd2d043ffe19a74` both ends).

## Two things found on the way

### The whole box cannot issue a new TLS certificate

Traefik's log is a wall of ACME failures — **every** domain, not just the new one:

```
Unable to obtain ACME certificate for domains "api.myceo.ir" …
arvancloud: failed to add TXT record … status code: 403
{"status": false, "message": "Your access to this section is restricted."}
```

The ArvanCloud DNS API token Traefik uses for DNS-01 has lost permission. **Nothing is broken today**,
because ArvanCloud terminates public TLS and the origin only ever serves Traefik's self-signed default
cert — which is the documented architecture here, and is what `openssl s_client` shows for
`api.myceo.ir` and `election.myceo.ir` too, both of which work fine.

But it means the CDN is now load-bearing for TLS on every host. Turning the proxy off for any domain —
which is exactly what was considered for `room.myceo.ir` — would leave browsers facing a self-signed
certificate. Worth fixing the token before that becomes urgent.

### A 404 through the CDN that is not a 404 at the origin

`https://room.myceo.ir/` answered 404 for a few minutes after the container came up, while
`curl -H 'Host: room.myceo.ir' https://127.0.0.1/` already returned 200.

Then it happened again, and that time it mattered: right after the six SPAs were recreated,
`election.myceo.ir` and `refahi.kurdnezam.ir` — **live services that had been 200 all day** — went to
404 through the CDN. At the origin they were 200 the whole time, every container healthy and on the
`traefik` network, nginx answering with the right title inside each one. Both recovered on their own
within a minute or two.

So: **ArvanCloud serves a 404 for a short window after an origin container restarts.** Before touching
Traefik labels that are correct, check the origin:

```
curl -k --resolve HOST:443:185.206.94.116 https://HOST/     # what Traefik really serves
curl -k -H 'Host: HOST' https://127.0.0.1/                  # same, one layer lower
```

If those are 200, wait rather than change anything. Recorded in GOTCHAS.

## Verified in production

- **`https://room.myceo.ir` → 200**, `<title>جلسات آنلاین</title>`, both at the origin
  (`--resolve` past the CDN) and through the public edge.
- **The schema is there.** `Rooms`, `RoomInvites`, `RoomMessages`; both migrations recorded
  (`20260731110432_AddRooms`, `20260731124639_RelaxRoomJoinTokenCheckForDeleted`); and all four
  security CHECK constraints present — `CK_Rooms_PublicIsPresentationOnly`,
  `CK_Rooms_PresentationNeedsPresenter`, `CK_Rooms_JoinTokenMatchesMode`,
  `CK_Rooms_InviteOnlyIsMeetingOnly`.
- **The API routes answer correctly through the real edge:** `/api/Room/MyRooms` and `/api/RoomAdmin`
  → **401** (they exist and are gated), `/api/Room/j/<bogus>` → **404** (the anonymous route is
  reachable with no token and correctly refuses an unknown link).
- **CORS is right, including the guest chat header:**
  `access-control-allow-origin: https://room.myceo.ir` and
  `access-control-allow-headers: content-type,x-room-token`.
- **The IdP knows the client and routes it to the engineer login.** `connect/authorize?client_id=room-web`
  → **302** to `/Account/EngineerLogin?…&service=room`. That one redirect proves three things at once:
  the client is registered, the redirect URI is accepted, and the `room` service hint is wired — so the
  page will be headed «جلسات آنلاین» rather than the welfare fallback. The auth log confirms
  `Created OIDC client room-web.`
- **The launcher tile shipped.** `room.myceo.ir` appears in the built bundle of the sibling SPAs
  (checked in `election-web`'s and `admin-web`'s served `index-*.js`), so all seven copies of
  `AppSwitcher.tsx` are live, not just committed.
- **Every public host is 200** after the rollout: room, mabhas19, election, refahi, admin, analytic,
  mun-sanandaj, landing-panel, auth. `sqlserver` and `minio` were never recreated — still `Up 5 days`.

## Follow-ups

- **The ArvanCloud DNS token is dead for ACME.** Pre-existing, box-wide, and not urgent only because
  the CDN is terminating TLS. Fix it before any host is taken off the proxy.
- **The rate limiter** (120/min per IP, box-wide) is still the one thing worth settling before a
  public webinar — everyone behind one NAT shares that budget, and each guest costs a landing GET, a
  join POST and one request per chat line.
- Nobody has driven the deployed service yet: no meeting created, no link handed out.
- Live chat delivery between two participants is still unwatched (step 9's follow-up).
