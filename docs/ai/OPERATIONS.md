# OPERATIONS — build, deploy, verify

How work actually reaches production. **No secret values appear in this file** — only the
names of variables. Real values live in `deploy/.env` on the server (committed encrypted as
`deploy/prod.enc.env`; regenerate with `deploy/decrypt-env.sh`).

---

## Ground rules

1. **NuGet is blocked on the dev machine.** Front ends build locally; **.NET builds and tests
   run on the server** inside the SDK container with a cached NuGet volume.
2. **One service at a time.** Not because the box is small — measured 2026-07-27 it has **8 cores
   and 15 GiB** — but because it is **shared**: ~45 containers across other production stacks
   (Traefik, postgres, mssql2019, the `vng-*` suite, finora, sms-service) leave only ~5 GiB free,
   with swap already in use. (The old "host has 4 GB" note described the retired
   `10.249.52.216` server.)
3. **Never restart the shared Docker daemon or Traefik.** Other production stacks live there.
4. **Only rebuild what changed** — plus anything that embeds a changed shared component.
5. Long builds: run them in the background and report the result when they finish.

## Where things run

- Host path: `/data/apps/ceo-portal` (the prior `/data/apps/mabhas19` source tree is retained temporarily as a rollback copy)
- Compose file: `deploy/docker-compose.newserver.yml`, env file `deploy/.env`
- Services: `sqlserver`, `minio`, `auth`, `api`, `mabhas19-web`, `portal-web`, `analytics-web`,
  `admin-web`, `landing-panel`, `mun-sanandaj-web`, `kurdnezam-web`, `walfare-web`, `election-web`
- **`api` must stay at one replica.** The Bale bot keeps its conversation state (including a کد ملی)
  in process memory rather than in a table, on purpose — see PROJECT-MAP. A second replica would make
  every other bot message look like a brand-new chat.
- TLS: shared Traefik. `httpresolver` (HTTP-01) works for domains pointed straight at the box
  (`kurdnezam.ir`, `refahi.kurdnezam.ir`). The `myceo.ir` hosts sit behind the CDN — do not
  repoint them.

## The deploy loop

SSH uses PuTTY `plink`/`pscp` (no `sshpass` on Windows). The server password is read from the
**`CEO_SERVER_PASS`** environment variable — `scripts/deploy.ps1` fails fast without it. Set it as a
*persisted user* variable, not just in the current shell, or tooling that spawns a fresh shell will
not see it:

```powershell
[Environment]::SetEnvironmentVariable('CEO_SERVER_PASS','<password>','User')
```

Never put the value in a file, a commit, or a chat message. `scripts/deploy.ps1` rebuilds and
force-recreates the **whole stack**; for a change confined to one service, prefer the incremental
loop below.

Work is shipped by copying the changed files to the server, rebuilding just those images,
and recreating just those containers.

```bash
# 1. package exactly what the commit changed
tar -czf changes.tgz $(git diff-tree --no-commit-id --name-only -r HEAD)

# 2. copy it up, then on the server:
cd /data/apps/ceo-portal && tar -xzf /tmp/changes.tgz -C /data/apps/ceo-portal
C="docker compose -f deploy/docker-compose.newserver.yml --env-file deploy/.env"
$C build <service>                       # one at a time
$C up -d --no-deps --force-recreate <service>
```

Then **always verify** — a build that finishes is not a deploy that works:

```bash
docker ps --filter name=ceo-portal- --format '{{.Names}}  {{.Status}}' # platform services
docker ps --filter name=mabhas19-web --format '{{.Names}}  {{.Status}}' # product web
curl -k -s -o /dev/null -w '%{http_code}\n' --resolve <host>:443:127.0.0.1 https://<host>/
```

Give a container ~40 s before judging it: a check run while it is still starting returns 404.

**Confirm the change is really in the bundle** (a healthy container can still serve old files):

```bash
ASSET=$(curl -k -s --resolve <host>:443:127.0.0.1 https://<host>/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -k -s --resolve <host>:443:127.0.0.1 https://<host>/$ASSET | grep -c '<a string you just added>'
```

## Building / testing .NET (server)

```bash
docker run --rm -v /data/apps/ceo-portal:/src -w /src -v m19-nuget:/root/.nuget \
  mcr.microsoft.com/dotnet/sdk:10.0 bash -lc 'dotnet build src/Web/Web.csproj'
```

Swap in `dotnet test <project> --filter "FullyQualifiedName~<Class>"` to run tests.
The `m19-nuget` volume makes the first restore (~10 min) a one-off; later runs take ~1 min.

## Front-end checks (local, before shipping)

```bash
cd <app> && npm run build && npm run lint && npx vitest run
```

Known pre-existing lint errors in `walfare-web`: `ReservationStatus` / `PaymentStatus`
"already defined" — the deliberate const+type pattern. Not introduced by new work.

## Diagnosing a live problem

Prefer evidence over guessing:

```bash
docker logs ceo-portal-api  --since 30m 2>&1 | grep -iE '<feature>|exception' | tail -20
docker logs ceo-portal-auth --since 30m 2>&1 | grep -A6 '<the failing operation>'
```

For data questions, read the row through the SQL container (`ceo-portal-sqlserver`,
`sqlcmd` in `/opt/mssql-tools18/bin`) using the SA password from the environment — never
paste credentials into a file or a commit.

## Docker project and volume identity

The production Compose project is `ceo-portal`. Platform images and containers use the
`ceo-portal-*` prefix; `mabhas19-web` intentionally keeps the product name. Production state is
mounted from the explicitly named volumes `ceo-portal_mssqldata` and
`ceo-portal_miniodata`.

Changing top-level Compose `name:` changes the default physical volume names. Never switch a
running installation from the old `mabhas19` project to `ceo-portal` with a plain `up`: Docker
would create empty volumes. During migration, stop API/Auth writers, stop SQL Server and MinIO,
copy `mabhas19_mssqldata` and `mabhas19_miniodata` into the explicit CEO Portal volumes, compare
file inventories, then start SQL Server and MinIO alone and verify data before starting apps.
Keep the old volumes and compose file for rollback; never use `down -v`.

## Configuration names you may need

| Variable | Used by | Meaning |
|---|---|---|
| `KURDNEZAM_DB_CONN` | api, auth | organisation membership database (engineer lookup) |
| `ANALYTICS_DB_CONN` | api | database the analytics SQL engine reads |
| `IRK_PASSPHRASE` | api | Iran Kish merchant pass phrase |
| `IranKish__CallbackUrl` | api | where the bank posts the payer back |
| `MIHAN_SMS_USERNAME` | auth | Mihan SMS Center username |
| `MIHAN_SMS_PASSWORD` | auth | Mihan SMS Center password |
| `MIHAN_SMS_SENDER` | auth | Mihan SMS Center sender number |
| `AUTH_DOMAIN`, `API_DOMAIN`, `MINIO_DOMAIN`, `PORTAL_DOMAIN` | all | canonical public host names |
| `LEGACY_API_DOMAIN`, `LEGACY_MINIO_DOMAIN` | Traefik | temporary compatibility routes for old clients and presigned URLs |
| `MSSQL_SA_PASSWORD` | sqlserver | database admin password |
| `ELECTION_DOMAIN` | Traefik, auth, api | `election.myceo.ir` |
| `ELECTIONS_VOTER_PEPPER` | api | HMAC key for the voter roll. base64, 32 bytes |
| `ELECTIONS_BALLOT_MASTER_KEY` | api | root of the per-election ballot keys. base64, 32 bytes |
| `BALE_BOT_TOKEN` | api | Bale bot token; empty makes the webhook 404 |
| `BALE_WEBHOOK_PATH` | api | unguessable path segment after `/api/BaleWebhook/` |
| `BALE_WEBHOOK_SECRET` | api | optional `X-Bale-Webhook-Secret` shared value |
| `BALE_SAFIR_ACCESS_KEY` | api | safir `api-access-key`, pushes the vote code by phone |
| `BALE_SAFIR_BOT_ID` | api | numeric `bot_id` safir requires in the body |

Public, non-secret gateway settings (terminal id, acceptor id, RSA public key) live in
`src/Web/appsettings.json`.

## Election service — first deploy

Everything below is one-time. The service is inert without it: with no keys the API reports voting
unavailable, and with no bot token the webhook returns 404.

**1. Generate the two ballot keys.** They must differ, and each is base64 of exactly 32 bytes:

```bash
openssl rand -base64 32   # ELECTIONS_VOTER_PEPPER
openssl rand -base64 32   # ELECTIONS_BALLOT_MASTER_KEY
```

> **Generate once and never rotate while ballots are retained.** Changing the pepper re-hashes every
> voter — the API refuses rather than silently handing everyone a second vote, because it pins a
> fingerprint on the election at the first cast. Changing the master key makes every sealed ballot
> unopenable, i.e. **the result is lost**. Losing the keys loses the election; back them up with the
> age key.

**2. Add every new variable to `deploy/prod.enc.env` on the server** (SOPS; the age private key lives
at `/srv/mabhas19/secrets/age.key` and nowhere else). See the table above plus `ELECTION_DOMAIN`.
Bale values come from `https://business.bale.ai/dashboard/safir`.

**3. DNS.** `election.myceo.ir` is under `myceo.ir` and therefore **behind the ArvanCloud CDN**, so its
Traefik router uses `myresolver` (DNS-01) like every other `myceo.ir` host — `httpresolver` cannot
complete HTTP-01 through the CDN. Do not repoint the host to bypass the CDN.

**4. Deploy, one service at a time** (see the deploy loop above). Order matters:
`auth` first (it seeds the `election-web` OIDC client and needs `ELECTION_DOMAIN` to do so), then
`api`, then `election-web`.

**5. The launcher.** `AppSwitcher.tsx` gained the election tile, and it is byte-identical in **all six**
SPAs — so `admin-web`, `analytics-web`, `landing-panel`, `mun-sanandaj-web` and `walfare-web` must be
rebuilt too, or the ones you skip keep serving a launcher without it.

**6. Register the Bale webhook once** (there is deliberately no registrar service):

```bash
curl -F "url=https://api.myceo.ir/api/BaleWebhook/<BALE_WEBHOOK_PATH>" \
     https://tapi.bale.ai/bot<BALE_BOT_TOKEN>/setWebhook
```

**7. Check it end to end before announcing an election.** The bot has never run against the real Bale
API. Send `/start`, then a کد ملی, and confirm the code arrives **both** in Bale and by SMS. If only the
SMS arrives, the safir key, the `bot_id`, or the account state is wrong — the code reports the Bale
channel as "not delivered" and carries on, so nothing looks broken.

**Do not run an Extended Events or Profiler trace on `CeoDb` during a live election.** EF batches the
receipt and the ballot inserts into one statement, so a statement-level trace pairs a voter's roll
entry with their sealed ballot. This is a documented exposure, not a hypothetical.

## Platform-host cutover

The canonical hosts are `myceo.ir`, `api.myceo.ir`, and `s3.myceo.ir`; the OIDC issuer remains
`auth.myceo.ir`. Before deployment, edit `deploy/prod.enc.env` **on the server** with SOPS to set
the canonical values and preserve the old API/S3 values as `LEGACY_API_DOMAIN` and
`LEGACY_MINIO_DOMAIN`. Run `deploy/decrypt-env.sh`, then deploy the affected services. Do not
remove the legacy DNS records or Traefik routes until old web/mobile bundles and short-lived
presigned URLs have aged out. Update Iran Kish's callback to
`https://api.myceo.ir/api/walfare/payments/irk-return` before enabling payments on the new host.

## Things that are safe to assume broken

- `myresolver` (DNS-01) certificates — use `httpresolver` for direct-DNS hosts.
- The municipality sync worker fails on an expired remote certificate. Narrowed 2026-07-27 from the
  live stack trace: it is the **PDF host `eservice.kurdnezam.ir`**, failing in
  `MunSanandajPdfFetcher.FetchAsBase64Async` (`AuthenticationException … NotTimeValid`) — *not* the
  mahyapardaz API. Every `SaveEngineerReport` run dies fetching the PDF, before it ever reaches the
  municipality. The fix is renewing that certificate; nothing in this repo will help.
