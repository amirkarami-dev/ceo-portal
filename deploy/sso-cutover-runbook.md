# SSO Cutover Runbook — `auth.myceo.ir` go-live

**Purpose:** Bring the central IdP online and switch `mabhas19` web + API to validate IdP JWTs.
This document is written, not executed. Execute it only after Phase 3 of the OIDC design is
fully verified locally (see `plan_development/01-development/sso-oidc.md §8`).

**Constraints (same as all production deploys):**
- Server `10.249.52.216`, path `/srv/mabhas19`.
- SSH via PuTTY `plink`/`pscp -pw` (no `sshpass`).
- `mcr.microsoft.com` and Docker Hub's blob CDN are blocked on the server — build images locally,
  ship via `docker save | gzip | pscp | docker load`.
- The server hosts other production stacks (mailcow, supabase). **Never restart the shared Docker
  daemon.** Only `compose up -d` the specific services being changed.
- Traefik is external network `traefik`, cert resolver `myresolver` (ArvanCloud DNS challenge).

**Rollback safety:** the migration script (`sso-migrate-users.sql`) is additive — it never
touches source rows. The old `api`/`web` images are preserved until Step 5 succeeds. Rollback
means re-deploying the previous image tags; the IdP and `Mabhas19AuthDb` can remain.

---

## Pre-requisites (complete before day of cutover)

### P1 — DNS

`auth.myceo.ir` A record → `10.249.52.216` in Arvancloud DNS — **confirmed already done.**
Verify propagation before proceeding:

```powershell
nslookup auth.myceo.ir
# Expected: 10.249.52.216
```

### P2 — OpenIddict signing certificate

The IdP needs a **persisted RSA signing cert** (not an ephemeral dev cert) so JWKS is stable
across container restarts and the API can validate tokens.

Generate locally (one-time; keep the file secure — treat it like a private key):

```powershell
# Option A: openssl (if available)
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes `
    -keyout openiddict.key -out openiddict.crt `
    -subj "/CN=auth.myceo.ir/O=Mabhas19"
openssl pkcs12 -export -out openiddict.pfx `
    -inkey openiddict.key -in openiddict.crt `
    -passout pass:<OPENIDDICT_CERT_PASSWORD>

# Option B: PowerShell New-SelfSignedCertificate (Windows)
$cert = New-SelfSignedCertificate -Subject "CN=auth.myceo.ir" `
    -KeyAlgorithm RSA -KeyLength 4096 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(10)
$pwd = ConvertTo-SecureString -String "<OPENIDDICT_CERT_PASSWORD>" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath openiddict.pfx -Password $pwd
```

Upload the PFX to the server:

```powershell
# Create the certs directory on the server (if not present)
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "mkdir -p /srv/mabhas19/deploy/certs"

# Upload the PFX
pscp -pw "<SERVER_PWD>" openiddict.pfx admin1@10.249.52.216:/srv/mabhas19/deploy/certs/openiddict.pfx

# Verify
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "ls -lh /srv/mabhas19/deploy/certs/"
```

### P3 — `.env` additions

Add/verify the following in `deploy/.env` on the server (`/srv/mabhas19/deploy/.env`):

```dotenv
# IdP domain (used in Traefik labels and api Auth__Authority)
AUTH_DOMAIN=auth.myceo.ir

# Signing cert password (matches what you used when exporting the PFX)
OPENIDDICT_CERT_PASSWORD=<strong-random>

# OIDC client secrets (generated with a password manager; min 32 chars)
MABHAS19_WEB_CLIENT_SECRET=<strong-random>
PLAN_WEB_CLIENT_SECRET=<strong-random>

# Auth.js (NextAuth v5) runtime vars for the web container
# AUTH_SECRET: run `openssl rand -base64 32` to generate
AUTH_SECRET=<strong-random>
AUTH_MABHAS19_ISSUER=https://auth.myceo.ir
AUTH_MABHAS19_ID=mabhas19-web
AUTH_MABHAS19_SECRET=<same-as-MABHAS19_WEB_CLIENT_SECRET>
```

> **Note:** `AUTH_SECRET`, `AUTH_MABHAS19_ISSUER`, `AUTH_MABHAS19_ID`, and `AUTH_MABHAS19_SECRET`
> must be present in the `web` service environment at runtime for Auth.js to function.
> Add them to the `web` service `environment:` block in `docker-compose.server.yml` if not already
> present (TODO: confirm before cutover).

Upload the updated `.env` to the server:

```powershell
pscp -pw "<SERVER_PWD>" deploy/.env admin1@10.249.52.216:/srv/mabhas19/deploy/.env
```

### P4 — Tag the previous images for rollback

On the server, before anything else, tag the current `api` and `web` images as `rollback`:

```powershell
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 `
    "docker tag mabhas19-api:deploy mabhas19-api:rollback && docker tag mabhas19-web:deploy mabhas19-web:rollback"
```

---

## Step 1 — Build the `auth` image locally

```powershell
# From the repo root (where mcr.microsoft.com is reachable)
docker build -f deploy/Dockerfile.auth -t mabhas19-auth:deploy .
```

---

## Step 2 — Rebuild the `api` and `web` images locally

The API now validates IdP JWTs (AddJwtBearer replaces AddBearerToken); the web uses Auth.js.
Both images must be rebuilt from the SSO branch.

```powershell
docker build -f deploy/Dockerfile.api -t mabhas19-api:deploy .
docker build -f deploy/Dockerfile.web -t mabhas19-web:deploy .
```

---

## Step 3 — Save, transfer, and load all three images

```powershell
# Save + gzip (run in parallel or sequentially — sequential shown for clarity)
docker save mabhas19-auth:deploy | gzip > mabhas19-auth-deploy.tar.gz
docker save mabhas19-api:deploy  | gzip > mabhas19-api-deploy.tar.gz
docker save mabhas19-web:deploy  | gzip > mabhas19-web-deploy.tar.gz

# Transfer
pscp -pw "<SERVER_PWD>" mabhas19-auth-deploy.tar.gz admin1@10.249.52.216:/srv/mabhas19/
pscp -pw "<SERVER_PWD>" mabhas19-api-deploy.tar.gz  admin1@10.249.52.216:/srv/mabhas19/
pscp -pw "<SERVER_PWD>" mabhas19-web-deploy.tar.gz  admin1@10.249.52.216:/srv/mabhas19/

# Load on the server (single plink call)
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  gunzip -c mabhas19-auth-deploy.tar.gz | docker load && \
  gunzip -c mabhas19-api-deploy.tar.gz  | docker load && \
  gunzip -c mabhas19-web-deploy.tar.gz  | docker load"
```

---

## Step 4 — Bring up the IdP

Start only the `auth` service. SQL Server and MinIO are already running — do not recreate them.

```powershell
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env up -d auth"
```

The IdP on first boot:
1. Creates `Mabhas19AuthDb` and applies its EF Core migrations.
2. Seeds roles (`Administrator`, `User`), OIDC clients/scopes, and (if `AdminUser__Email` +
   `AdminUser__Password` are set) an admin user.

Wait ~20 seconds for migrations, then verify:

```powershell
# IdP logs (look for "Application started" and no errors)
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  docker compose -f deploy/docker-compose.server.yml logs --tail=60 auth"

# OIDC discovery endpoint (must return JSON with issuer = https://auth.myceo.ir)
curl.exe -fsS https://auth.myceo.ir/.well-known/openid-configuration

# JWKS endpoint (must return RSA keys — not empty)
curl.exe -fsS https://auth.myceo.ir/.well-known/jwks
```

---

## Step 5 — Run the user migration

Copy the migration script to the server and execute it inside the `sqlserver` container.

```powershell
# Upload script
pscp -pw "<SERVER_PWD>" deploy/sso-migrate-users.sql admin1@10.249.52.216:/srv/mabhas19/deploy/

# Run via sqlcmd inside the container (adjust SA password from .env)
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "docker exec mabhas19-sqlserver-1 \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"\$MSSQL_SA_PASSWORD\" -C \
  -i /tmp/sso-migrate-users.sql 2>/dev/null || \
  docker exec mabhas19-sqlserver-1 \
  /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P \"\$MSSQL_SA_PASSWORD\" \
  -i /tmp/sso-migrate-users.sql"
```

> The script tries `mssql-tools18` first (SQL Server 2019+), then falls back to `mssql-tools`.
> Adjust the container name (`mabhas19-sqlserver-1`) to match what `docker ps` shows.

Alternatively, copy the script into the container first:

```powershell
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "docker cp \
  /srv/mabhas19/deploy/sso-migrate-users.sql mabhas19-sqlserver-1:/tmp/"
```

**Inspect the output.** The script prints a verification table. All `Delta_SourceMinusTarget`
values must be `<= 0`. A delta of `0` means source rows are fully present in the target. A
negative delta is expected for rows the IdP seeded itself (e.g. the admin user if re-seeded).
A **positive** delta means rows are missing — investigate and re-run the script.

---

## Step 6 — Cut over `api` and `web`

Recreate the API and web containers with the new images. SQL Server and MinIO are untouched.

```powershell
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env up -d api web"
```

Watch the API logs — it should start, connect to SQL Server, apply any pending migrations,
and print "Application started":

```powershell
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  docker compose -f deploy/docker-compose.server.yml logs --tail=80 api"
```

---

## Step 7 — End-to-end verification

Run through the verification checklist below. Do not proceed to "done" unless all items pass.

---

## Rollback procedure

If any step after Step 4 fails and you need to revert `api`/`web` to the pre-SSO images:

```powershell
# Re-tag rollback images as :deploy
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 `
    "docker tag mabhas19-api:rollback mabhas19-api:deploy && docker tag mabhas19-web:rollback mabhas19-web:deploy"

# Restart api + web with the old images
plink -pw "<SERVER_PWD>" admin1@10.249.52.216 "cd /srv/mabhas19 && \
  docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env up -d api web"
```

The IdP (`auth`) and `Mabhas19AuthDb` can remain running — they are additive and harmless.
The old `api`/`web` images used the Identity bearer model and will resume functioning
immediately once restored.

---

## Verification checklist

Complete every item before declaring the cutover done.

### Infrastructure
- [ ] `nslookup auth.myceo.ir` resolves to `10.249.52.216`.
- [ ] `/srv/mabhas19/deploy/certs/openiddict.pfx` exists on the server.
- [ ] All Auth.js env vars (`AUTH_SECRET`, `AUTH_MABHAS19_ISSUER`, `AUTH_MABHAS19_ID`,
      `AUTH_MABHAS19_SECRET`) are set in the `web` service environment.
- [ ] `docker ps` shows `auth`, `api`, `web`, `sqlserver`, and `minio` all `Up`.
- [ ] No other production stacks were affected (`docker ps` shows mailcow/supabase still `Up`).
- [ ] The shared Docker daemon was NOT restarted.

### IdP health
- [ ] `https://auth.myceo.ir/.well-known/openid-configuration` returns JSON with
      `"issuer": "https://auth.myceo.ir"`.
- [ ] `https://auth.myceo.ir/.well-known/jwks` returns at least one RSA key (`"kty": "RSA"`).
- [ ] IdP container logs show no startup errors; "Application started" is present.

### User migration
- [ ] `sso-migrate-users.sql` ran without SQL errors.
- [ ] Verification table shows `Delta_SourceMinusTarget <= 0` for all 7 tables.
- [ ] `AspNetUsers` target count >= source count (accounting for any IdP-seeded admin).

### API health
- [ ] `curl.exe -fsS https://api.mabhas19.myceo.ir/alive` returns `200`.
- [ ] `curl.exe -fsS https://api.mabhas19.myceo.ir/scalar` (or equivalent docs route) loads.
- [ ] A request with no token → `401 Unauthorized` (JWT bearer enforced).
- [ ] A request with a valid IdP JWT → `200 OK` for a protected endpoint.
- [ ] A request with an old Identity bearer token → `401` (old tokens are no longer valid).

### Web login flow
- [ ] Visiting `https://mabhas19.myceo.ir` redirects unauthenticated users to the IdP login page.
- [ ] Logging in with **username/password** at the IdP completes, returns to the web app,
      and the user is shown their dashboard.
- [ ] Logging in with **mobile OTP** completes end-to-end.
- [ ] Logging in with **Google** completes end-to-end.
- [ ] `GET /api/Users/me` equivalent (or IdP `/connect/userinfo`) returns correct roles.
- [ ] An admin user sees the admin area; a regular user does not.
- [ ] Logging out clears the session and redirects to login.

### Data integrity
- [ ] An existing user can log in with their existing password (password hash preserved).
- [ ] An existing user's projects are visible (OwnerId links intact).
- [ ] Project creation, assessment save, and PDF download all work.
- [ ] Project creation is unlimited (the per-user project cap has been removed; only an inactive account is blocked).

### SSO across services (if `plan.myceo.ir` is live)
- [ ] A user logged in to `mabhas19.myceo.ir` is not prompted to log in again at `plan.myceo.ir`.
