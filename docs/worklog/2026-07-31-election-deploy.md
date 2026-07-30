# Election service: deployed to production

- **Date:** 2026-07-31
- **Area:** election / infra
- **Branch / commits:** `election-steps-6-to-9` — deployed at `30995ce`
- **Status:** live at `https://election.myceo.ir`; bot registered; no election created yet

## Goal
"deploy" — put steps 6–9 on the production box and make `https://election.myceo.ir` serve.

## What was done
Incremental, one service at a time, never the whole stack:

1. `git archive HEAD` (3.1 MB) uploaded and extracted over `/data/apps/ceo-portal`; `deploy/.env` and
   `deploy/certs` deliberately untouched.
2. Current images tagged `:rollback` for api, auth and the five SPAs.
3. **auth** — built, `up -d --no-deps`, healthy. Logged `Created OIDC client election-web.`
4. **api** — built, started, healthy. Election tables created, `PK_ElectionVoteReceipts` unique.
5. **election-web** — new image and container, healthy, Traefik router on `myresolver`.
6. **admin-web, analytics-web, landing-panel, mun-sanandaj-web, walfare-web** — rebuilt and restarted
   for the shared launcher tile.
7. Bale webhook registered against `https://api.myceo.ir/api/BaleWebhook/<path>`.

**`scripts/deploy.ps1` was deliberately NOT used.** It rebuilds every service `--no-cache` and runs
`up -d --force-recreate` on the whole stack including SQL Server, and its build list does not contain
`election-web` — the new site would never have been built.

## Root cause — two secrets went in wrong, both failing silently
1. **The safir key was corrupted in transit.** Piping it from PowerShell into `plink` added a UTF-8 BOM
   in front and a `\r` behind, so a 16-character key became 18. The file *looked* fine. Caught by
   counting non-printable characters, fixed by transferring base64 of the raw bytes and proving the
   SHA-256 matched on both sides.
2. **The safir key had been pasted into `BALE_BOT_TOKEN`.** Bale answers `404 Not Found` for an unknown
   token — indistinguishable from a missing method. Caught because the value was 16 characters with no
   colon; a real token is `<bot_id>:<secret>`, ~46 characters. Amir supplied the right one and `getMe`
   then returned `kurdnezambot`.

Both are in GOTCHAS. Both would have surfaced only on election day, as "some people never get a code".

## Verification (all live, against the public hosts)
- `https://election.myceo.ir` → **200**, valid certificate (`ssl_verify_result: 0`), title «سامانه انتخابات».
- Every other host still 200: auth, api, admin, analytics, landing-panel, mun-sanandaj, refahi,
  kurdnezam.ir, myceo.ir, mabhas19. **13 containers healthy.**
- IdP routes the new client correctly:
  `authorize?client_id=election-web` → `302 /Account/EngineerLogin?…&service=election`.
- Database: `Elections`, `ElectionCandidates`, `ElectionEligibleReshtes`, `ElectionBallots`,
  `ElectionVoteReceipts` all present and empty; the unique key on the receipts table exists — that is
  what enforces one vote per person.
- API: `/api/ElectionAdmin`, `/api/Election/1/result`, `/api/Election/MyBallots` all **401** when
  unauthenticated. `/api/BaleWebhook/<wrong path>` → **404**.
- The election tile is in the shipped JS of **all six** SPAs (checked by fetching each bundle).
- Bale: `getMe` → `kurdnezambot`; `setWebhook` → `ok:true`; `getWebhookInfo` → our URL, 0 pending.

**Not verified.** No human has driven the UI: no election has been created through the admin form, no
ballot cast on the web, and no `/start` sent to the bot. The SMS channel is still unexercised — the
`Sms__*` settings are shared with the IdP and were not changed, but no vote code has gone through them.

## Follow-ups
- **Create one test election and vote in it**, on the web and through the bot, before announcing
  anything real. That exercises the three paths no test can cover.
- **Back up `deploy/.env` off-server.** It is the only copy of the ballot keys; losing them makes every
  sealed ballot unreadable. There is no SOPS on this box any more (see GOTCHAS).
- Merge `election-steps-6-to-9` into `main` — production is running that branch's code.
- `deploy/prod.enc.env` is stale and undecryptable; either restore an age key or delete it so nobody
  trusts it.
- `scripts/deploy.ps1` still omits `walfare-web` and `election-web` from its build list, and still does
  a full-stack force-recreate. Worth fixing or retiring.
