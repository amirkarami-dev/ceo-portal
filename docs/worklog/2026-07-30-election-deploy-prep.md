# Election service step 9: deployment wiring

- **Date:** 2026-07-30
- **Area:** election / infra
- **Branch / commits:** `main` — uncommitted at time of writing; follows steps 6–8 the same day
- **Status:** ready to deploy — **not deployed**; blocked on secrets only the user can place

## Goal
"continue step 9" — from the agreed build order: *Deploy: compose, Dockerfile, OIDC client, CORS, DNS,
AppSwitcher everywhere. Done when `https://election.myceo.ir` serves it.*

## What changed
- `election-web/deploy/Dockerfile.election-web` — **new**, copied from `mun-sanandaj-web`'s (same env
  var names, same nginx runtime). One difference: `npm install --legacy-peer-deps`, without which the
  image build fails outright (antd-jalali declares React 18; the app is React 19).
- `deploy/docker-compose.newserver.yml`:
  - new `election-web` service on `${ELECTION_DOMAIN}` with `certresolver=myresolver` — `election.myceo.ir`
    is under `myceo.ir` and therefore behind the ArvanCloud CDN, where HTTP-01 cannot complete;
  - **auth**: `Clients__ElectionWeb__{Redirect,Silent,PostLogout}` + `Cors__AllowedOrigins__5`;
  - **api**: `Cors__AllowedOrigins__8`, both `Elections__*` keys, and all five `Bale__*` settings.
- `deploy/.env.example` — `ELECTION_DOMAIN` and the seven new election/Bale variables, each with the
  reason it exists and what happens when it is missing.
- `deploy/ui/server.js` — `election-web` added to the deploy console's service map.
- `AppSwitcher.tsx` — the election tile, copied to **all six** SPAs (verified one md5 across all six).
- `docs/ai/OPERATIONS.md` — a first-deploy runbook for the election service, and the config table.

## Decisions
- **The launcher tile is `ungated`.** The switcher normally shows a tile only when the user's `svc`
  grant contains it. `election` is grantable but deliberately **not** gating (see step 7), so every
  engineer provisioned before this service existed carries `["walfare"]` and can still vote. Filtering
  the tile by grant would therefore hide a service those people can actually use. Added an explicit
  `ungated` flag rather than special-casing the key, so the display matches the access rule.
- **`myresolver`, not `httpresolver`.** `walfare-web` uses `httpresolver` because `refahi.kurdnezam.ir`
  points straight at the box. `election.myceo.ir` does not — it is a CDN host like the rest of
  `myceo.ir`. Copying the walfare block verbatim would have failed certificate issuance.
- **Deploy order is auth → api → election-web**, because the IdP seeds the `election-web` OIDC client
  and skips it entirely when `ELECTION_DOMAIN` is unset.
- **No secret value was written anywhere.** The Bale key Amir pasted in chat is not in the repo; it
  belongs in `deploy/prod.enc.env` on the server, where the age key lives.

## Verification
- `docker compose -f deploy/docker-compose.newserver.yml config` — **valid**; the new service and all
  new env keys resolve. (`ELECTION_DOMAIN` warns as unset locally, which is expected — it is added to
  the encrypted env on the server.)
- `node --check deploy/ui/server.js` — OK; `election-web` present in the service map.
- **All six SPAs**: `npm run typecheck` clean, `npm run build` clean — this is the check that matters
  after touching the shared launcher.
- `dotnet build` on `src/Auth` and `src/Web` — 0 errors.
- `dotnet test` — **250 unit passed**, **66 functional passed**, 3 failed (the same three pre-existing
  failures recorded in `2026-07-30-election-voter-flow.md`, unrelated).
- Pre-existing lint noise confirmed untouched by this change: `walfare-web`'s `no-redeclare` (recorded
  in GOTCHAS) and a `react-refresh` warning in `landing-panel/src/components/ui/RichTextEditor.tsx`.

**Not deployed.** Nothing was pushed to the server and no container was rebuilt there. The stack cannot
serve a working election until the secrets below exist, and they can only be created by someone with the
age key.

## Follow-ups — what the user must do

1. **Generate the two ballot keys** (`openssl rand -base64 32`, twice — they must differ). Generate once,
   back them up with the age key, and never rotate them while ballots are retained: a changed pepper is
   refused at the first cast, and a changed master key makes every sealed ballot unopenable.
2. **Add to `deploy/prod.enc.env` on the server** (SOPS): `ELECTION_DOMAIN`, `ELECTIONS_VOTER_PEPPER`,
   `ELECTIONS_BALLOT_MASTER_KEY`, `BALE_BOT_TOKEN`, `BALE_WEBHOOK_PATH`, `BALE_WEBHOOK_SECRET`
   (optional), `BALE_SAFIR_ACCESS_KEY`, `BALE_SAFIR_BOT_ID`.
3. **Point `election.myceo.ir`** at the box in ArvanCloud, CDN on (same as the other `myceo.ir` hosts).
4. **Deploy** auth → api → election-web, then rebuild the five other SPAs for the launcher tile.
5. **Register the Bale webhook** with one `curl` to `setWebhook`.
6. **Try the bot by hand before announcing anything.** It has never talked to the real Bale API — see
   `2026-07-30-election-bale-bot.md`. If the code arrives only by SMS, the safir key or `bot_id` is wrong.
7. Steps 6 and 7 are still unconfirmed end to end in a browser (the admin form was never submitted, the
   voter UI never rendered) — both need a real login. Worth doing on staging before an election runs.
