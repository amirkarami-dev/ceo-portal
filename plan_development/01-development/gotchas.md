# Gotchas

Real pitfalls hit while building/migrating `<PLACEHOLDER>`, each with the fix. Skim this
before you spend an hour debugging something already solved here.

---

## Backend / .NET

### 1. Strict build: warnings are errors
`Directory.Build.props` sets `TreatWarningsAsErrors=true`, so the smallest warning fails
`dotnet build`. .NET 10 also turns some deprecations into errors.
- **Fix the warning** — don't disable the flag.
- Deprecated APIs are hard errors: e.g. use **`KnownIPNetworks`**, not `KnownNetworks`, on
  `ForwardedHeadersOptions`.
- Genuine NuGet-audit advisories on transitive template/SDK packages are demoted to
  warnings via `WarningsNotAsErrors=NU1608;NU1902;NU1903`. Only add codes here for real
  transitive advisories you can't yet fix; remove them when upstream ships a fix.

### 2. `ValidationException` is ambiguous
Two types are in scope: `FluentValidation.ValidationException` (a global using) and the
app's `Application.Common.Exceptions.ValidationException` (the one with the `Errors`
dictionary that becomes a 400 with field errors). They collide.
- **Fix**: alias the app one when you need it:
  ```csharp
  using ValidationException = <PLACEHOLDER>.Application.Common.Exceptions.ValidationException;
  ```
  Already done in `ValidationBehaviour` and `GenerateReport`. Use the app exception to
  surface field errors (e.g. `ex.Errors["Subscription"] = ...`).

### 3. JSON columns: `nvarchar(max)`, not `jsonb`
This stack is **Microsoft SQL Server**, not PostgreSQL. `jsonb` does not exist. Persisted
JSON (e.g. assessment input/result) is stored as `nvarchar(max)`:
```csharp
builder.Property(a => a.InputJson).HasColumnType("nvarchar(max)").IsRequired();
```
If you port code or a migration that uses `jsonb`, change it to `nvarchar(max)`.

### 4. Local SQL Server on 1433 shadows the dev container (IPv4 vs IPv6)
If you have a local SQL Server instance already listening on **1433**, the dev container's
SQL Server (also 1433) conflicts, and `localhost` may resolve to **IPv6 `::1`** while the
container binds **IPv4**, so connections silently hit the wrong server or fail.
- **Fix**: pin the connection string host to **IPv4 `127.0.0.1`** (the dev string already
  does: `Server=127.0.0.1,1433;...`). If you run your *own* local SQL Server instead of the
  container, prefer Windows-auth and keep credentials out of source by putting the
  connection string in **`dotnet user-secrets`** for the `Web` project rather than editing
  `appsettings`.

### 5. Aspire `Projects` namespace clash in functional tests
The `<PLACEHOLDER>.Application.Projects` namespace shadows Aspire's generated global
`Projects` namespace, so `Projects.TestAppHost` won't resolve in functional tests.
- **Fix**: fully qualify the Aspire one:
  ```csharp
  global::Projects.TestAppHost
  ```

### 6. `dotnet-ef` must match EF Core 10
A mismatched global `dotnet-ef` throws version errors on `migrations add`.
- **Fix**: `dotnet tool update -g dotnet-ef --version "10.0.*"`. Migrations are applied
  automatically on API startup (`ApplicationDbContextInitialiser.MigrateAsync`), so you
  rarely run `database update` by hand locally.

### 7. MediatR 13+ needs a commercial license — we pin to free 12.5.0
MediatR 13.0+ (LuckyPennySoftware) **requires a commercial license in production**. This repo
pins **MediatR 12.5.0** (Apache-2.0, the last free version) in `Directory.Packages.props`, so
no license is needed (ADR-002). AutoMapper uses the same vendor model, but its license is
**accepted as a non-blocker** here (ADR-018) — it stays on 16.x.
- **Fix**: keep MediatR pinned to 12.5.0. To upgrade, buy a v14+ license or migrate to
  `Mediator` (martinothamar, MIT, source-generated).

### 8. `Guard.Against.NotFound` for 404, `ForbiddenAccessException` for 403
Don't hand-roll error responses in handlers. Use `Guard.Against.NotFound(id, entity)`
(Ardalis) for 404 and `throw new ForbiddenAccessException()` for 403 — both are mapped to
the right HTTP status by `ProblemDetailsExceptionHandler`.

---

## Mobile / Expo (the monorepo APK trio + friends)

Building a release APK from the hoisted npm-workspaces monorepo has a set of traps. **All
are already configured — do not undo them.** (Full detail in `mobile-expo.md`.)

### 9. Keep New Architecture enabled
`app.json` `"newArchEnabled": true`. RN 0.81 / Expo SDK 54 native libs require it; disabling
breaks the native build.

### 10. React dedup via Metro `resolveRequest`
Two copies of React (the app's + a hoisted/newer one) crash with `Cannot read property
'useEffect' of null` ("Invalid hook call"). `metro.config.js` forces every `react` /
`react-native` import to resolve from `mobile/node_modules` by redirecting the resolution
origin (`originModulePath`) to the app dir.

### 11. `EXPO_NO_METRO_WORKSPACE_ROOT=1`
Set in `mobile/.env` **and** every `eas.json` profile. Without it, Metro/`export:embed`
treats the workspace root as the project root and the release JS bundle can't resolve the
entry.

### 12. Local `index.js` entry
`package.json` `"main": "index.js"`, where `index.js` just does `import "expo-router/entry"`.
Pointing `main` straight at `expo-router/entry` makes the gradle release bundle resolve the
entry from the workspace root and fail.

### 13. Toolchain & signing
Local APK builds need **NDK `27.1.12297006`** + **JDK 17**. The release APK is
**debug-signed** (no keystore) and installs on arm64-v8a devices — add a real keystore
before store distribution.

### 14. RTL needs a reload on first install
`I18nManager.forceRTL(true)` fully applies after a reload; a fresh install's *first* launch
may render LTR until the JS reloads. Reload in dev; trigger a native restart in prod.

---

## Frontend / web

### 15. Use locale-aware navigation
Import `Link` / `useRouter` / `redirect` from `@/i18n/navigation`, **not** `next/link` /
`next/navigation`, or the `/en` locale prefix is dropped.

### 16. Don't break the `components/ui` barrel
Every page imports primitives from `@/components/ui`. **Restyle, don't rename** — renaming or
changing a primitive's public props breaks every page at once.

### 17. Keep the dark-mode compatibility layer
`globals.css` remaps legacy hardcoded `slate-*` / `white` / `brand-*` utilities to theme
tokens **only under `.dark`**. Deleting it makes ported components render dark-on-dark or
blue brand text. Prefer token utilities (`text-foreground`, `bg-card`, `text-primary`) in
new code.

### 18. `NEXT_PUBLIC_API_BASE` is baked at build time
It's inlined by Next at build time (read once in `lib/env.ts`). Changing it requires a
rebuild, not just a restart. `next.config.ts` must keep `output: "standalone"` for the
Docker image and `transpilePackages: ["@<PLACEHOLDER>/assessment-core"]` for the shared
engine.

### 19. Do NOT wrap next-intl in Auth.js's `auth()` middleware
The server-side auth boundary (ADR-017) gates protected routes in `middleware.ts`. **Do not**
compose it as `export default auth((req) => intlMiddleware(req))`: behind Traefik
(`AUTH_TRUST_HOST` + `AUTH_URL`) the `auth()` wrapper rebases next-intl's `/`→`/fa` rewrite to an
**absolute** URL, which the standalone server then tries to **proxy** → `EAI_AGAIN`, breaking the
default-locale site. (This shipped to prod once and broke `/`; it was caught and rolled back.)
- **Fix**: let `next-intl` own the response. Gate protected routes with a cheap **session-cookie
  presence** check (a `req.cookies` entry whose name includes `session-token`) + a locale-aware
  redirect; do role/identity decryption **server-side** (RSC `auth()` in `(dashboard)/layout.tsx`
  and `(dashboard)/admin/layout.tsx`), never in the Edge middleware.

---

## Shared / monorepo

### 20. The shared package ships as TS source (no build)
`@<PLACEHOLDER>/assessment-core`'s `main`/`types` point at `src/index.ts`. Consumers compile
it: web via `transpilePackages`, mobile via Metro `watchFolders` + `nodeModulesPaths`.
There's no build artifact to import and no rebuild step after editing it.
