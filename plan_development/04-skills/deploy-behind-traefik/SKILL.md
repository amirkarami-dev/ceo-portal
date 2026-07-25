---
name: deploy-behind-traefik
description: Use when deploying a Dockerized auth (OIDC IdP) + web + API stack to a server that sits behind an EXISTING shared Traefik and cannot reach mcr.microsoft.com / Docker Hub's blob CDN — build the auth/api/web images locally, ship them via docker save | gzip + pscp + docker load, attach to Traefik's external network with its cert resolver, pull DB/object-store images through the docker.arvancloud.ir mirror, decrypt secrets on the server with SOPS, recreate only changed services, and never restart the shared daemon.
---

# Deploy Behind an Existing Traefik (image-transfer, blocked registries)

The target server runs **other production stacks** behind a **shared Traefik** and **cannot pull from
`mcr.microsoft.com` or Docker Hub's blob CDN**. So: build the `auth`/`api`/`web` images **locally** (where
those registries are reachable), transfer them as gzipped tarballs over SSH, `docker load`, and bring up only
the app services on the existing Traefik network. Base images (DB, object store) come from the
`docker.arvancloud.ir` mirror. Replace `<app>`, `<server-ip>`, `<ssh-user>`, `<srv-path>`, the `*_DOMAIN`s,
and the cert resolver name.

This stack has **four app services**: `sqlserver`, `minio`, **`auth`** (the OpenIddict OIDC IdP — port
`8080` → `auth.<domain>`), `api`, and `web`. The **`auth` service is not optional**: it owns all login
(password/OTP/Google) and issues the signed JWTs every other service trusts. `api` is a JWT **resource
server** (validates tokens via the IdP's JWKS); `web` is an **OIDC client** via Auth.js (NextAuth v5) and
needs its own runtime env (`AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL`, `AUTH_MABHAS19_ISSUER`,
`AUTH_MABHAS19_ID`, `AUTH_MABHAS19_SECRET`).

## Prerequisites / invariants

- Server has Docker + a running Traefik that owns ports 80/443, an **external network named `traefik`**, and
  a cert resolver (e.g. `myresolver`, ArvanCloud DNS challenge). Your stack **attaches** to these; it does
  **not** run its own Traefik.
- SSH via PuTTY `plink` / `pscp -pw` (no `sshpass`).
- `deploy/.env` on the server holds all runtime **secrets** (DB/MinIO passwords, OIDC client IDs/secrets,
  `AUTH_SECRET`, SMS/Google keys). It is **not committed**: the encrypted `deploy/prod.enc.env` (SOPS + age)
  is, and `deploy/decrypt-env.sh` regenerates `deploy/.env` **on the server before `compose up`** (the age
  private key lives only on the server). App config (e.g. `NEXT_PUBLIC_API_BASE`) is **baked into the image**
  at build time, so an image-only deploy needs **no `git pull` on the server**.
- **Never `docker restart`/`systemctl restart docker`** — it would take down the co-tenant stacks
  (e.g. mailcow, supabase). Only `compose up -d` the `api`/`web` services.

## Workflow

### 1. The server compose file attaches to Traefik + uses the mirror

`deploy/docker-compose.server.yml` declares the `traefik` network as `external` and routes each service via
Traefik labels. DB/object-store images are pulled through `docker.arvancloud.ir`. (The .NET base image for
the API can't be mirrored, so that image is shipped from local in step 2.)

```yaml
services:
  auth:                                      # OpenIddict OIDC IdP — owns login, issues JWTs (NOT optional)
    image: <app>-auth:deploy                 # loaded from a transferred tarball (mcr is blocked)
    restart: unless-stopped
    depends_on:
      sqlserver:
        condition: service_healthy
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__<AuthDbName>: "Server=sqlserver,1433;Database=<AuthDbName>;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True;"
      OpenIddict__SigningCertificatePath: /certs/openiddict.pfx     # persisted signing cert (mounted)
      OpenIddict__SigningCertificatePassword: ${OPENIDDICT_CERT_PASSWORD}
      Clients__<App>Web__Secret: ${<APP>_WEB_CLIENT_SECRET}         # OIDC client registration for web
    volumes:
      - <srv-path>/certs:/certs:ro
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik"
      - "traefik.http.routers.<app>auth.rule=Host(`${AUTH_DOMAIN}`)"
      - "traefik.http.routers.<app>auth.entrypoints=websecure"
      - "traefik.http.routers.<app>auth.tls.certresolver=myresolver"
      - "traefik.http.services.<app>auth.loadbalancer.server.port=8080"
    networks: [internal, traefik]

  api:
    image: <app>-api:deploy                 # loaded from a transferred tarball (mcr is blocked)
    restart: unless-stopped
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__<DbName>: "Server=sqlserver,1433;Database=<DbName>;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True;"
      Auth__Authority: "https://${AUTH_DOMAIN}"   # validates JWTs against the IdP (resource server)
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik"
      - "traefik.http.routers.<app>api.rule=Host(`${API_DOMAIN}`)"
      - "traefik.http.routers.<app>api.entrypoints=websecure"
      - "traefik.http.routers.<app>api.tls.certresolver=myresolver"
      - "traefik.http.services.<app>api.loadbalancer.server.port=8080"
    networks: [internal, traefik]

  web:
    image: <app>-web:deploy
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_BASE: "https://${API_DOMAIN}"
      # Auth.js (NextAuth v5) OIDC client → the IdP. RUNTIME values (not baked at build).
      # AUTH_TRUST_HOST is required because the app runs behind Traefik (proxied host/proto).
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_TRUST_HOST: "true"
      AUTH_URL: "https://${WEB_DOMAIN}"
      AUTH_MABHAS19_ISSUER: "https://${AUTH_DOMAIN}"
      AUTH_MABHAS19_ID: "<app>-web"
      AUTH_MABHAS19_SECRET: ${<APP>_WEB_CLIENT_SECRET}
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik"
      - "traefik.http.routers.<app>web.rule=Host(`${WEB_DOMAIN}`)"
      - "traefik.http.routers.<app>web.entrypoints=websecure"
      - "traefik.http.routers.<app>web.tls.certresolver=myresolver"
      - "traefik.http.services.<app>web.loadbalancer.server.port=3000"
    networks: [traefik]

  minio:
    image: docker.arvancloud.ir/minio/minio:latest      # mirror — Docker Hub blob CDN is blocked
    # ... (object store, also Traefik-routed for presigned URLs)

networks:
  traefik:
    external: true                          # provided by the server's /srv/traefik
  internal:
    driver: bridge
```

> The .NET API honours `X-Forwarded-*` from Traefik (`UseForwardedHeaders`) and advertises HSTS itself,
> since TLS terminates at the proxy. Object storage is reached via its **public host** so presigned
> download URLs are valid for browsers.

> **Caution (web behind Traefik): do NOT wrap `next-intl` in Auth.js's `auth()` middleware helper.**
> With `AUTH_TRUST_HOST=true` + `AUTH_URL` behind the proxy, `auth()` rebases `next-intl`'s `/`→`/<default-locale>`
> rewrite to an **absolute** URL that the standalone server then proxies — failing with `EAI_AGAIN` and
> breaking the default-locale site. Keep middleware as a plain **session-cookie-presence** gate (let
> `next-intl` own the response); do real role/identity decryption **server-side** in an RSC `auth()` call.

### 2. Build the images locally (where mcr / Docker Hub work)

The build context is the **repo root** (monorepo). The web Dockerfile drops the Expo `mobile` workspace and
uses Next.js `output: "standalone"`; the API Dockerfile multi-stages `sdk` → `aspnet` and installs the PDF
native deps.

```powershell
docker build -f deploy/Dockerfile.auth -t <app>-auth:deploy .
docker build -f deploy/Dockerfile.api -t <app>-api:deploy .
docker build -f deploy/Dockerfile.web -t <app>-web:deploy .
```

### 3. Save + gzip + transfer

```powershell
docker save <app>-auth:deploy | gzip > <app>-auth-deploy.tar.gz
docker save <app>-api:deploy  | gzip > <app>-api-deploy.tar.gz
docker save <app>-web:deploy  | gzip > <app>-web-deploy.tar.gz

pscp -pw "<SERVER_PWD>" <app>-auth-deploy.tar.gz <ssh-user>@<server-ip>:<srv-path>/
pscp -pw "<SERVER_PWD>" <app>-api-deploy.tar.gz  <ssh-user>@<server-ip>:<srv-path>/
pscp -pw "<SERVER_PWD>" <app>-web-deploy.tar.gz  <ssh-user>@<server-ip>:<srv-path>/
```

### 4. Load + recreate ONLY the changed services

First **decrypt the secrets** (`./deploy/decrypt-env.sh` regenerates `deploy/.env` from the committed
`prod.enc.env` using the server's age key), then `docker load` the tarballs and bring up just the changed
app services. The DB/object-store containers and the shared daemon are left untouched. Use `--no-deps` so a
single changed service is recreated without touching its dependencies, and `--remove-orphans` to prune
containers dropped from the compose file.

```powershell
plink -pw "<SERVER_PWD>" <ssh-user>@<server-ip> "cd <srv-path> && \
  ./deploy/decrypt-env.sh && \
  gunzip -c <app>-auth-deploy.tar.gz | docker load && \
  gunzip -c <app>-api-deploy.tar.gz | docker load && \
  gunzip -c <app>-web-deploy.tar.gz | docker load && \
  docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env up -d --no-deps --remove-orphans auth api web"
```

(First-time bring-up of the DB/object store: run the same `compose up -d` for those services once — their
images come from the `docker.arvancloud.ir` mirror. The `auth` IdP and the API each apply their own EF Core
migrations on startup, against their own databases.)

## Verification

```powershell
# Stack status + API logs (watch the EF migration apply)
plink -pw "<SERVER_PWD>" <ssh-user>@<server-ip> "cd <srv-path> && \
  docker compose -f deploy/docker-compose.server.yml ps && \
  docker compose -f deploy/docker-compose.server.yml logs --tail=50 api"

# Live endpoints (TLS via the shared Traefik)
curl.exe -fsS  https://<AUTH_DOMAIN>/.well-known/openid-configuration   # IdP discovery + JWKS reachable
curl.exe -fsS  https://<API_DOMAIN>/alive          # API health
curl.exe -fsSI https://<WEB_DOMAIN>/               # web returns 200 with a valid cert
```

- `docker compose ps` shows `auth`/`api`/`web` `Up` and the DB `healthy`; co-tenant stacks remain untouched.
- The `auth` and `api` logs each show their migrations applied (and admin seeding if configured).
- All three domains serve over HTTPS with a valid Traefik-issued certificate; the IdP's OIDC discovery
  document resolves, and object-store presigned URLs (if used) resolve from a browser.
