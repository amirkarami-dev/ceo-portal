---
name: setup-monorepo-shared-package
description: Use when setting up an npm-workspaces monorepo where a pure-TypeScript package is shared by a Next.js web app and an Expo (React Native) mobile app — covering workspace config, the package's source-only exports, Next `transpilePackages`, Metro `watchFolders`/`nodeModulesPaths`, the React-dedup `resolveRequest`, `EXPO_NO_METRO_WORKSPACE_ROOT=1`, and the re-export shim / single-source-of-truth pattern.
---

# Set Up a Monorepo with a Shared TypeScript Package

Goal: one workspace package (`<scope>/<pkg>`, e.g. `@mabhas19/assessment-core`) holding **pure TS with no
React**, consumed by both `web/` (Next.js) and `mobile/` (Expo). The package ships **TypeScript source**
(no build step) — web transpiles it, Metro bundles it. The tricky parts are getting both bundlers to (a)
resolve the workspace package and (b) use a **single** copy of React. Replace `<scope>`, `<pkg>`, `<RootName>`.

## Workflow

### 1. Root `package.json` — declare the workspaces

```json
{
  "name": "<RootName>-monorepo",
  "private": true,
  "engines": { "node": ">=20.9.0" },
  "workspaces": ["packages/*", "web", "mobile"]
}
```

Run `npm install` from the repo root once — it hoists shared deps to the root `node_modules` and symlinks
each workspace.

### 2. The shared package — source-only exports

`packages/<pkg>/package.json` points `main`/`module`/`types`/`exports` straight at the **TS entry**
(`./src/index.ts`). No compiled output, no React dependency.

```json
{
  "name": "<scope>/<pkg>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "devDependencies": { "typescript": "^5", "vitest": "^2" }
}
```

**Re-export shim / single source of truth.** `src/index.ts` is a barrel that re-exports every public
module, so consumers import from the package root only and never reach into `src/...`:

```ts
// packages/<pkg>/src/index.ts — the single source of truth for the shared logic.
// Pure TypeScript, no React; consumed by both web (Next.js) and mobile (Expo).
export * from "./data/climate"
export * from "./data/utils"
export * from "./scoring"        // the pure engine + its dispatcher
// ...one re-export line per public module
```

Consumers then write `import { scoreSection } from "<scope>/<pkg>"`. If a client previously had its own
copy of this logic, replace those files with a thin re-export so there is exactly one implementation:

```ts
// web/src/features/<feature>/scoring.ts  (shim — keep the old import path working)
export * from "<scope>/<pkg>"
```

### 3. Web (Next.js) — `transpilePackages` + tracing root

The package is raw TS, so Next must transpile it. In a monorepo, also set `outputFileTracingRoot` so the
standalone build is deterministic. `web/next.config.ts`:

```ts
import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["<scope>/<pkg>"],                 // compile the workspace-local TS package
  outputFileTracingRoot: path.join(__dirname, ".."),    // trace from the repo root (server.js lands at web/server.js)
}
export default nextConfig
```

Add the package as a workspace dependency of web: `"<scope>/<pkg>": "*"` in `web/package.json`. No further
config — Next resolves it through the hoisted `node_modules` symlink.

### 4. Mobile (Expo / Metro) — watch the monorepo and dedup React

This is the fragile part. A hoisted monorepo can yield **two copies of React** (the app's and one a
hoisted package resolves from the root), producing the classic *"Invalid hook call" / "Cannot read property
'useEffect' of null"*. `mobile/metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "..")

const config = getDefaultConfig(projectRoot)

// 1. Watch the whole monorepo (keep Metro's defaults too).
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]))

// 2. Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

// 3. Pin react / react-native to the app's copy (fallback resolution).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
}

// 4. Force a SINGLE copy of react / react-native for EVERY import in the bundle.
//    extraNodeModules alone does NOT dedupe when a hoisted package resolves its own
//    react from the workspace root. Redirecting the resolution ORIGIN to the app dir
//    guarantees mobile/node_modules/react wins.
const forcedRoots = ["react", "react-native"]
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.split("/")[0]
  const ctx = forcedRoots.includes(pkg)
    ? { ...context, originModulePath: path.join(projectRoot, "index.js") }
    : context
  return (defaultResolveRequest ?? ctx.resolveRequest)(ctx, moduleName, platform)
}

module.exports = config
```

### 5. Keep mobile's project root = `mobile/` (`EXPO_NO_METRO_WORKSPACE_ROOT=1`)

By default Expo may treat the **workspace root** as the Metro project root in a monorepo, which breaks
release-bundle entry resolution (and `export:embed`). Pin the project root to `mobile/`. Set the flag in
`mobile/.env` (loaded by the Expo CLI):

```bash
# mobile/.env
EXPO_NO_METRO_WORKSPACE_ROOT=1
```

…and in every EAS profile's `env` (`mobile/eas.json`) so cloud builds match local:

```jsonc
"preview":     { "env": { "EXPO_NO_METRO_WORKSPACE_ROOT": "1" } },
"production":  { "env": { "EXPO_NO_METRO_WORKSPACE_ROOT": "1" } }
```

Also use a **local `index.js` entry** rather than pointing `package.json` `"main"` at `expo-router/entry`,
so Metro resolves the entry relative to `mobile/` (not the workspace root):

```js
// mobile/index.js
import "expo-router/entry";
```

with `"main": "index.js"` in `mobile/package.json`.

> The `web` Docker build drops the `mobile` workspace before installing, because Expo's
> react/react-native peer set conflicts during web resolution. If you containerize web, strip `"mobile"`
> from `workspaces` in the build stage (see `deploy-behind-traefik`).

## Verification

```bash
npm install                                  # from repo root — hoists + symlinks workspaces
npm run -w <scope>/<pkg> typecheck           # the shared package compiles
npm run -w <scope>/<pkg> test                # its unit tests (single source of truth) pass
npm run build -w web                         # Next transpiles the package; standalone build succeeds
cd mobile && npx expo start                  # Metro bundles; app loads with NO "Invalid hook call"
```

- Confirm web and mobile both import from `<scope>/<pkg>` (root), not from its `src/` internals.
- In mobile, verify a single React: a duplicate would crash on first hook; a clean dev-client/APK launch
  confirms the dedup `resolveRequest` is working.
