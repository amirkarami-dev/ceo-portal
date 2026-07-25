# Local Setup

How to bring `<PLACEHOLDER>` up on a dev machine: backing services (SQL Server + MinIO) in
Docker, the .NET API, the Next.js web app, and the Expo mobile app. Steps derived from the
reference project (Mabhas19).

---

## 0. Prerequisites

- **.NET 10 SDK** (the repo pins it via `global.json`).
- **Node.js >= 20.9** (root `package.json` `engines`).
- **Docker** (for SQL Server + MinIO).
- **`dotnet-ef` global tool matching EF Core 10** (only needed to *create* migrations):
  ```bash
  dotnet tool update -g dotnet-ef --version "10.0.*"
  ```
- **Mobile only**: Android SDK + NDK `27.1.12297006`, JDK 17, and the Expo CLI (via `npx`).

Clone the repo and install JS deps once from the **repo root** (npm workspaces hoists web /
mobile / packages):

```bash
npm install
```

---

## 1. Start backing services (SQL Server + MinIO)

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```

This runs only **SQL Server** (`sa`) and **MinIO** (`minioadmin`) — the two things the API
needs. MinIO console is at `http://localhost:9001` (API at `:9000`); SQL Server listens on
`1433`.

> If you already run a local SQL Server on 1433, you'll get a port/host clash and possible
> IPv4-vs-IPv6 confusion. See `gotchas.md` (#4): pin the host to `127.0.0.1` or use your own
> instance via user-secrets.

---

## 2. Run the API

```bash
dotnet build <PLACEHOLDER>.slnx          # build everything (output → ./artifacts/)
dotnet run --project src/Web             # API on http://localhost:5000
```

- API docs (Scalar) at **`http://localhost:5000/scalar`** (root `/` redirects there).
- On startup the API **applies migrations and seeds** automatically
  (`ApplicationDbContextInitialiser`): it creates the `Administrator`/`User` roles and, if
  `AdminUser:Email`/`AdminUser:Password` are configured, an admin user.

### Backend config (local)
`src/Web/appsettings.Development.json` already contains dev values:

```json
{
  "ConnectionStrings": {
    "<PLACEHOLDER>Db": "Server=127.0.0.1,1433;Database=<PLACEHOLDER>Db;User Id=sa;Password=<dev-sa-password>;TrustServerCertificate=True;"
  },
  "Cors": { "AllowedOrigins": [ "http://localhost:3000" ] },
  "Minio": { "Endpoint": "localhost:9000", "AccessKey": "minioadmin", "SecretKey": "minioadmin", "Bucket": "<PLACEHOLDER>", "UseSSL": false, "PublicEndpoint": "" },
  "AdminUser": { "Email": "admin@<PLACEHOLDER>.local", "Password": "<dev-admin-password>" },
  "Otp": { "LogCode": true }
}
```

- **`Otp.LogCode: true`** → OTP codes are written to the API logs (no real SMS needed in
  dev). SMS provider defaults to `log`.
- **CORS** allows the web dev origin `http://localhost:3000`.
- For your *own* local SQL Server or any secret, prefer **user-secrets** over editing
  appsettings:
  ```bash
  dotnet user-secrets --project src/Web set "ConnectionStrings:<PLACEHOLDER>Db" "Server=...;Trusted_Connection=True;TrustServerCertificate=True;"
  ```

### Creating a migration (when you change the model)
```bash
dotnet ef migrations add <Name> \
  --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```
You don't need to run `database update` — the API applies pending migrations on startup.

---

## 3. Run the web app

```bash
npm run dev -w web        # or: cd web && npm run dev  → http://localhost:3000
```

Create `web/.env.local`:

```
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

This is **baked at build time** (read once in `lib/env.ts`); changing it needs a restart of
`next dev` (or a rebuild for `next build`). Other web commands:

```bash
npm run build -w web      # production build — must pass before deploy
npm run lint  -w web
```

---

## 4. Run the mobile app

```bash
cd mobile
npm run start             # Metro dev server (Expo Go / dev client)
npm run android           # build & run on a device/emulator
npm run typecheck
```

Config:
- Default API base is `app.json` `extra.apiBase`. Override locally with
  `EXPO_PUBLIC_API_BASE` (e.g. point at your machine's LAN IP so a physical device can reach
  the API: `EXPO_PUBLIC_API_BASE=http://192.168.x.x:5000`).
- `mobile/.env` keeps `EXPO_NO_METRO_WORKSPACE_ROOT=1` — **leave it** (monorepo bundling).

For release APK builds (NDK/JDK, the monorepo trio, EAS profiles), see `mobile-expo.md`.

---

## 5. Run tests

```bash
# .NET
dotnet test                                                  # all
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj   # one project
dotnet test --filter "FullyQualifiedName~<SomeTests>"        # one class/test

# shared TS package (Vitest)
npm test -w packages/<PLACEHOLDER>-assessment-core
```

---

## 6. Quick checklist

1. `npm install` (repo root).
2. `docker compose -f deploy/docker-compose.dev.yml up -d` (SQL Server + MinIO).
3. `dotnet run --project src/Web` → API at `:5000`, docs at `/scalar` (auto-migrates +
   seeds admin).
4. `web/.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:5000`; `npm run dev -w web` →
   `:3000`.
5. `cd mobile && npm run start` (set `EXPO_PUBLIC_API_BASE` to reach the API from a device).
6. Sign in as the seeded admin, or register a user / use OTP (read the code from API logs).
