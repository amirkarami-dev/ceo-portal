# Mobile: Expo / React Native

The `<PLACEHOLDER>` mobile client is **Expo SDK 54 + React Native 0.81 + expo-router**,
living in `mobile/` inside the npm-workspaces monorepo. It is Persian-first (forced RTL),
talks to the same .NET API as the web app, and reuses the shared
`@<PLACEHOLDER>/assessment-core` engine.

```bash
npm install          # from the repo ROOT (npm workspaces)
cd mobile
npm run start        # Metro dev server (Expo Go / dev client)
npm run android      # device/emulator
npm run typecheck
```

Default API base: `app.json` `extra.apiBase` (prod URL), overridable with
`EXPO_PUBLIC_API_BASE` (set per build profile in `eas.json`).

---

## 1. Project layout

```
mobile/
  index.js              ← entry: re-exports "expo-router/entry" (see §4)
  metro.config.js       ← monorepo + React-dedup config (see §4)
  .env                  ← EXPO_NO_METRO_WORKSPACE_ROOT=1
  app.json              ← Expo config (newArchEnabled, plugins, extra.apiBase)
  eas.json              ← cloud build profiles
  babel.config.js       ← babel-preset-expo
  app/                  ← expo-router file routes
    _layout.tsx         ← root Stack + AuthProvider + RTL force
    index.tsx  login.tsx
    (app)/              ← authed area (projects, checklist, ...)
  src/
    lib/                ← api.ts, tokens.ts, auth-context.tsx, endpoints.ts, types.ts
    i18n.ts  theme.ts   ← tiny fa/en dictionary + emerald tokens (mirrors web)
    components/ui.tsx   ← RN UI primitives
    features/assessment/editors/   ← the 6 checklist editors (ported)
```

Routing is **expo-router** (file-based). `app.json` enables typed routes
(`experiments.typedRoutes`). The root `_layout.tsx` defines a `Stack` and mounts
`<AuthProvider>`.

---

## 2. Tokens with expo-secure-store

Unlike web (`localStorage`), mobile persists bearer tokens in the OS keychain via
**expo-secure-store**, with an in-memory cache so the API client can read the access token
synchronously between requests (`src/lib/tokens.ts`):

```ts
import * as SecureStore from "expo-secure-store"

let cache = { access: null, refresh: null }

export const tokenStore = {
  async load() {  // call once at startup
    cache = { access: await SecureStore.getItemAsync(ACCESS_KEY),
              refresh: await SecureStore.getItemAsync(REFRESH_KEY) }
    return cache
  },
  getAccess: () => cache.access,                 // sync read for apiFetch
  getRefresh: () => cache.refresh,
  async set(t) { cache = { access: t.accessToken, refresh: t.refreshToken }
                 await SecureStore.setItemAsync(ACCESS_KEY, t.accessToken)
                 await SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken) },
  async clear() { cache = { access: null, refresh: null }
                  await SecureStore.deleteItemAsync(ACCESS_KEY); /* + refresh */ },
}
```

`AuthProvider` loads tokens from `expo-secure-store` once on mount; `expo-secure-store` is
registered as a plugin in `app.json`.

Sign-in is **OIDC via expo-auth-session** (Authorization Code + PKCE) against the central IdP
(`auth.myceo.ir`) — see `sso-oidc.md`. `src/lib/api.ts` `apiFetch` sends `Authorization: Bearer
<jwt>` to the API (typed `ApiError`); the access token is renewed against the **IdP's token
endpoint** (refresh_token), **not** `/api/Users/refresh`. The OIDC sign-in lives in
`src/lib/oidc.ts` + `src/lib/auth-context.tsx`.

---

## 3. Forced RTL

Persian is the primary language, so RTL is forced at startup in the root `_layout.tsx`
using `I18nManager` (run both at module load and in an effect):

```tsx
import { I18nManager } from "react-native"
import { isRTL } from "@/i18n"

if (isRTL && !I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}
```

`expo-localization` is included as a plugin. Strings come from the tiny `src/i18n.ts`
dictionary (`t(key)`), and `src/theme.ts` holds the emerald color tokens mirroring the web
app. See `i18n-rtl.md` for details and the "first launch may need a reload to apply RTL"
caveat.

---

## 4. Reusing the shared package

`mobile/package.json` depends on the workspace package:

```json
"dependencies": { "@<PLACEHOLDER>/assessment-core": "*", ... }
```

It ships as **TypeScript source** (no build step). Metro compiles it because the
`metro.config.js` watches the workspace root and resolves from both `node_modules` trees
(see below). Import the engine directly:

```ts
import { scoreTool, calcBuildingGroup, TOTAL_MAX_SCORE } from "@<PLACEHOLDER>/assessment-core"
```

This is the same engine the web app uses — one source of truth for scoring. See
`shared-package.md`.

---

## 5. APK build fixes (the hard-won monorepo trio + more)

Building a release APK from a hoisted npm-workspaces monorepo has several traps. **All of
these are already configured — do not undo them.**

### a. Keep New Architecture enabled
`app.json` has `"newArchEnabled": true`. RN 0.81 / Expo SDK 54 native libraries require the
New Architecture; turning it off breaks the native build. Leave it on.

### b. React dedup via Metro `resolveRequest`
React is hoisted to the repo root, and the web app may pull a *newer* React. Two copies of
React in one bundle crash with `Cannot read property 'useEffect' of null` (a null hook
dispatcher / "Invalid hook call"). `metro.config.js` forces **one** copy — the app's — for
every `react` / `react-native` import:

```js
const forcedRoots = ["react", "react-native"]
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.split("/")[0]
  const ctx = forcedRoots.includes(pkg)
    ? { ...context, originModulePath: path.join(projectRoot, "index.js") }  // resolve from mobile/
    : context
  return (defaultResolveRequest ?? ctx.resolveRequest)(ctx, moduleName, platform)
}
```

It also watches the workspace root and adds both `node_modules` paths
(`watchFolders` + `nodeModulesPaths`) so the hoisted shared package resolves.

### c. `EXPO_NO_METRO_WORKSPACE_ROOT=1`
Set in `mobile/.env` **and** in every `eas.json` build profile. Without it, Metro/`export:embed`
treats the *workspace root* as the project root and the release JS bundle fails to resolve
the entry. This flag pins the project root to `mobile/` (with `nodeModulesPaths` covering the
hoisted deps).

### d. Local `index.js` entry
`package.json` `"main": "index.js"`, and `index.js` is just:

```js
import "expo-router/entry";
```

Pointing `main` straight at `expo-router/entry` makes the gradle release bundle resolve the
entry relative to the workspace root and fail. The local file keeps resolution correct.

### e. Toolchain: NDK + JDK
Local APK builds need **NDK `27.1.12297006`** and a **JDK 17** toolchain (plus Android SDK).

### f. Release is debug-signed
The release APK is **debug-signed** (no keystore required) and installs on any arm64-v8a
device — fine for internal distribution. Add a real keystore before shipping to a store.

### Build commands
Local:
```bash
cd mobile
npx expo prebuild --platform android        # android/ is gitignored; generate it
cd android
ANDROID_HOME=<your-sdk> ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
# → app/build/outputs/apk/release/app-release.apk
```

Cloud (EAS) — `preview` profile produces a downloadable APK, `production` an app-bundle:
```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```
Both EAS profiles set `EXPO_PUBLIC_API_BASE` and `EXPO_NO_METRO_WORKSPACE_ROOT=1`.

See `gotchas.md` for the condensed version of this trio.
