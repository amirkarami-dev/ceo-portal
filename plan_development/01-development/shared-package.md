# Shared Package (framework-agnostic domain logic)

`<PLACEHOLDER>` extracts its core domain logic — the interactive scoring/assessment engine
— into a **pure-TypeScript workspace package** that both the web (Next.js) and mobile
(Expo) clients consume. In the reference project this is `@<PLACEHOLDER>/assessment-core`
(the Section 19 building-energy engine), at `packages/assessment-core/`.

---

## 1. Why a shared package

The architectural decision: the interactive **scoring engine runs in the frontend** (it is a
verbatim port of a legacy app), and the backend is only the system of record (it stores the
inputs/results as JSON and renders a PDF). That logic is needed identically on **two**
clients — web and mobile. Putting it in one framework-agnostic package gives you:

- **Single source of truth** — fix a scoring rule once; both apps get it. No drift between
  a web copy and a mobile copy.
- **No framework coupling** — the package has **no React, no Next, no React Native**. It is
  plain functions and data tables, so it can be imported anywhere and unit-tested in
  isolation.
- **Cheap testing** — pure functions are trivially covered by Vitest, independent of any
  UI.

What belongs here: pure domain logic and reference data (calculations, scoring, lookup
tables, shared result/type definitions). What does **not**: anything importing React,
network code, storage, or platform APIs — those stay in each client's `lib/` and UI layers.

---

## 2. Package shape (pure TS, shipped as source)

`packages/assessment-core/package.json`:

```json
{
  "name": "@<PLACEHOLDER>/assessment-core",
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

Key choices:
- **Ships as TypeScript source** (`main`/`types` point at `src/index.ts`) — **no build
  step**. The consumers transpile it (web via `transpilePackages`, mobile via Metro). This
  keeps the dev loop instant.
- `"type": "module"`, `"private": true`, no runtime deps.
- `tsconfig.json` is `strict`, `moduleResolution: "Bundler"`, `noEmit: true`,
  `isolatedModules: true`, `allowImportingTsExtensions: true`.

Internal structure separates **data** from **logic** and exposes one barrel:

```
packages/assessment-core/src/
  index.ts            ← re-exports everything (single public entry)
  data/               ← climate, reference DBs, section/tool catalog, shared types
  scoring/            ← one pure function per checklist + a dispatcher
    index.ts          ← scoreTool(toolKey, input, ...) routes to the right scorer
  ...
test/scoring.test.ts  ← Vitest
```

`src/index.ts` is just `export * from "./data/..."` and `export * from "./scoring"`, so
consumers import from the package root:

```ts
import { scoreTool, calcBuildingGroup, TOTAL_MAX_SCORE } from "@<PLACEHOLDER>/assessment-core"
```

The `scoring/index.ts` dispatcher is the typical "stable public API over many internal
units" pattern:

```ts
export function scoreTool(toolKey: ToolKey, input: any, climateCode: string): ToolScore {
  switch (toolKey) {
    case "env_opaque.html": return scoreEnvOpaque(input ?? {}, climateCode)
    case "mech_checklist.html": return scoreMech(input ?? {})
    // ...
    default: return { score: 0, maxScore: 0 }
  }
}
```

---

## 3. Wiring it into the monorepo

Root `package.json` declares workspaces so the package is symlinked into both apps:

```json
{ "private": true, "workspaces": ["packages/*", "web", "mobile"] }
```

Each consumer depends on it with the workspace wildcard:

```json
// web/package.json AND mobile/package.json
"dependencies": { "@<PLACEHOLDER>/assessment-core": "*" }
```

### Web (Next.js): `transpilePackages`
Because the package ships TS source, Next must compile it. `web/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@<PLACEHOLDER>/assessment-core"],   // compile the workspace engine
  outputFileTracingRoot: path.join(__dirname, ".."),       // trace from repo root
}
```

`outputFileTracingRoot` points at the repo root so the standalone build is deterministic in
the monorepo.

### Mobile (Expo): Metro
Metro must resolve a package that lives outside `mobile/`. `mobile/metro.config.js` watches
the workspace root and resolves modules from both `node_modules` trees:

```js
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
```

(The same file also force-dedups React — see `mobile-expo.md`.) No build output is
imported; Metro transpiles the `.ts` sources directly.

---

## 4. Tests (Vitest)

The package is tested in isolation with **Vitest** — fast, no UI, no platform.

```bash
npm test -w packages/<PLACEHOLDER>-assessment-core   # or: cd packages/... && npx vitest run
```

`test/scoring.test.ts` imports straight from `../src/index` and asserts concrete numeric
outcomes (the engine is numerically sensitive, so the tests pin exact scores):

```ts
import { scoreTool, calcBuildingGroup, TOTAL_MAX_SCORE } from "../src/index"

it("scoreTool routes by toolKey", () => {
  expect(scoreTool("integrated_mgmt.html", { logicActive: false }, "3B").score).toBe(77)
})
it("total max score is 831", () => {
  expect(TOTAL_MAX_SCORE).toBe(831)
})
```

Guidance: any change to a scoring rule must be reflected in these tests (and matched on the
backend's side-of-record if it parses results). Treat the numbers as a contract.

---

## 5. Recipe: add a function to the shared package

1. Add the logic in `src/` (in `data/` for tables/types, `scoring/` or a new folder for
   logic). Keep it framework-free.
2. `export` it from the relevant module and ensure it is re-exported by `src/index.ts`.
3. Add a Vitest case in `test/` asserting exact expected output.
4. Run `npm run typecheck` and `npm test` in the package.
5. Import it in web/mobile from `@<PLACEHOLDER>/assessment-core`. No rebuild of the package
   is needed — both consumers transpile the source.
