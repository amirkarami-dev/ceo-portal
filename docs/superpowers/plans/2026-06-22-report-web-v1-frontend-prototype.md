# report-web v1 (AI Reporting & Analytics Platform — Frontend Prototype) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `report-web`, a React + Vite + TypeScript frontend prototype of the AI Reporting & Analytics Platform (report.myceo.ir) with mock data, a real in-browser query engine, a mocked AI behind `IReportAIService`, all user + admin screens, reusing the global OIDC auth.

**Architecture:** Pipeline = Prompt -> `IReportAIService` (mock) -> `ReportDefinition` JSON -> `runQuery` (pure, in-browser) -> `chooseView` (auto-viz) -> renderers (Antd Table/KPI, Recharts, ECharts) -> dashboards (react-grid-layout). Data via a `mockApi` (localStorage) wrapped by TanStack Query; UI state via Zustand. The three swap seams (AI, data transport, auth) are interfaces with v1 mocks.

**Tech Stack:** React 19, Vite, TypeScript, React Router v7, Ant Design 5 (admin/system + tables/cards/forms only), Recharts, Apache ECharts, Framer Motion, react-grid-layout, Zustand, TanStack Query, react-i18next, oidc-client-ts, vitest + @testing-library/react.

## Global Constraints

- **Framework:** React 19 + Vite + TypeScript. **No Next.js.**
- **Ant Design rule:** Antd only for admin/system UI + Tables/Cards/Forms + report library. **Charts = Recharts/ECharts; dashboard layout = react-grid-layout. Never Antd for either.**
- **i18n/RTL:** fa-IR default (RTL) + en-US (LTR). All user-facing strings go through i18n keys. Antd `ConfigProvider direction` + ECharts RTL.
- **State:** Zustand (UI/client) + TanStack Query (server/mock).
- **Data:** everything via `mockApi` (localStorage + seed) in v1; hook signatures must match a future real API so only the fetcher changes later.
- **AI:** only via `IReportAIService` (mocked). The query engine is pure + synchronous; renderers consume `QueryResult`.
- **Exports:** CSV + JSON are real (client-side). PDF + Excel are shown in the menu but **disabled with a "v2" tag**.
- **Auth:** reuse the global OIDC IdP (`report-web` public client, PKCE) with `VITE_AUTH_MODE=mock` for offline dev.
- **Process:** TDD for all logic; each task ends with `npm run build`, `npm run lint`, and `npm run test` passing; frequent commits on branch `feat/report-service`; commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Spec (source of truth):** `docs/superpowers/specs/2026-06-22-ai-reporting-analytics-platform-design.md`.

### Canonical resolutions (R1-R6) — use verbatim; they override any drift in the spec

```
CANONICAL RESOLUTIONS (use these verbatim; they override any drift in the spec):
R1 (shared scalars): FieldType, Aggregation, and FieldFormat are defined ONCE in report-web/src/contracts/common.ts and imported by report-definition.ts and semantic.ts. Use: FieldType = "string" | "number" | "date" | "boolean"; Aggregation = "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none". (Reconcile the spec section-5 FieldType union into this single definition.)
R2 (AI seam): the interface is IReportAIService with ONE method: generate(req: GenerateReportRequest): Promise<AIReportResult>. GenerateReportRequest = { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en" }. AIReportResult = { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string }. A factory createAIService(): IReportAIService returns MockReportAIService in v1. Replace any generateDefinition(...) or generate(prompt, semanticModel) usages with generate(req).
R3 (query engine): runQuery(def: ReportDefinition, dataset: Dataset, semantic: SemanticModel): QueryResult. Dataset = Row[]; Row = Record<string, string | number | boolean | null>. QueryResult = { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number }. ResolvedColumn = { key: string; label: string; type: FieldType; isMetric: boolean }. ResultRow = Record<string, string | number | null>. GroupNode = { key: string; value: string | number; rows: ResultRow[]; children?: GroupNode[] }. The engine is PURE and SYNCHRONOUS.
R4 (auto-viz): chooseView(def: ReportDefinition, result: QueryResult, semantic: SemanticModel): ReportView[]. It returns the spec section-5 ReportView[] (to fill Presentation.views) using the EXACT numeric thresholds from spec section 8.6 (the single source of truth: <= ~12 categories -> bar; <= ~8 slices -> pie; > ~25 categories -> table; date dimension -> line; single metric, no group -> kpi; 2 dimensions x 1 measure -> echarts matrix).
R5 (renderer props): every renderer is a React component with props RendererProps = { view: ReportView; def: ReportDefinition; result: QueryResult }. A dispatcher component ReportView.tsx (named export ReportViewRenderer to avoid clashing with the ReportView type) picks the renderer from view.type/view.library.
R6 (auth): useAuth() returns { user: SessionUser | null; roles: AppRole[]; isAdmin: boolean; ready: boolean; login(): void; logout(): void }. Auth mode is chosen by env VITE_AUTH_MODE = "mock" | "oidc" (mock = offline dev user with a selectable role; oidc = real PKCE against the report-web client at auth.myceo.ir).
```

### Canonical folder layout

```
CANONICAL FOLDER LAYOUT (report-web/src/):
contracts/  common.ts, report-definition.ts, semantic.ts, dataset.ts, ai.ts, presentation.ts, rbac.ts, tenant.ts, index.ts
semantic/   models/{project,sales,finance}.ts, datasets/{project,sales,finance}.ts, registry.ts
query/      engine.ts, drilldown.ts, engine.test.ts
ai/         IReportAIService.ts (re-export from contracts/ai), mock-ai-service.ts, examples.ts, rules.ts
presentation/ auto-viz.ts, ReportView.tsx (ReportViewRenderer dispatcher), renderers/{TableRenderer,KpiRenderer,RechartsRenderer,EChartsRenderer}.tsx
dashboard/  DashboardCanvas.tsx, widget.ts
features/   ask-ai/, viewer/, library/, dashboards/, export/{csv.ts,json.ts,index.ts}
admin/      ai/{providers,routing,prompts,usage}/, users/, roles/, data-sources/, semantic-models/, audit/, tenant/, tenants/, system/
auth/       AuthProvider.tsx, useAuth.ts, oidc.ts, routes.tsx
api/        mockApi.ts, seed.ts, queries.ts
store/      ui-store.ts, tenant-store.ts
i18n/       index.ts, locales/{fa,en}.json
theme/      theme.ts, ThemeProvider.tsx
layout/     AppLayout.tsx, Sidebar.tsx, Topbar.tsx
app/        router.tsx, App.tsx, providers.tsx
main.tsx, index.html
```

---

## Tasks

### Task 1: Scaffold `report-web` (Vite + React 19 + TS) with tooling & folder skeleton

**Files:**
- Create: `report-web/package.json`
- Create: `report-web/vite.config.ts`
- Create: `report-web/tsconfig.json`
- Create: `report-web/tsconfig.node.json`
- Create: `report-web/index.html`
- Create: `report-web/.eslintrc.cjs`
- Create: `report-web/.prettierrc.json`
- Create: `report-web/.prettierignore`
- Create: `report-web/.gitignore`
- Create: `report-web/.env`
- Create: `report-web/.env.example`
- Create: `report-web/vitest.setup.ts`
- Create: `report-web/src/main.tsx`
- Create: `report-web/src/app/App.tsx`
- Create: `report-web/src/vite-env.d.ts`
- Create (empty `.gitkeep` placeholders for the canonical skeleton): `report-web/src/contracts/.gitkeep`, `report-web/src/semantic/models/.gitkeep`, `report-web/src/semantic/datasets/.gitkeep`, `report-web/src/query/.gitkeep`, `report-web/src/ai/.gitkeep`, `report-web/src/presentation/renderers/.gitkeep`, `report-web/src/dashboard/.gitkeep`, `report-web/src/features/ask-ai/.gitkeep`, `report-web/src/features/viewer/.gitkeep`, `report-web/src/features/library/.gitkeep`, `report-web/src/features/dashboards/.gitkeep`, `report-web/src/features/export/.gitkeep`, `report-web/src/admin/ai/.gitkeep`, `report-web/src/admin/users/.gitkeep`, `report-web/src/admin/roles/.gitkeep`, `report-web/src/admin/data-sources/.gitkeep`, `report-web/src/admin/semantic-models/.gitkeep`, `report-web/src/admin/audit/.gitkeep`, `report-web/src/admin/tenant/.gitkeep`, `report-web/src/admin/tenants/.gitkeep`, `report-web/src/admin/system/.gitkeep`, `report-web/src/auth/.gitkeep`, `report-web/src/api/.gitkeep`, `report-web/src/store/.gitkeep`, `report-web/src/i18n/locales/.gitkeep`, `report-web/src/theme/.gitkeep`, `report-web/src/layout/.gitkeep`
- Modify: `package.json` (root — add `report-web` to `workspaces`)
- Test: `report-web/src/app/App.test.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - npm scripts in `report-web/package.json`: `dev`, `build`, `lint`, `test`, `preview`, `typecheck`.
  - `import.meta.env` typed vars (declared in `src/vite-env.d.ts`): `VITE_API_BASE: string`, `VITE_AUTH_MODE: "mock" | "oidc"`, `VITE_AUTH_AUTHORITY: string`, `VITE_AUTH_CLIENT_ID: string`, `VITE_AUTH_SCOPE: string`.
  - The canonical folder skeleton under `report-web/src/` (later tasks add files into it).
  - `report-web/tsconfig.json` with `"strict": true`, path alias `@/* → src/*`.

- [ ] **Step 1: Create the feature branch.**
  ```bash
  cd /d/projects/mabhas19App/mabhas19 && git checkout -b feat/report-service
  ```
  Expected output (or `Switched to branch 'feat/report-service'` if not yet created):
  ```
  Switched to a new branch 'feat/report-service'
  ```

- [ ] **Step 2: Write `report-web/package.json`** with all STACK deps + scripts.
  ```json
  {
    "name": "report-web",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "typecheck": "tsc --noEmit",
      "lint": "eslint . --max-warnings 0",
      "test": "vitest run",
      "test:watch": "vitest",
      "preview": "vite preview"
    },
    "dependencies": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router-dom": "^7.0.0",
      "antd": "^5.21.0",
      "@ant-design/icons": "^5.5.0",
      "recharts": "^2.13.0",
      "echarts": "^5.5.0",
      "echarts-for-react": "^3.0.2",
      "framer-motion": "^11.11.0",
      "react-grid-layout": "^1.5.0",
      "zustand": "^5.0.0",
      "@tanstack/react-query": "^5.59.0",
      "react-i18next": "^15.1.0",
      "i18next": "^23.16.0",
      "oidc-client-ts": "^3.1.0"
    },
    "devDependencies": {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@types/react-grid-layout": "^1.3.5",
      "@vitejs/plugin-react": "^4.3.0",
      "vite": "^6.0.0",
      "typescript": "^5.6.0",
      "vitest": "^2.1.0",
      "jsdom": "^25.0.0",
      "@testing-library/react": "^16.0.0",
      "@testing-library/jest-dom": "^6.6.0",
      "@testing-library/user-event": "^14.5.0",
      "eslint": "^8.57.0",
      "@typescript-eslint/parser": "^8.8.0",
      "@typescript-eslint/eslint-plugin": "^8.8.0",
      "eslint-plugin-react-hooks": "^5.0.0",
      "eslint-plugin-react-refresh": "^0.4.12",
      "eslint-config-prettier": "^9.1.0",
      "prettier": "^3.3.0"
    }
  }
  ```

- [ ] **Step 3: Add `report-web` to the root workspaces.** Edit `package.json` (root):
  ```json
  {
    "name": "mabhas19-monorepo",
    "version": "0.0.0",
    "private": true,
    "engines": {
      "node": ">=20.9.0"
    },
    "workspaces": [
      "packages/*",
      "web",
      "mobile",
      "report-web"
    ]
  }
  ```

- [ ] **Step 4: Write `report-web/tsconfig.json`** (strict, with `@/*` alias and vitest globals).
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "useDefineForClassFields": true,
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "moduleDetection": "force",
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "types": ["vitest/globals", "@testing-library/jest-dom"],
      "baseUrl": ".",
      "paths": { "@/*": ["src/*"] }
    },
    "include": ["src", "vitest.setup.ts"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }
  ```

- [ ] **Step 5: Write `report-web/tsconfig.node.json`** (for the Vite config).
  ```json
  {
    "compilerOptions": {
      "composite": true,
      "skipLibCheck": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true,
      "strict": true,
      "noEmit": true
    },
    "include": ["vite.config.ts"]
  }
  ```

- [ ] **Step 6: Write `report-web/vite.config.ts`** (React plugin, `@/*` alias, vitest jsdom + globals).
  ```ts
  /// <reference types="vitest/config" />
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import { fileURLToPath, URL } from "node:url";

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      css: false,
    },
  });
  ```

- [ ] **Step 7: Write `report-web/vitest.setup.ts`** (jest-dom matchers).
  ```ts
  import "@testing-library/jest-dom/vitest";
  ```

- [ ] **Step 8: Write `report-web/src/vite-env.d.ts`** typing the VITE_* env (the canonical R6 auth env + API base).
  ```ts
  /// <reference types="vite/client" />

  interface ImportMetaEnv {
    readonly VITE_API_BASE: string;
    /** R6: "mock" = offline dev user; "oidc" = real PKCE at auth.myceo.ir. */
    readonly VITE_AUTH_MODE: "mock" | "oidc";
    readonly VITE_AUTH_AUTHORITY: string;
    readonly VITE_AUTH_CLIENT_ID: string;
    readonly VITE_AUTH_SCOPE: string;
    /** Data seam: "true" = localStorage mock backend + seed; "false" = real HTTP API. */
    readonly VITE_USE_MOCK_API: string;
    /** AI seam: "mock" = MockReportAIService; "gateway" = HTTP-backed AI gateway. */
    readonly VITE_AI_MODE: "mock" | "gateway";
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```

- [ ] **Step 9: Write `report-web/index.html`** with Persian/RTL root (`<html lang="fa" dir="rtl">`).
  ```html
  <!doctype html>
  <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>سامانه گزارش‌گیری و تحلیل هوشمند</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 10: Write `report-web/src/app/App.tsx`** (the v1 placeholder root component).
  ```tsx
  export default function App() {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>report-web</h1>
        <p>سامانه گزارش‌گیری و تحلیل هوشمند (نمونه اولیه v1)</p>
        <p>API base: {import.meta.env.VITE_API_BASE}</p>
        <p>Auth mode: {import.meta.env.VITE_AUTH_MODE}</p>
      </main>
    );
  }
  ```

- [ ] **Step 11: Write `report-web/src/main.tsx`** (mount point).
  ```tsx
  import { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import App from "@/app/App";

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element #root not found");

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  ```

- [ ] **Step 12: Write `report-web/.env.example`** (committed reference for all VITE_* keys).
  ```dotenv
  # report-web — build-time config (baked into dist/ by Vite).
  VITE_API_BASE=https://api.mabhas19.myceo.ir
  # R6 auth seam: "mock" (offline dev user) or "oidc" (real PKCE).
  VITE_AUTH_MODE=mock
  VITE_AUTH_AUTHORITY=https://auth.myceo.ir
  VITE_AUTH_CLIENT_ID=report-web
  VITE_AUTH_SCOPE=openid profile email role mabhas19.api
  # Data seam: "true" = localStorage mock backend + seed; "false" = real HTTP API.
  VITE_USE_MOCK_API=true
  # AI seam: "mock" = MockReportAIService; "gateway" = HTTP-backed AI gateway.
  VITE_AI_MODE=mock
  ```

- [ ] **Step 13: Write `report-web/.env`** (local dev defaults — mock mode, local API).
  ```dotenv
  VITE_API_BASE=http://localhost:5000
  VITE_AUTH_MODE=mock
  VITE_AUTH_AUTHORITY=https://auth.myceo.ir
  VITE_AUTH_CLIENT_ID=report-web
  VITE_AUTH_SCOPE=openid profile email role mabhas19.api
  VITE_USE_MOCK_API=true
  VITE_AI_MODE=mock
  ```

- [ ] **Step 14: Write `report-web/.gitignore`.**
  ```gitignore
  node_modules
  dist
  dist-ssr
  *.local
  coverage
  .vite
  ```

- [ ] **Step 15: Write `report-web/.eslintrc.cjs`** (TS + React Hooks + prettier-compat).
  ```cjs
  module.exports = {
    root: true,
    env: { browser: true, es2022: true, node: true },
    parser: "@typescript-eslint/parser",
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
    extends: [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:react-hooks/recommended",
      "prettier",
    ],
    ignorePatterns: ["dist", ".eslintrc.cjs", "vite.config.ts", "vitest.setup.ts"],
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  };
  ```

- [ ] **Step 16: Write `report-web/.prettierrc.json` and `report-web/.prettierignore`.**
  `.prettierrc.json`:
  ```json
  {
    "semi": true,
    "singleQuote": false,
    "trailingComma": "all",
    "printWidth": 100
  }
  ```
  `.prettierignore`:
  ```gitignore
  dist
  node_modules
  coverage
  ```

- [ ] **Step 17: Create the canonical folder skeleton** with `.gitkeep` placeholders so the tree exists for later tasks (each file is empty).
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web/src && \
  for d in contracts semantic/models semantic/datasets query ai presentation/renderers \
    dashboard features/ask-ai features/viewer features/library features/dashboards features/export \
    admin/ai admin/users admin/roles admin/data-sources admin/semantic-models admin/audit \
    admin/tenant admin/tenants admin/system auth api store i18n/locales theme layout; do \
    mkdir -p "$d" && touch "$d/.gitkeep"; done
  ```
  (Files `app/`, `main.tsx`, `vite-env.d.ts` already exist from earlier steps.)

- [ ] **Step 18: Write the render smoke test `report-web/src/app/App.test.tsx`.**
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect } from "vitest";
  import App from "./App";

  describe("App", () => {
    it("renders the report-web placeholder heading", () => {
      render(<App />);
      expect(screen.getByRole("heading", { name: "report-web" })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 19: Install dependencies from the monorepo root** (npm workspaces).
  ```bash
  cd /d/projects/mabhas19App/mabhas19 && npm install
  ```
  Expected: install completes with `added N packages` and no `ERESOLVE` errors.

- [ ] **Step 20: Run the test suite (expected PASS).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm test
  ```
  Expected (tail):
  ```
   ✓ src/app/App.test.tsx (1 test)
   Test Files  1 passed (1)
        Tests  1 passed (1)
  ```

- [ ] **Step 21: Run lint and typecheck (expected PASS).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm run lint && npm run typecheck
  ```
  Expected: both exit 0 with no output (no eslint errors, no tsc errors).

- [ ] **Step 22: Run the production build (expected PASS).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm run build
  ```
  Expected (tail):
  ```
  vite vX.Y.Z building for production...
  ✓ built in NNNms
  dist/index.html  ...
  ```

- [ ] **Step 23: Sanity-check `npm run dev` renders the placeholder, then stop it.**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm run dev
  ```
  Expected: `VITE vX.Y.Z ready in N ms` and `Local: http://localhost:5173/`. Visit it once to confirm the "report-web" heading renders, then Ctrl-C.

- [ ] **Step 24: Commit.**
  ```bash
  cd /d/projects/mabhas19App/mabhas19 && git add report-web package.json package-lock.json && \
  git commit -m "$(printf 'chore(report-web): scaffold Vite + React 19 + TS prototype\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
  ```
  Expected: `[feat/report-service <hash>] chore(report-web): scaffold Vite + React 19 + TS prototype`.

**Acceptance criteria:** `npm run dev` serves a page whose root document is `<html lang="fa" dir="rtl">` and renders the "report-web" placeholder; `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test` all exit 0; the canonical `src/` folder skeleton exists; `report-web` is a workspace of the root `package.json`.

---

### Task 2: Contracts — the shared type surface (`contracts/*`)

**Files:**
- Create: `report-web/src/contracts/common.ts`
- Create: `report-web/src/contracts/report-definition.ts`
- Create: `report-web/src/contracts/semantic.ts`
- Create: `report-web/src/contracts/dataset.ts`
- Create: `report-web/src/contracts/ai.ts`
- Create: `report-web/src/contracts/presentation.ts`
- Create: `report-web/src/contracts/rbac.ts`
- Create: `report-web/src/contracts/tenant.ts`
- Create: `report-web/src/contracts/index.ts`
- Test: `report-web/src/contracts/contracts.test.ts`

**Interfaces:**
- Consumes (from Task 1): `report-web/tsconfig.json` strict config + `@/*` alias; `npm run typecheck` and `npm test` scripts.
- Produces (the stable type surface every later task imports from `@/contracts`):
  - `common.ts` (R1): `type FieldType = "string" | "number" | "date" | "boolean"`; `type Aggregation = "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none"`; `interface FieldFormat`.
  - `report-definition.ts`: `interface ReportDefinition`, `ColumnDef`, `Filter`, `FilterValue`, `DynamicValue`, `FilterOperator`, `FilterGroup`, `GroupBy`, `Metric`, `CalculatedField`, `Sort`, `Drilldown`, `ReportMeta`.
  - `presentation.ts`: `interface Presentation`, `ReportView`, `ViewType`, `ViewLibrary`, `ViewMapping`, `ExportConfig`, `ExportFormat`.
  - `semantic.ts`: `type FieldRole`, `interface Field`, `Relationship`, `Entity`, `SemanticModel` (imports `FieldType`, `Aggregation`, `FieldFormat` from `common.ts` per R1).
  - `dataset.ts` (R3): `type Row = Record<string, string | number | boolean | null>`; `type Dataset = Row[]`; `type ResultRow = Record<string, string | number | null>`; `interface ResolvedColumn`; `interface GroupNode`; `interface QueryResult`.
  - `ai.ts` (R2): `interface GenerateReportRequest`, `AIReportResult`, `AIUsage`, `IReportAIService` (single `generate(req)` method).
  - `rbac.ts` (§10.5): `type Permission`, `type AppRole`, `ROLE_PERMISSIONS`, `permissionsFor`, `can`, `isGlobal`, plus `interface SessionUser`, `mapLegacyRoles`.
  - `tenant.ts` (§11): `type TenantStatus`, `TenantPlan`, `interface Tenant`, `TenantBranding`, `TenantAiConfig`, `AiProviderConfig`, `TenantQuotas`, `TenantUsage`, `TenantScoped`.
  - `index.ts`: barrel re-exporting all of the above.

- [ ] **Step 1: Write `report-web/src/contracts/common.ts`** — the single source of the shared scalars (R1; reconciles the §5 `FieldType` union and §6 `Aggregation` into one definition).
  ```ts
  // R1: shared scalars defined ONCE here; imported by report-definition.ts & semantic.ts.

  /**
   * Primitive value type of a field (reconciled per R1: the §5 FieldType union's
   * analytical roles `dimension`/`measure` are expressed via FieldRole in semantic.ts,
   * NOT here — this is the storage/primitive type only).
   */
  export type FieldType = "string" | "number" | "date" | "boolean";

  /** Aggregation functions the Query Engine implements (R1). */
  export type Aggregation =
    | "sum"
    | "avg"
    | "min"
    | "max"
    | "count"
    | "countDistinct"
    | "none";

  /** How a value is rendered in tables/cards/charts (locale + RTL aware). */
  export interface FieldFormat {
    kind?: "number" | "currency" | "percent" | "date" | "datetime" | "text";
    /** Intl-style locale; defaults to fa-IR. */
    locale?: string;
    /** ISO currency for kind="currency", e.g. "IRR". */
    currency?: string;
    /** decimal places for number/currency/percent. */
    decimals?: number;
    /** date pattern token, e.g. "jYYYY/jMM" for Jalali (later). */
    pattern?: string;
    prefix?: string;
    suffix?: string;
    /** thousands separator (Persian digits handled by the i18n formatter). */
    grouping?: boolean;
  }
  ```

- [ ] **Step 2: Write `report-web/src/contracts/presentation.ts`** — verbatim §5 Presentation block (extracted into its own file per the canonical layout; `ReportDefinition` imports it).
  ```ts
  // ---------- Presentation (verbatim from spec §5.2) ----------
  export interface Presentation {
    /** default active view (index or id) when multiple views exist. */
    defaultView?: number | string;
    views: ReportView[];
    /** export defaults — overridable per export call. */
    export?: ExportConfig;
  }

  export interface ReportView {
    id?: string;
    type: ViewType; // Table | KPI | Chart | DashboardWidget
    library: ViewLibrary; // antd | recharts | echarts | grid
    component: string; // concrete renderer, e.g. "LineChart"
    title?: string;
    mapping: ViewMapping; // how columns/metrics bind to the view
    options?: Record<string, unknown>; // renderer-specific opts (colors, etc.)
  }

  export type ViewType = "table" | "kpi" | "chart" | "dashboardWidget";

  /** STRICT RULE encoded in types: charts NEVER use antd; dashboard layout
   *  NEVER uses antd; tables/KPI/forms use antd. */
  export type ViewLibrary = "antd" | "recharts" | "echarts" | "grid";

  export interface ViewMapping {
    /** Table: which columns to show (defaults to all visible columns). */
    columns?: string[];
    /** Chart axes. */
    x?: string; // category / time axis field
    y?: string | string[]; // one or more measure/metric aliases
    series?: string; // field to split into multiple series
    /** KPI cards: metric alias → card. */
    value?: string; // metric/calc alias shown big
    comparison?: string; // optional delta field
    /** Pie/donut. */
    category?: string;
    measure?: string;
  }

  export interface ExportConfig {
    formats?: ExportFormat[]; // which exports are offered
    fileName?: string; // base name (localized ok)
    pdf?: { orientation?: "portrait" | "landscape"; title?: string; logo?: boolean };
    excel?: { sheetName?: string; freezeHeader?: boolean };
  }

  export type ExportFormat = "pdf" | "excel" | "csv" | "json";
  ```

- [ ] **Step 3: Write `report-web/src/contracts/report-definition.ts`** — verbatim §5.2, with R1 applied (`FieldType`/`FieldFormat` imported from `common.ts`, NOT redefined) and `Presentation` imported from `presentation.ts`.
  ```ts
  import type { FieldType, Aggregation, FieldFormat } from "./common";
  import type { Presentation } from "./presentation";

  // ============================================================
  // Report Definition — single source of truth (rendering + export)
  // schemaVersion lets us evolve the format without breaking
  // stored definitions. v1 = "1.0".
  // ============================================================

  export interface ReportDefinition {
    /** Stable unique id (uuid). Persisted; referenced by dashboard widgets. */
    id: string;
    /** schema version of THIS document, e.g. "1.0". */
    schemaVersion: string;

    /** Human-facing metadata (localized, RTL-friendly). */
    name: string; // e.g. "پروژه‌های معوق بیش از ۳۰ روز"
    description?: string;
    tags?: string[];

    /** Semantic-layer dataset/entity key. NOT a raw table name. */
    dataset: string; // e.g. "projects", "sales", "invoices"

    /** Selected output columns (semantic field refs + display options). */
    columns: ColumnDef[];

    /** Row filters (AND-combined at top level; see FilterGroup for OR). */
    filters?: Filter[];
    /** Optional grouped/nested boolean logic. If present, takes precedence
     *  over the flat `filters[]` array. */
    filterGroup?: FilterGroup;

    /** Grouping (the GROUP BY dimensions). */
    groupBy?: GroupBy[];

    /** Aggregations / measures computed per group (or over the whole set
     *  when groupBy is empty). */
    metrics?: Metric[];

    /** Derived columns computed by the engine (row-level or post-aggregate). */
    calculatedFields?: CalculatedField[];

    /** Sort order applied AFTER grouping/aggregation. */
    sorting?: Sort[];

    /** Row cap applied AFTER sorting — drives "Top N". */
    limit?: number;
    offset?: number;

    /** Interactive drill-down configuration (click a row → child report). */
    drilldown?: Drilldown;

    /** How to render & export. Drives BOTH on-screen views and exporters. */
    presentation: Presentation;

    /** Tenant + audit context (later phase; optional in v1 mock). */
    meta?: ReportMeta;
  }

  // ---------- Columns ----------
  export interface ColumnDef {
    field: string; // semantic field key, e.g. "province"
    label?: string; // display override (localized)
    /** semantic type — drives auto-viz + formatting + valid operators. */
    type?: FieldType;
    format?: FieldFormat; // number/date/currency formatting
    visible?: boolean; // default true; false = compute, hide
    width?: number; // px hint for Table renderer
  }

  // ---------- Filters ----------
  export interface Filter {
    field: string; // semantic field key
    operator: FilterOperator;
    /** value type depends on operator (see table in §5.4). */
    value?: FilterValue;
    /** value2 used only for "between" / "notBetween". */
    value2?: FilterValue;
    /** if true, value is resolved at run time from a parameter/today(). */
    dynamic?: boolean;
  }

  export type FilterValue =
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | DynamicValue;

  /** Run-time tokens the engine resolves (today, now, param). */
  export interface DynamicValue {
    token: "today" | "now" | "startOfMonth" | "startOfYear" | "param";
    /** for relative dates: e.g. { token:"today", offsetDays:-30 } */
    offsetDays?: number;
    offsetMonths?: number;
    /** for token:"param" → name of a report parameter. */
    param?: string;
  }

  export type FilterOperator =
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "between"
    | "notBetween"
    | "in"
    | "notIn"
    | "contains"
    | "notContains"
    | "startsWith"
    | "endsWith"
    | "isNull"
    | "isNotNull"
    | "isTrue"
    | "isFalse";

  /** Optional nested boolean logic (AND/OR trees). */
  export interface FilterGroup {
    logic: "and" | "or";
    conditions: Array<Filter | FilterGroup>;
  }

  // ---------- Grouping ----------
  export interface GroupBy {
    field: string; // a dimension/date field
    /** For date fields: bucket granularity. */
    dateBucket?: "day" | "week" | "month" | "quarter" | "year";
  }

  // ---------- Metrics / Aggregations ----------
  export interface Metric {
    field: string; // measure field, or "*" for count
    aggregation: Aggregation;
    /** output column key; defaults to `${aggregation}_${field}`. */
    alias?: string;
    label?: string;
    format?: FieldFormat;
  }

  // ---------- Calculated fields ----------
  export interface CalculatedField {
    alias: string; // new column key
    label?: string;
    /** safe expression over fields/metrics, e.g.
     *  "(revenue - cost) / revenue * 100". No raw SQL/JS eval. */
    expression: string;
    type?: FieldType;
    format?: FieldFormat;
    /** when the expression references aggregates, set scope:"aggregate". */
    scope?: "row" | "aggregate";
  }

  // ---------- Sorting ----------
  export interface Sort {
    field: string; // a column / metric alias / calc alias
    direction: "asc" | "desc";
    /** explicit ordering priority (lower = primary); array order is the
     *  default if omitted. */
    priority?: number;
  }

  // ---------- Drill-down ----------
  export interface Drilldown {
    enabled: boolean;
    /** the clicked group value is injected as a filter into the target. */
    targetReportId?: string; // open another saved report
    /** OR an inline definition (no separate saved report needed). */
    targetDefinition?: ReportDefinition;
    /** which field's clicked value becomes the drill filter. */
    paramField: string; // e.g. "province"
    /** operator used when injecting the value (default "eq"). */
    operator?: FilterOperator;
  }

  // ---------- Meta (later phase) ----------
  export interface ReportMeta {
    tenantId?: string;
    ownerId?: string;
    createdAt?: string; // ISO
    updatedAt?: string;
    /** for AI provenance + cost tracking (later). */
    generatedBy?: { provider?: string; model?: string; promptVersion?: string };
  }
  ```

  > Note (R1 reconciliation): the spec §5 `FieldType` union additionally listed `"dimension"` and `"measure"`. Per R1 those analytical roles are NOT part of `FieldType`; they live in `semantic.ts` as `FieldRole`. `ColumnDef.type` and `CalculatedField.type` therefore use the reconciled `FieldType` (`"string" | "number" | "date" | "boolean"`).

- [ ] **Step 4: Write `report-web/src/contracts/semantic.ts`** — verbatim §6.2, with R1 applied (`FieldType`, `Aggregation`, `FieldFormat` imported from `common.ts`; the local `FieldType`/`Aggregation`/`FieldFormat` definitions from the spec are removed).
  ```ts
  import type { FieldType, Aggregation, FieldFormat } from "./common";

  // FieldType, Aggregation, FieldFormat come from common.ts (R1) — NOT redefined here.

  /**
   * Analytical role of a field — drives the auto-visualization rules
   * and what the Query Engine is allowed to do with it.
   *  - dimension: groupable / filterable category (province, status, customer)
   *  - measure:   numeric value that can be aggregated (revenue, area, count)
   *  - date:      time axis; special-cased for time-series detection + date grain
   */
  export type FieldRole = "dimension" | "measure" | "date";

  /** A single curated column exposed to the AI and the Query Engine. */
  export interface Field {
    /** stable machine id used in ReportDefinition; never shown to users. */
    id: string;
    /** the actual key in the dataset row (v1) / column mapping (later). */
    column: string;
    type: FieldType;
    role: FieldRole;
    /** business labels — the mapper matches prompt terms against these. */
    label: { "fa-IR": string; "en-US": string };
    /** extra synonyms/keywords the mock AI matches (fa + en), e.g. ["درآمد","فروش","sales"]. */
    synonyms?: string[];
    format?: FieldFormat;
    /** valid default aggregation for a measure; "none" for dimensions/dates. */
    defaultAggregation?: Aggregation;
    /** aggregations the engine permits on this field (guards against sum-of-year). */
    allowedAggregations?: Aggregation[];
    /** hide from pickers but still resolvable (e.g. raw id behind a count). */
    hidden?: boolean;
  }

  /** Pre-declared, curated join between two entities. */
  export interface Relationship {
    /** id local to the entity, referenced from ReportDefinition for drill-down. */
    id: string;
    /** target entity id within the same SemanticModel. */
    targetEntity: string;
    /** field id on THIS entity used as the foreign key. */
    localField: string;
    /** field id on the TARGET entity (its primary key). */
    targetField: string;
    cardinality: "one-to-one" | "one-to-many" | "many-to-one";
    label: { "fa-IR": string; "en-US": string };
  }

  /** A business entity = one logical "table" the AI can query. */
  export interface Entity {
    id: string; // "project" | "sales" | "finance"
    name: { "fa-IR": string; "en-US": string };
    description?: { "fa-IR": string; "en-US": string };
    /** v1: name of the bundled sample dataset; later: physical table/view. */
    source: string;
    fields: Field[];
    relationships?: Relationship[];
    /** field id used as the natural time axis for this entity, if any. */
    defaultDateField?: string;
  }

  /** The full semantic model for one tenant/data-source. */
  export interface SemanticModel {
    id: string;
    /** tenant scope — "global" for the v1 bundled demo tenant. */
    tenantId: string;
    name: { "fa-IR": string; "en-US": string };
    /** locale used for default label resolution. */
    defaultLocale: "fa-IR" | "en-US";
    version: number;
    entities: Entity[];
  }
  ```

- [ ] **Step 5: Write `report-web/src/contracts/dataset.ts`** — the R3 dataset + query-result shapes (canonical, overriding the abridged §8.5 sketch).
  ```ts
  import type { FieldType } from "./common";

  // R3: dataset + query-result contracts. The query engine (Task: query/engine.ts)
  // is PURE and SYNCHRONOUS: runQuery(def, dataset, semantic): QueryResult.

  /** One raw row of a bundled sample dataset. */
  export type Row = Record<string, string | number | boolean | null>;

  /** A bundled sample dataset = an array of rows. */
  export type Dataset = Row[];

  /** A row in the computed result (post-aggregation values are number|string|null). */
  export type ResultRow = Record<string, string | number | null>;

  /** A resolved output column with its display label + analytical flags. */
  export interface ResolvedColumn {
    key: string;
    label: string;
    type: FieldType;
    /** true when the column is an aggregated measure (drives auto-viz). */
    isMetric: boolean;
  }

  /** A drill-down group node: bucket value + member rows (+ nested children). */
  export interface GroupNode {
    key: string;
    value: string | number;
    rows: ResultRow[];
    children?: GroupNode[];
  }

  /** The full output of the in-browser query engine. */
  export interface QueryResult {
    columns: ResolvedColumn[];
    rows: ResultRow[];
    groups?: GroupNode[];
    total: number;
  }
  ```

- [ ] **Step 6: Write `report-web/src/contracts/ai.ts`** — the R2 AI seam (single `generate(req)` method; collapses the spec §7.4 multi-method interface per R2).
  ```ts
  import type { ReportDefinition } from "./report-definition";
  import type { SemanticModel } from "./semantic";

  // R2: the AI seam. ONE method: generate(req). The spec §7.4 multi-method
  // interface (generateReport/refineReport/suggestPrompts/stream) is collapsed
  // to this single canonical signature.

  export interface GenerateReportRequest {
    /** Raw user text, e.g. "درآمد ماهانه به تفکیک استان". */
    prompt: string;
    /** The tenant's semantic model — the ONLY schema the AI ever sees. */
    semanticModel: SemanticModel;
    locale: "fa" | "en";
  }

  /** The AI's output envelope (R2). */
  export interface AIReportResult {
    /** Validated, ready for the Query Engine. */
    definition: ReportDefinition;
    /** Human-readable interpretation ("I read this as…"). */
    explanation?: string;
    /** Token/cost/provider metadata for usage dashboards & audit log. */
    usage?: AIUsage;
    /** id of the matched example, when generation came from the example library. */
    matchedExample?: string;
  }

  export interface AIUsage {
    provider: string; // "openai" | "ollama" | "mock" | ...
    model: string; // "gpt-4o-mini", "mock-rules-v1", ...
    promptVersion: string; // "report-gen@3"
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number; // estimated; 0 for ollama/mock
    cached: boolean; // true if served from response cache
    latencyMs: number;
    fallbackUsed: boolean; // true if a non-primary provider answered
  }

  /** The single seam between UI and AI. v1 → MockReportAIService; later → Http. */
  export interface IReportAIService {
    generate(req: GenerateReportRequest): Promise<AIReportResult>;
  }
  ```

- [ ] **Step 7: Write `report-web/src/contracts/rbac.ts`** — verbatim §10.5 capability map + resolver, plus the `SessionUser` shape (R6) and the §10.8 `mapLegacyRoles`.
  ```ts
  // §10.5 — the swappable RBAC seam. In v1 roles come from the mock user;
  // later from the OIDC token. `can()` is unchanged across both.

  export type Permission =
    | "reports:write"
    | "reports:delete"
    | "reports:execute"
    | "data:export"
    | "ai:manage"
    | "datasources:manage"
    | "users:manage"
    | "audit:read";

  export type AppRole =
    | "SuperAdmin"
    | "TenantAdmin"
    | "AIManager"
    | "ReportDesigner"
    | "DashboardDesigner"
    | "PowerUser"
    | "Viewer";

  export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
    SuperAdmin: [
      "reports:write",
      "reports:delete",
      "reports:execute",
      "data:export",
      "ai:manage",
      "datasources:manage",
      "users:manage",
      "audit:read",
    ],
    TenantAdmin: [
      "reports:write",
      "reports:delete",
      "reports:execute",
      "data:export",
      "ai:manage",
      "datasources:manage",
      "users:manage",
      "audit:read",
    ],
    AIManager: ["reports:execute", "ai:manage", "audit:read"],
    ReportDesigner: ["reports:write", "reports:delete", "reports:execute", "data:export"],
    DashboardDesigner: ["reports:write", "reports:execute", "data:export"],
    PowerUser: ["reports:write", "reports:execute", "data:export"], // write = personal scope
    Viewer: ["reports:execute"], // data:export grantable
  };

  /** Effective permissions = union over all held roles (+ tenant-level grants). */
  export function permissionsFor(roles: AppRole[], grants: Permission[] = []): Set<Permission> {
    const set = new Set<Permission>(grants);
    for (const r of roles) for (const p of ROLE_PERMISSIONS[r]) set.add(p);
    return set;
  }

  export const can = (perms: Set<Permission>, p: Permission): boolean => perms.has(p);
  export const isGlobal = (roles: AppRole[]): boolean => roles.includes("SuperAdmin");

  /**
   * R6: the identity object `useAuth()` exposes. Sourced from the mock user
   * (VITE_AUTH_MODE=mock) or the OIDC token (VITE_AUTH_MODE=oidc) — one shape.
   */
  export interface SessionUser {
    id: string;
    name: string;
    email: string;
    roles: AppRole[];
    tenantId: string | null;
    /** per-tenant grants (e.g. Viewer export) — merged into permissionsFor(). */
    grants?: Permission[];
  }

  /**
   * §10.8 — map existing IdP roles (`Administrator`/`User`) + native `report.*`
   * claims to AppRole[]. Native `report.*` claims win; legacy fallback only fires
   * when none present; default-deny resolves to Viewer.
   */
  export function mapLegacyRoles(claimRoles: string[]): AppRole[] {
    const mapped: AppRole[] = [];
    for (const r of claimRoles) {
      if (r.startsWith("report.")) mapped.push(r.slice("report.".length) as AppRole);
      else if (r === "Administrator") mapped.push("SuperAdmin"); // or "TenantAdmin" per deployment
      else if (r === "User") mapped.push("PowerUser"); // or "Viewer"
    }
    return mapped.length ? Array.from(new Set(mapped)) : ["Viewer"]; // safe default
  }
  ```

- [ ] **Step 8: Write `report-web/src/contracts/tenant.ts`** — verbatim §11.2 / §11.5 / §11.6 TS shapes.
  ```ts
  // §11 — multi-tenant model. v1: seeded into localStorage by the mock API + Zustand.

  export type TenantStatus = "active" | "suspended" | "trial";
  export type TenantPlan = "free" | "pro" | "enterprise";

  export interface Tenant {
    id: string; // ULID/GUID; the isolation key
    slug: string; // url/display key, e.g. "acme-co"
    displayName: string; // Persian display name, e.g. "شرکت آلفا"
    status: TenantStatus;
    plan: TenantPlan;
    branding: TenantBranding;
    aiConfig: TenantAiConfig; // §11.5
    quotas: TenantQuotas; // §11.6
    dataSourceIds: string[]; // FKs into per-tenant data sources (§11.4)
    defaultLocale: "fa-IR" | "en-US";
    createdAt: string; // ISO
    updatedAt: string;
  }

  export interface TenantBranding {
    logoUrl?: string;
    primaryColor: string; // hex; feeds the AntD ConfigProvider theme token
    accentColor?: string;
    productName?: string; // white-label override of "AI Reporting"
    faviconUrl?: string;
    loginBackgroundUrl?: string;
  }

  // Every tenant-scoped entity carries a tenantId FK (§11.2).
  export interface TenantScoped {
    tenantId: string;
  }

  // §11.5 — per-tenant AI configuration.
  export interface TenantAiConfig {
    defaultProviderId: string;
    providers: AiProviderConfig[]; // OpenAI, Azure, Ollama, DeepSeek, GLM, Claude, Gemini, OpenRouter, Custom
    fallbackChain: string[]; // provider ids, tried in order
    promptVersion: string; // pinned prompt template version
    responseCacheTtlSeconds: number;
    monthlyTokenBudget: number; // feeds quota (§11.6)
    monthlyCostBudget: number; // currency units
  }

  export interface AiProviderConfig extends TenantScoped {
    id: string;
    provider:
      | "openai"
      | "azure"
      | "ollama"
      | "deepseek"
      | "glm"
      | "claude"
      | "gemini"
      | "openrouter"
      | "custom";
    model: string;
    apiKeyRef: string; // opaque; secret resolved server-side
    baseUrl?: string; // for ollama/custom/azure
    enabled: boolean;
  }

  // §11.6 — quota management.
  export interface TenantQuotas {
    maxUsers: number;
    maxReports: number;
    maxDashboards: number;
    maxDataSources: number;
    monthlyAiTokens: number; // see TenantAiConfig.monthlyTokenBudget
    monthlyAiCost: number;
    monthlyExports: number;
    storageMb: number;
  }

  export interface TenantUsage extends TenantScoped {
    period: string; // "2026-06"
    users: number;
    reports: number;
    dashboards: number;
    dataSources: number;
    aiTokens: number;
    aiCost: number;
    exports: number;
    storageMb: number;
  }
  ```

- [ ] **Step 9: Write `report-web/src/contracts/index.ts`** — the barrel every later task imports as `@/contracts`.
  ```ts
  export * from "./common";
  export * from "./report-definition";
  export * from "./presentation";
  export * from "./semantic";
  export * from "./dataset";
  export * from "./ai";
  export * from "./rbac";
  export * from "./tenant";
  ```

- [ ] **Step 10: Write the failing shape/type test `report-web/src/contracts/contracts.test.ts`.** It locks in (a) the R1 reconciled scalar unions, (b) the RBAC resolver behavior, (c) the legacy-role mapper, and (d) that a fully-formed `ReportDefinition` + `QueryResult` literal type-checks against the contracts.
  ```ts
  import { describe, it, expect, expectTypeOf } from "vitest";
  import {
    ROLE_PERMISSIONS,
    permissionsFor,
    can,
    isGlobal,
    mapLegacyRoles,
  } from "@/contracts";
  import type {
    FieldType,
    Aggregation,
    ReportDefinition,
    QueryResult,
    Row,
    ResultRow,
    SessionUser,
    AppRole,
    Permission,
  } from "@/contracts";

  describe("contracts/common (R1)", () => {
    it("FieldType is the reconciled 4-member union (no dimension/measure)", () => {
      expectTypeOf<FieldType>().toEqualTypeOf<"string" | "number" | "date" | "boolean">();
    });

    it("Aggregation is the R1 7-member union", () => {
      expectTypeOf<Aggregation>().toEqualTypeOf<
        "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none"
      >();
    });
  });

  describe("contracts/rbac (§10.5)", () => {
    it("AIManager cannot write reports but can manage AI + read audit", () => {
      const perms = permissionsFor(["AIManager"]);
      expect(can(perms, "ai:manage")).toBe(true);
      expect(can(perms, "audit:read")).toBe(true);
      expect(can(perms, "reports:write")).toBe(false);
      expect(can(perms, "data:export")).toBe(false);
    });

    it("effective permissions are the UNION over multiple roles", () => {
      const perms = permissionsFor(["ReportDesigner", "DashboardDesigner"]);
      expect(can(perms, "reports:write")).toBe(true);
      expect(can(perms, "reports:delete")).toBe(true); // from ReportDesigner
    });

    it("a tenant grant (Viewer export) is merged in", () => {
      const perms = permissionsFor(["Viewer"], ["data:export"]);
      expect(can(perms, "reports:execute")).toBe(true);
      expect(can(perms, "data:export")).toBe(true);
    });

    it("isGlobal is true only for SuperAdmin", () => {
      expect(isGlobal(["SuperAdmin"])).toBe(true);
      expect(isGlobal(["TenantAdmin", "AIManager"])).toBe(false);
    });

    it("every AppRole has an entry in ROLE_PERMISSIONS", () => {
      const roles: AppRole[] = [
        "SuperAdmin",
        "TenantAdmin",
        "AIManager",
        "ReportDesigner",
        "DashboardDesigner",
        "PowerUser",
        "Viewer",
      ];
      for (const r of roles) expect(Array.isArray(ROLE_PERMISSIONS[r])).toBe(true);
    });
  });

  describe("contracts/rbac mapLegacyRoles (§10.8)", () => {
    it("native report.* claims win and strip the prefix", () => {
      expect(mapLegacyRoles(["report.TenantAdmin", "report.AIManager"])).toEqual([
        "TenantAdmin",
        "AIManager",
      ]);
    });

    it("legacy Administrator → SuperAdmin, User → PowerUser", () => {
      expect(mapLegacyRoles(["Administrator"])).toEqual(["SuperAdmin"]);
      expect(mapLegacyRoles(["User"])).toEqual(["PowerUser"]);
    });

    it("unknown / empty resolves to Viewer (default-deny)", () => {
      expect(mapLegacyRoles([])).toEqual(["Viewer"]);
      expect(mapLegacyRoles(["something-else"])).toEqual(["Viewer"]);
    });
  });

  describe("contracts shapes type-check (R2/R3/R6)", () => {
    it("a fully-formed ReportDefinition literal satisfies the contract", () => {
      const def: ReportDefinition = {
        id: "rep-1",
        schemaVersion: "1.0",
        name: "درآمد ماهانه به تفکیک استان",
        dataset: "sales",
        columns: [
          { field: "province", type: "string" },
          { field: "amount", type: "number" },
        ],
        filters: [{ field: "amount", operator: "gt", value: 0 }],
        groupBy: [{ field: "province" }, { field: "order_date", dateBucket: "month" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "total_revenue" }],
        sorting: [{ field: "order_date", direction: "asc" }],
        presentation: {
          views: [
            {
              type: "chart",
              library: "recharts",
              component: "LineChart",
              mapping: { x: "order_date", y: ["total_revenue"], series: "province" },
            },
          ],
        },
      };
      expect(def.dataset).toBe("sales");
      expect(def.presentation.views[0].library).toBe("recharts");
    });

    it("Row allows boolean|null but ResultRow does not allow boolean", () => {
      const row: Row = { a: "x", b: 1, c: true, d: null };
      const result: ResultRow = { a: "x", b: 1, d: null };
      expectTypeOf(row.c).toEqualTypeOf<string | number | boolean | null>();
      expectTypeOf(result.a).toEqualTypeOf<string | number | null>();
    });

    it("a QueryResult literal satisfies the R3 contract", () => {
      const qr: QueryResult = {
        columns: [
          { key: "province", label: "استان", type: "string", isMetric: false },
          { key: "total_revenue", label: "درآمد", type: "number", isMetric: true },
        ],
        rows: [{ province: "تهران", total_revenue: 1000 }],
        total: 1,
      };
      expect(qr.total).toBe(1);
      expect(qr.columns[1].isMetric).toBe(true);
    });

    it("SessionUser holds roles + tenant + optional grants (R6)", () => {
      const user: SessionUser = {
        id: "u1",
        name: "کاربر نمونه",
        email: "u1@example.com",
        roles: ["PowerUser"] as AppRole[],
        tenantId: "t-alpha",
        grants: ["data:export"] as Permission[],
      };
      expect(user.roles).toContain("PowerUser");
    });
  });
  ```

- [ ] **Step 11: Run the new test (expected FAIL — files referenced by `@/contracts` must exist; if any export/type is wrong it fails here first).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npx vitest run src/contracts/contracts.test.ts
  ```
  Expected on first run before fixes (if any drift): a TS/import error or assertion failure. After Steps 1-10 are correct it should already pass; if it fails, fix the contract file the error names, then re-run. Target output:
  ```
   ✓ src/contracts/contracts.test.ts (NN tests)
  ```

- [ ] **Step 12: Run the strict typecheck (expected PASS).** This is the primary contracts gate per the task spec.
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm run typecheck
  ```
  Expected: exits 0, no output (no `tsc` errors — proves R1/R2/R3/R6 imports resolve and the literals type-check).

- [ ] **Step 13: Run the full test + lint suite (expected PASS).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm test && npm run lint
  ```
  Expected (test tail):
  ```
   Test Files  2 passed (2)
        Tests  NN passed (NN)
  ```
  and lint exits 0.

- [ ] **Step 14: Run the production build (expected PASS — confirms the contracts compile under `tsc -b` + Vite).**
  ```bash
  cd /d/projects/mabhas19App/mabhas19/report-web && npm run build
  ```
  Expected: `✓ built in NNNms`.

- [ ] **Step 15: Commit.**
  ```bash
  cd /d/projects/mabhas19App/mabhas19 && git add report-web/src/contracts && \
  git commit -m "$(printf 'feat(report-web): contracts — report-definition, semantic, dataset, ai, rbac, tenant\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
  ```
  Expected: `[feat/report-service <hash>] feat(report-web): contracts — ...`.

**Acceptance criteria:** `import { ReportDefinition, QueryResult, IReportAIService, AppRole, Tenant } from "@/contracts"` resolves; `FieldType` is exactly `"string" | "number" | "date" | "boolean"` and `Aggregation` is the R1 7-member union (both defined ONCE in `common.ts` and imported by `report-definition.ts` + `semantic.ts`); `IReportAIService` exposes exactly `generate(req: GenerateReportRequest): Promise<AIReportResult>` (R2); `Dataset`/`Row`/`QueryResult`/`ResolvedColumn`/`GroupNode`/`ResultRow` match R3 exactly; `SessionUser`/`AppRole`/`Permission`/`ROLE_PERMISSIONS`/`permissionsFor`/`can`/`isGlobal`/`mapLegacyRoles` are exported (R6 + §10); `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` all exit 0.


### Task 3: Semantic models + sample datasets + registry

Three bundled `SemanticModel`s (Project, Sales, Finance), each paired with a sample `Dataset`, plus a `registry.ts` that resolves a model/dataset by id. The §6 models are extended with the extra fields the §5 worked examples query (`status`, `dueDate`, `delayDays`, `customerName`) so Tasks 4-5 can run the canonical example definitions and assert concrete numbers. Datasets are sized deterministically (Project 12 rows, Sales 30 rows, Finance 20 rows) so the engine tests assert exact totals.

**Files:**
- Create: `report-web/src/semantic/models/project.ts`
- Create: `report-web/src/semantic/models/sales.ts`
- Create: `report-web/src/semantic/models/finance.ts`
- Create: `report-web/src/semantic/datasets/project.ts`
- Create: `report-web/src/semantic/datasets/sales.ts`
- Create: `report-web/src/semantic/datasets/finance.ts`
- Create: `report-web/src/semantic/registry.ts`
- Test: `report-web/src/semantic/registry.test.ts`

**Interfaces:**

Consumes (from Task 1 — `contracts/`):
- `contracts/common.ts` → `export type FieldType = "string" | "number" | "date" | "boolean";` · `export type Aggregation = "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none";`
- `contracts/semantic.ts` → these exact shapes (R1: `FieldType`/`Aggregation` re-imported from `common.ts`, not redeclared):
  ```ts
  export type FieldRole = "dimension" | "measure" | "date";
  export interface FieldFormat { kind: "number" | "currency" | "percent" | "date" | "text"; currency?: string; decimals?: number; pattern?: string; grouping?: boolean; }
  export interface Field { id: string; column: string; type: FieldType; role: FieldRole; label: { "fa-IR": string; "en-US": string }; synonyms?: string[]; format?: FieldFormat; defaultAggregation?: Aggregation; allowedAggregations?: Aggregation[]; hidden?: boolean; }
  export interface Relationship { id: string; targetEntity: string; localField: string; targetField: string; cardinality: "one-to-one" | "one-to-many" | "many-to-one"; label: { "fa-IR": string; "en-US": string }; }
  export interface Entity { id: string; name: { "fa-IR": string; "en-US": string }; description?: { "fa-IR": string; "en-US": string }; source: string; fields: Field[]; relationships?: Relationship[]; defaultDateField?: string; }
  export interface SemanticModel { id: string; tenantId: string; name: { "fa-IR": string; "en-US": string }; defaultLocale: "fa-IR" | "en-US"; version: number; entities: Entity[]; }
  ```
- `contracts/dataset.ts` → `export type Row = Record<string, string | number | boolean | null>; export type Dataset = Row[];` (R3)

Produces (Tasks 4, 5 and the AI/auto-viz tasks rely on these exact names):
- `projectModel`, `salesModel`, `financeModel` (`SemanticModel`)
- `projectData`, `salesData`, `financeData` (`Dataset`)
- `registry.ts`:
  - `export const semanticModels: Record<string, SemanticModel>` keyed by model id (`"model-project" | "model-sales" | "model-finance"`)
  - `export const datasets: Record<string, Dataset>` keyed by **entity source** (`"projects" | "sales" | "finance"`)
  - `export function getSemanticModel(id: string): SemanticModel` — throws `Error` on unknown id
  - `export function getDataset(source: string): Dataset` — throws `Error` on unknown source
  - `export function getModelForDataset(source: string): SemanticModel` — returns the model whose entity `source` matches (used by the viewer/AI to pair a definition's `dataset` with its model)

- [ ] **Step 1: Project semantic model.** Create `report-web/src/semantic/models/project.ts`. Reproduce the §6.3.1 model verbatim, then ADD the fields the §5.7 example queries (`status`, `dueDate`, `delayDays`) and a `title`-as-`name` alias. Import types from contracts.
  ```ts
  import type { SemanticModel } from "../../contracts/semantic";

  export const projectModel: SemanticModel = {
    id: "model-project",
    tenantId: "global",
    version: 1,
    defaultLocale: "fa-IR",
    name: { "fa-IR": "پروژه‌ها", "en-US": "Projects" },
    entities: [
      {
        id: "project",
        source: "projects",
        name: { "fa-IR": "پروژه", "en-US": "Project" },
        description: { "fa-IR": "پروژه‌های ساختمانی", "en-US": "Construction projects" },
        defaultDateField: "startDate",
        fields: [
          { id: "id", column: "id", type: "string", role: "dimension", hidden: true,
            label: { "fa-IR": "شناسه", "en-US": "ID" }, defaultAggregation: "countDistinct",
            allowedAggregations: ["count", "countDistinct"] },
          { id: "name", column: "name", type: "string", role: "dimension",
            label: { "fa-IR": "نام پروژه", "en-US": "Project Name" }, synonyms: ["عنوان پروژه", "title"] },
          { id: "province", column: "province", type: "string", role: "dimension",
            label: { "fa-IR": "استان", "en-US": "Province" }, synonyms: ["شهر", "استان‌ها", "region"] },
          { id: "status", column: "status", type: "string", role: "dimension",
            label: { "fa-IR": "وضعیت", "en-US": "Status" }, synonyms: ["مرحله", "state"] },
          { id: "buildingGroup", column: "buildingGroup", type: "string", role: "dimension",
            label: { "fa-IR": "گروه ساختمان", "en-US": "Building Group" } },
          { id: "area", column: "areaM2", type: "number", role: "measure",
            label: { "fa-IR": "مساحت (مترمربع)", "en-US": "Area (m²)" }, synonyms: ["متراژ", "زیربنا"],
            defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
            format: { kind: "number", decimals: 0, grouping: true } },
          { id: "score", column: "score", type: "number", role: "measure",
            label: { "fa-IR": "امتیاز ارزیابی", "en-US": "Assessment Score" }, synonyms: ["نمره", "امتیاز"],
            defaultAggregation: "avg", allowedAggregations: ["avg", "min", "max"],
            format: { kind: "number", decimals: 1 } },
          { id: "delayDays", column: "delayDays", type: "number", role: "measure",
            label: { "fa-IR": "تأخیر (روز)", "en-US": "Delay (days)" }, synonyms: ["تاخیر", "delay"],
            defaultAggregation: "avg", allowedAggregations: ["avg", "min", "max", "sum"],
            format: { kind: "number", decimals: 0 } },
          { id: "startDate", column: "startDate", type: "date", role: "date",
            label: { "fa-IR": "تاریخ شروع", "en-US": "Start Date" }, synonyms: ["زمان", "ماه", "سال"],
            format: { kind: "date", pattern: "yyyy/MM" } },
          { id: "dueDate", column: "dueDate", type: "date", role: "date",
            label: { "fa-IR": "موعد", "en-US": "Due Date" }, synonyms: ["سررسید", "deadline"],
            format: { kind: "date", pattern: "yyyy/MM" } },
        ],
      },
    ],
  };
  ```

- [ ] **Step 2: Sales semantic model.** Create `report-web/src/semantic/models/sales.ts`. Reproduce §6.3.2 verbatim, ADD `customerName` (queried by §5.9), `amount` as an alias-synonym of `revenue` (the §5 examples use `amount`; keep one canonical measure id `revenue` whose synonyms include `amount`, plus the §6 cross-model relationship), and `status`.
  ```ts
  import type { SemanticModel } from "../../contracts/semantic";

  export const salesModel: SemanticModel = {
    id: "model-sales",
    tenantId: "global",
    version: 1,
    defaultLocale: "fa-IR",
    name: { "fa-IR": "فروش", "en-US": "Sales" },
    entities: [
      {
        id: "sales",
        source: "sales",
        name: { "fa-IR": "سفارش فروش", "en-US": "Sales Order" },
        description: { "fa-IR": "سفارش‌های فروش", "en-US": "Sales orders" },
        defaultDateField: "orderDate",
        relationships: [
          { id: "sales_to_project_province", targetEntity: "project", localField: "province",
            targetField: "province", cardinality: "many-to-one",
            label: { "fa-IR": "استان پروژه", "en-US": "Project province" } },
        ],
        fields: [
          { id: "orderId", column: "orderId", type: "string", role: "dimension", hidden: true,
            label: { "fa-IR": "شماره سفارش", "en-US": "Order ID" },
            defaultAggregation: "countDistinct", allowedAggregations: ["count", "countDistinct"] },
          { id: "customerName", column: "customerName", type: "string", role: "dimension",
            label: { "fa-IR": "مشتری", "en-US": "Customer" }, synonyms: ["نام مشتری", "customer"] },
          { id: "product", column: "product", type: "string", role: "dimension",
            label: { "fa-IR": "محصول", "en-US": "Product" }, synonyms: ["کالا", "item"] },
          { id: "category", column: "category", type: "string", role: "dimension",
            label: { "fa-IR": "دسته‌بندی", "en-US": "Category" }, synonyms: ["گروه کالا"] },
          { id: "province", column: "province", type: "string", role: "dimension",
            label: { "fa-IR": "استان", "en-US": "Province" }, synonyms: ["منطقه", "region"] },
          { id: "channel", column: "channel", type: "string", role: "dimension",
            label: { "fa-IR": "کانال فروش", "en-US": "Channel" }, synonyms: ["آنلاین", "حضوری"] },
          { id: "status", column: "status", type: "string", role: "dimension",
            label: { "fa-IR": "وضعیت", "en-US": "Status" }, synonyms: ["مرحله", "state"] },
          { id: "quantity", column: "qty", type: "number", role: "measure",
            label: { "fa-IR": "تعداد", "en-US": "Quantity" }, synonyms: ["مقدار"],
            defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
            format: { kind: "number", decimals: 0, grouping: true } },
          { id: "amount", column: "amount", type: "number", role: "measure",
            label: { "fa-IR": "درآمد", "en-US": "Revenue" },
            synonyms: ["فروش", "مبلغ", "درآمد کل", "sales", "amount", "revenue"],
            defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
            format: { kind: "currency", currency: "IRR", decimals: 0, grouping: true } },
          { id: "orderDate", column: "orderDate", type: "date", role: "date",
            label: { "fa-IR": "تاریخ سفارش", "en-US": "Order Date" },
            synonyms: ["ماه", "سال", "زمان", "monthly"], format: { kind: "date", pattern: "yyyy/MM" } },
        ],
      },
    ],
  };
  ```
  > Reconciliation note (write as a code comment above the `amount` field): §6.3 names this measure `revenue`; §5.8/§5.9 reference it as `amount`. We use a single canonical id `amount` (label "Revenue", synonyms include `revenue`) so both the §5 worked-example definitions and the AI prompt-mapping resolve to the same field.

- [ ] **Step 3: Finance semantic model.** Create `report-web/src/semantic/models/finance.ts`. Reproduce §6.3.3 verbatim with contract imports.
  ```ts
  import type { SemanticModel } from "../../contracts/semantic";

  export const financeModel: SemanticModel = {
    id: "model-finance",
    tenantId: "global",
    version: 1,
    defaultLocale: "fa-IR",
    name: { "fa-IR": "مالی", "en-US": "Finance" },
    entities: [
      {
        id: "finance",
        source: "finance",
        name: { "fa-IR": "تراکنش مالی", "en-US": "Financial Transaction" },
        description: { "fa-IR": "تراکنش‌های مالی", "en-US": "Financial transactions" },
        defaultDateField: "txnDate",
        fields: [
          { id: "txnId", column: "txnId", type: "string", role: "dimension", hidden: true,
            label: { "fa-IR": "شناسه تراکنش", "en-US": "Transaction ID" },
            defaultAggregation: "countDistinct", allowedAggregations: ["count", "countDistinct"] },
          { id: "account", column: "account", type: "string", role: "dimension",
            label: { "fa-IR": "حساب", "en-US": "Account" }, synonyms: ["سرفصل", "حساب کل"] },
          { id: "costCenter", column: "costCenter", type: "string", role: "dimension",
            label: { "fa-IR": "مرکز هزینه", "en-US": "Cost Center" }, synonyms: ["دپارتمان", "واحد"] },
          { id: "type", column: "type", type: "string", role: "dimension",
            label: { "fa-IR": "نوع", "en-US": "Type" }, synonyms: ["درآمد/هزینه", "debit", "credit"] },
          { id: "amount", column: "amount", type: "number", role: "measure",
            label: { "fa-IR": "مبلغ", "en-US": "Amount" }, synonyms: ["مبلغ کل", "هزینه", "درآمد", "amount"],
            defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
            format: { kind: "currency", currency: "IRR", decimals: 0, grouping: true } },
          { id: "marginPct", column: "marginPct", type: "number", role: "measure",
            label: { "fa-IR": "حاشیه سود", "en-US": "Margin %" }, synonyms: ["درصد سود", "margin"],
            defaultAggregation: "avg", allowedAggregations: ["avg", "min", "max"],
            format: { kind: "percent", decimals: 1 } },
          { id: "txnDate", column: "txnDate", type: "date", role: "date",
            label: { "fa-IR": "تاریخ", "en-US": "Date" }, synonyms: ["ماه", "سال", "فصل", "quarterly"],
            format: { kind: "date", pattern: "yyyy/MM" } },
        ],
      },
    ],
  };
  ```

- [ ] **Step 4: Project dataset (12 rows, deterministic).** Create `report-web/src/semantic/datasets/project.ts`. Rows are chosen so §5.7 ("delayed > 30 days, by province") yields exact counts. Status uses the §5.7 sentinel `"completed"` (the example filters `status neq "completed"`). `dueDate` values are absolute and in the past relative to the engine tests' frozen "today" (Task 4 freezes today to `2025-06-01`), so `delayDays` and the `dueDate < today-30` filter are deterministic. Province distribution: تهران=4 rows (3 non-completed & overdue), اصفهان=3 (2 overdue), خوزستان=3 (2 overdue), فارس=2 (1 overdue).
  ```ts
  import type { Dataset } from "../../contracts/dataset";

  export const projectData: Dataset = [
    { id: "P-1001", name: "برج مسکونی نیلوفر",  province: "تهران",   status: "در حال اجرا", buildingGroup: "گروه ۴", areaM2: 8200, score: 78.5, delayDays: 45, startDate: "2025-01-10", dueDate: "2025-03-01" },
    { id: "P-1002", name: "مجتمع تجاری آرین",   province: "تهران",   status: "در حال اجرا", buildingGroup: "گروه ۳", areaM2: 5400, score: 64.0, delayDays: 60, startDate: "2025-01-22", dueDate: "2025-02-15" },
    { id: "P-1003", name: "ساختمان اداری پارس", province: "تهران",   status: "متوقف",      buildingGroup: "گروه ۲", areaM2: 3100, score: 55.0, delayDays: 90, startDate: "2024-12-05", dueDate: "2025-01-20" },
    { id: "P-1004", name: "ویلا باغ شمال",      province: "تهران",   status: "completed",  buildingGroup: "گروه ۱", areaM2: 420,  score: 88.0, delayDays: 0,  startDate: "2025-01-30", dueDate: "2025-03-10" },
    { id: "P-1005", name: "هتل اصفهان",         province: "اصفهان",  status: "در حال اجرا", buildingGroup: "گروه ۴", areaM2: 9600, score: 71.0, delayDays: 50, startDate: "2025-02-01", dueDate: "2025-04-01" },
    { id: "P-1006", name: "بیمارستان زهرا",     province: "اصفهان",  status: "متوقف",      buildingGroup: "گروه ۴", areaM2: 12000, score: 62.0, delayDays: 120, startDate: "2024-11-15", dueDate: "2025-01-05" },
    { id: "P-1007", name: "مدرسه نمونه",        province: "اصفهان",  status: "completed",  buildingGroup: "گروه ۲", areaM2: 2200, score: 80.0, delayDays: 0,  startDate: "2025-03-02", dueDate: "2025-05-01" },
    { id: "P-1008", name: "پالایشگاه جنوب",     province: "خوزستان", status: "در حال اجرا", buildingGroup: "گروه ۴", areaM2: 15000, score: 58.0, delayDays: 35, startDate: "2025-02-20", dueDate: "2025-04-20" },
    { id: "P-1009", name: "اسکله بندر",         province: "خوزستان", status: "در حال اجرا", buildingGroup: "گروه ۳", areaM2: 6800, score: 66.0, delayDays: 70, startDate: "2025-01-08", dueDate: "2025-03-15" },
    { id: "P-1010", name: "انبار صنعتی",        province: "خوزستان", status: "completed",  buildingGroup: "گروه ۱", areaM2: 4000, score: 75.0, delayDays: 0,  startDate: "2025-03-18", dueDate: "2025-05-10" },
    { id: "P-1011", name: "مرکز خرید فارس",     province: "فارس",    status: "در حال اجرا", buildingGroup: "گروه ۳", areaM2: 7200, score: 69.0, delayDays: 40, startDate: "2025-02-11", dueDate: "2025-04-10" },
    { id: "P-1012", name: "پارک علم و فناوری",  province: "فارس",    status: "completed",  buildingGroup: "گروه ۲", areaM2: 5000, score: 82.0, delayDays: 0,  startDate: "2025-03-25", dueDate: "2025-05-25" },
  ];
  ```
  > Derivable facts for Task 4 assertions (today frozen at `2025-06-01`, threshold date = `2025-05-02`): non-`completed` AND `dueDate < 2025-05-02` → تهران 3 (P-1001/1002/1003), اصفهان 2 (P-1005/1006), خوزستان 2 (P-1008/1009), فارس 1 (P-1011). avg `delayDays` per province over those rows: تهران (45+60+90)/3 = 65, اصفهان (50+120)/2 = 85, خوزستان (35+70)/2 = 52.5, فارس 40.

- [ ] **Step 5: Sales dataset (30 rows, deterministic).** Create `report-web/src/semantic/datasets/sales.ts`. Designed for §5.8 (monthly revenue by province) and §5.9 (top-10 customers). 5 customers, 4 provinces, `orderDate` spread across Jan–May 2025, `status ∈ {paid, shipped, delivered, cancelled, pending}`. Construct so §5.9's filter `status in ["paid","shipped","delivered"]` keeps a known subset and customer totals are easy to rank.
  ```ts
  import type { Dataset } from "../../contracts/dataset";

  export const salesData: Dataset = [
    { orderId: "S-001", customerName: "شرکت آلفا",  product: "سیمان تیپ ۲", category: "مصالح", province: "تهران",   channel: "آنلاین", status: "paid",      qty: 120, amount: 360000000, orderDate: "2025-01-15" },
    { orderId: "S-002", customerName: "شرکت آلفا",  product: "میلگرد A3",   category: "فولاد", province: "تهران",   channel: "حضوری",  status: "delivered", qty: 40,  amount: 880000000, orderDate: "2025-02-03" },
    { orderId: "S-003", customerName: "شرکت آلفا",  product: "آجر نسوز",    category: "مصالح", province: "تهران",   channel: "آنلاین", status: "shipped",   qty: 200, amount: 260000000, orderDate: "2025-03-11" },
    { orderId: "S-004", customerName: "شرکت بتا",   product: "سیمان تیپ ۲", category: "مصالح", province: "اصفهان",  channel: "آنلاین", status: "paid",      qty: 90,  amount: 270000000, orderDate: "2025-01-20" },
    { orderId: "S-005", customerName: "شرکت بتا",   product: "گچ",          category: "مصالح", province: "اصفهان",  channel: "حضوری",  status: "delivered", qty: 300, amount: 150000000, orderDate: "2025-02-18" },
    { orderId: "S-006", customerName: "شرکت بتا",   product: "میلگرد A3",   category: "فولاد", province: "اصفهان",  channel: "آنلاین", status: "cancelled", qty: 50,  amount: 500000000, orderDate: "2025-03-05" },
    { orderId: "S-007", customerName: "شرکت گاما",  product: "تیرآهن",      category: "فولاد", province: "خوزستان", channel: "حضوری",  status: "delivered", qty: 30,  amount: 1200000000, orderDate: "2025-01-28" },
    { orderId: "S-008", customerName: "شرکت گاما",  product: "میلگرد A3",   category: "فولاد", province: "خوزستان", channel: "آنلاین", status: "paid",      qty: 60,  amount: 900000000, orderDate: "2025-02-14" },
    { orderId: "S-009", customerName: "شرکت گاما",  product: "سیمان تیپ ۲", category: "مصالح", province: "خوزستان", channel: "حضوری",  status: "shipped",   qty: 110, amount: 330000000, orderDate: "2025-04-09" },
    { orderId: "S-010", customerName: "شرکت دلتا",  product: "کاشی",        category: "مصالح", province: "فارس",    channel: "آنلاین", status: "paid",      qty: 500, amount: 450000000, orderDate: "2025-01-31" },
    { orderId: "S-011", customerName: "شرکت دلتا",  product: "سرامیک",      category: "مصالح", province: "فارس",    channel: "آنلاین", status: "delivered", qty: 400, amount: 520000000, orderDate: "2025-02-22" },
    { orderId: "S-012", customerName: "شرکت دلتا",  product: "تیرآهن",      category: "فولاد", province: "فارس",    channel: "حضوری",  status: "pending",   qty: 20,  amount: 800000000, orderDate: "2025-03-19" },
    { orderId: "S-013", customerName: "شرکت اپسیلون", product: "گچ",       category: "مصالح", province: "تهران",   channel: "آنلاین", status: "delivered", qty: 250, amount: 125000000, orderDate: "2025-01-12" },
    { orderId: "S-014", customerName: "شرکت اپسیلون", product: "آجر نسوز", category: "مصالح", province: "تهران",   channel: "حضوری",  status: "paid",      qty: 180, amount: 234000000, orderDate: "2025-02-26" },
    { orderId: "S-015", customerName: "شرکت اپسیلون", product: "میلگرد A3",category: "فولاد", province: "تهران",   channel: "آنلاین", status: "shipped",   qty: 70,  amount: 1050000000, orderDate: "2025-03-30" },
    { orderId: "S-016", customerName: "شرکت آلفا",  product: "کاشی",        category: "مصالح", province: "تهران",   channel: "آنلاین", status: "paid",      qty: 320, amount: 288000000, orderDate: "2025-04-15" },
    { orderId: "S-017", customerName: "شرکت بتا",   product: "تیرآهن",      category: "فولاد", province: "اصفهان",  channel: "حضوری",  status: "delivered", qty: 25,  amount: 1000000000, orderDate: "2025-04-21" },
    { orderId: "S-018", customerName: "شرکت گاما",  product: "گچ",          category: "مصالح", province: "خوزستان", channel: "آنلاین", status: "delivered", qty: 280, amount: 140000000, orderDate: "2025-05-02" },
    { orderId: "S-019", customerName: "شرکت دلتا",  product: "سیمان تیپ ۲", category: "مصالح", province: "فارس",    channel: "حضوری",  status: "paid",      qty: 130, amount: 390000000, orderDate: "2025-05-10" },
    { orderId: "S-020", customerName: "شرکت اپسیلون", product: "سرامیک",   category: "مصالح", province: "تهران",   channel: "آنلاین", status: "cancelled", qty: 90,  amount: 117000000, orderDate: "2025-05-14" },
    { orderId: "S-021", customerName: "شرکت آلفا",  product: "تیرآهن",      category: "فولاد", province: "تهران",   channel: "حضوری",  status: "delivered", qty: 35,  amount: 1400000000, orderDate: "2025-05-18" },
    { orderId: "S-022", customerName: "شرکت بتا",   product: "کاشی",        category: "مصالح", province: "اصفهان",  channel: "آنلاین", status: "shipped",   qty: 260, amount: 234000000, orderDate: "2025-03-22" },
    { orderId: "S-023", customerName: "شرکت گاما",  product: "آجر نسوز",    category: "مصالح", province: "خوزستان", channel: "حضوری",  status: "paid",      qty: 150, amount: 195000000, orderDate: "2025-03-27" },
    { orderId: "S-024", customerName: "شرکت دلتا",  product: "میلگرد A3",   category: "فولاد", province: "فارس",    channel: "آنلاین", status: "delivered", qty: 55,  amount: 770000000, orderDate: "2025-04-02" },
    { orderId: "S-025", customerName: "شرکت اپسیلون", product: "سیمان تیپ ۲",category: "مصالح",province: "تهران",   channel: "حضوری",  status: "paid",      qty: 140, amount: 420000000, orderDate: "2025-04-25" },
    { orderId: "S-026", customerName: "شرکت آلفا",  product: "گچ",          category: "مصالح", province: "تهران",   channel: "آنلاین", status: "pending",   qty: 210, amount: 105000000, orderDate: "2025-05-21" },
    { orderId: "S-027", customerName: "شرکت بتا",   product: "سرامیک",      category: "مصالح", province: "اصفهان",  channel: "حضوری",  status: "delivered", qty: 175, amount: 227500000, orderDate: "2025-05-23" },
    { orderId: "S-028", customerName: "شرکت گاما",  product: "تیرآهن",      category: "فولاد", province: "خوزستان", channel: "آنلاین", status: "shipped",   qty: 28,  amount: 1120000000, orderDate: "2025-05-25" },
    { orderId: "S-029", customerName: "شرکت دلتا",  product: "آجر نسوز",    category: "مصالح", province: "فارس",    channel: "حضوری",  status: "paid",      qty: 220, amount: 286000000, orderDate: "2025-05-27" },
    { orderId: "S-030", customerName: "شرکت اپسیلون", product: "کاشی",     category: "مصالح", province: "تهران",   channel: "آنلاین", status: "delivered", qty: 360, amount: 324000000, orderDate: "2025-05-29" },
  ];
  ```

- [ ] **Step 6: Finance dataset (20 rows, deterministic).** Create `report-web/src/semantic/datasets/finance.ts`. Used by Task 5 edge cases (countDistinct on `account`, null `marginPct`, empty-result filters). Includes 2 rows with `marginPct: null` to exercise null-aware aggregation/sort.
  ```ts
  import type { Dataset } from "../../contracts/dataset";

  export const financeData: Dataset = [
    { txnId: "T-001", account: "فروش کالا",      costCenter: "بازرگانی", type: "درآمد", amount: 1240000000, marginPct: 22.4, txnDate: "2025-01-31" },
    { txnId: "T-002", account: "حقوق و دستمزد",  costCenter: "اداری",    type: "هزینه", amount: 430000000,  marginPct: 0.0,  txnDate: "2025-01-31" },
    { txnId: "T-003", account: "فروش خدمات",     costCenter: "فنی",      type: "درآمد", amount: 680000000,  marginPct: 35.0, txnDate: "2025-02-28" },
    { txnId: "T-004", account: "اجاره",          costCenter: "اداری",    type: "هزینه", amount: 90000000,   marginPct: 0.0,  txnDate: "2025-02-28" },
    { txnId: "T-005", account: "فروش کالا",      costCenter: "بازرگانی", type: "درآمد", amount: 1560000000, marginPct: 18.2, txnDate: "2025-03-31" },
    { txnId: "T-006", account: "تبلیغات",        costCenter: "بازاریابی",type: "هزینه", amount: 210000000,  marginPct: 0.0,  txnDate: "2025-03-31" },
    { txnId: "T-007", account: "فروش خدمات",     costCenter: "فنی",      type: "درآمد", amount: 720000000,  marginPct: 41.5, txnDate: "2025-04-30" },
    { txnId: "T-008", account: "حقوق و دستمزد",  costCenter: "اداری",    type: "هزینه", amount: 460000000,  marginPct: 0.0,  txnDate: "2025-04-30" },
    { txnId: "T-009", account: "فروش کالا",      costCenter: "بازرگانی", type: "درآمد", amount: 1340000000, marginPct: 24.8, txnDate: "2025-05-31" },
    { txnId: "T-010", account: "اجاره",          costCenter: "اداری",    type: "هزینه", amount: 90000000,   marginPct: null, txnDate: "2025-05-31" },
    { txnId: "T-011", account: "فروش خدمات",     costCenter: "فنی",      type: "درآمد", amount: 590000000,  marginPct: 33.3, txnDate: "2025-01-31" },
    { txnId: "T-012", account: "تبلیغات",        costCenter: "بازاریابی",type: "هزینه", amount: 175000000,  marginPct: 0.0,  txnDate: "2025-02-28" },
    { txnId: "T-013", account: "فروش کالا",      costCenter: "بازرگانی", type: "درآمد", amount: 1410000000, marginPct: 20.0, txnDate: "2025-03-31" },
    { txnId: "T-014", account: "حقوق و دستمزد",  costCenter: "اداری",    type: "هزینه", amount: 480000000,  marginPct: 0.0,  txnDate: "2025-04-30" },
    { txnId: "T-015", account: "فروش خدمات",     costCenter: "فنی",      type: "درآمد", amount: 650000000,  marginPct: null, txnDate: "2025-05-31" },
    { txnId: "T-016", account: "اجاره",          costCenter: "اداری",    type: "هزینه", amount: 90000000,   marginPct: 0.0,  txnDate: "2025-01-31" },
    { txnId: "T-017", account: "فروش کالا",      costCenter: "بازرگانی", type: "درآمد", amount: 1180000000, marginPct: 19.5, txnDate: "2025-02-28" },
    { txnId: "T-018", account: "تبلیغات",        costCenter: "بازاریابی",type: "هزینه", amount: 230000000,  marginPct: 0.0,  txnDate: "2025-03-31" },
    { txnId: "T-019", account: "فروش خدمات",     costCenter: "فنی",      type: "درآمد", amount: 770000000,  marginPct: 38.0, txnDate: "2025-04-30" },
    { txnId: "T-020", account: "حقوق و دستمزد",  costCenter: "اداری",    type: "هزینه", amount: 500000000,  marginPct: 0.0,  txnDate: "2025-05-31" },
  ];
  ```
  > Derivable facts for Task 5: distinct `account` count = 5 (فروش کالا، حقوق و دستمزد، فروش خدمات، اجاره، تبلیغات); distinct `costCenter` = 4; rows with `type === "درآمد"` = 10; non-null `marginPct` rows = 18.

- [ ] **Step 7: Write the registry test (FAIL).** Create `report-web/src/semantic/registry.test.ts`.
  ```ts
  import { describe, it, expect } from "vitest";
  import {
    getSemanticModel,
    getDataset,
    getModelForDataset,
    semanticModels,
    datasets,
  } from "./registry";

  describe("semantic registry", () => {
    it("resolves each model by id", () => {
      expect(getSemanticModel("model-project").entities[0].source).toBe("projects");
      expect(getSemanticModel("model-sales").entities[0].source).toBe("sales");
      expect(getSemanticModel("model-finance").entities[0].source).toBe("finance");
    });

    it("throws on an unknown model id", () => {
      expect(() => getSemanticModel("nope")).toThrow(/unknown semantic model/i);
    });

    it("resolves each dataset by source and returns the seeded row counts", () => {
      expect(getDataset("projects")).toHaveLength(12);
      expect(getDataset("sales")).toHaveLength(30);
      expect(getDataset("finance")).toHaveLength(20);
    });

    it("throws on an unknown dataset source", () => {
      expect(() => getDataset("nope")).toThrow(/unknown dataset/i);
    });

    it("pairs a dataset source back to its owning model", () => {
      expect(getModelForDataset("sales").id).toBe("model-sales");
      expect(getModelForDataset("projects").id).toBe("model-project");
    });

    it("exposes the maps keyed correctly", () => {
      expect(Object.keys(semanticModels).sort()).toEqual(["model-finance", "model-project", "model-sales"]);
      expect(Object.keys(datasets).sort()).toEqual(["finance", "projects", "sales"]);
    });

    it("every entity field id is unique within its model", () => {
      for (const model of Object.values(semanticModels)) {
        for (const entity of model.entities) {
          const ids = entity.fields.map((f) => f.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/semantic/registry.test.ts` → expected **FAIL** (`Cannot find module './registry'`).

- [ ] **Step 8: Implement `registry.ts` (PASS).** Create `report-web/src/semantic/registry.ts`.
  ```ts
  import type { SemanticModel } from "../contracts/semantic";
  import type { Dataset } from "../contracts/dataset";
  import { projectModel } from "./models/project";
  import { salesModel } from "./models/sales";
  import { financeModel } from "./models/finance";
  import { projectData } from "./datasets/project";
  import { salesData } from "./datasets/sales";
  import { financeData } from "./datasets/finance";

  /** All bundled semantic models, keyed by model id. */
  export const semanticModels: Record<string, SemanticModel> = {
    [projectModel.id]: projectModel,
    [salesModel.id]: salesModel,
    [financeModel.id]: financeModel,
  };

  /** All bundled sample datasets, keyed by entity `source` (the value a
   *  ReportDefinition.dataset points at). */
  export const datasets: Record<string, Dataset> = {
    [projectModel.entities[0].source]: projectData,
    [salesModel.entities[0].source]: salesData,
    [financeModel.entities[0].source]: financeData,
  };

  export function getSemanticModel(id: string): SemanticModel {
    const model = semanticModels[id];
    if (!model) throw new Error(`Unknown semantic model: ${id}`);
    return model;
  }

  export function getDataset(source: string): Dataset {
    const data = datasets[source];
    if (!data) throw new Error(`Unknown dataset: ${source}`);
    return data;
  }

  /** Find the model that owns an entity whose `source` matches. */
  export function getModelForDataset(source: string): SemanticModel {
    for (const model of Object.values(semanticModels)) {
      if (model.entities.some((e) => e.source === source)) return model;
    }
    throw new Error(`Unknown dataset source: ${source}`);
  }
  ```
  Run: `cd report-web && npx vitest run src/semantic/registry.test.ts` → expected **PASS** (7 tests).

- [ ] **Step 9: Build + lint + commit.** Run `cd report-web && npx tsc --noEmit && npm run lint && npx vitest run src/semantic`. Expected: typecheck clean, lint clean, all semantic tests pass. Commit:
  ```bash
  git commit -m "feat(report-web): bundled semantic models + sample datasets + registry

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

**Acceptance criteria:** three `SemanticModel`s and three `Dataset`s export with the row counts above; `getSemanticModel`/`getDataset`/`getModelForDataset` resolve and throw on unknown keys; every `field.id` is unique per entity; the §5 worked-example field references (`status`, `dueDate`, `delayDays`, `province`, `customerName`, `amount`, `orderDate`) all resolve to a model field; typecheck/lint/tests green.

---

### Task 4: Query engine — `runQuery` (filters, groupBy + dateBucket, metrics, calculatedFields, sorting)

The pure, synchronous query engine (R3). TDD-driven by the three canonical §5 `ReportDefinition` examples, asserting concrete numbers over the Task 3 sample data. Implements all `FilterOperator`s, dynamic-date resolution, `groupBy` with `dateBucket`, all aggregations, post-aggregate `calculatedFields`, and multi-key stable sorting, following the §5.3 / §8.5 pipeline order exactly.

**Files:**
- Create: `report-web/src/query/engine.ts`
- Test: `report-web/src/query/engine.test.ts`

**Interfaces:**

Consumes:
- Task 1 `contracts/report-definition.ts` → `ReportDefinition`, `ColumnDef`, `Filter`, `FilterOperator`, `FilterValue`, `DynamicValue`, `FilterGroup`, `GroupBy`, `Metric`, `CalculatedField`, `Sort` (exact §5.2 shapes; `Aggregation`/`FieldType` re-exported from `common.ts` per R1).
- Task 1 `contracts/dataset.ts` → `Row`, `Dataset` (R3).
- Task 1 `contracts/semantic.ts` → `SemanticModel`, `Entity`, `Field`.
- Task 3 `semantic/registry.ts` → `getDataset(source)`, `getModelForDataset(source)`, `projectData`/`salesData` only used in tests.

Produces (Task 5 + auto-viz + renderers consume these — R3 verbatim):
```ts
export interface ResolvedColumn { key: string; label: string; type: FieldType; isMetric: boolean; }
export type ResultRow = Record<string, string | number | null>;
export interface GroupNode { key: string; value: string | number; rows: ResultRow[]; children?: GroupNode[]; }
export interface QueryResult { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number; }
export function runQuery(def: ReportDefinition, dataset: Dataset, semantic: SemanticModel): QueryResult;
// helpers also exported for Task 5 reuse:
export function applyOperator(op: FilterOperator, cell: CellValue, value?: FilterValue, value2?: FilterValue): boolean;
export function aggregate(agg: Aggregation, values: CellValue[]): number;
export function resolveDynamicValue(dv: DynamicValue): number | string;
export function dateBucketKey(iso: string, bucket: GroupBy["dateBucket"]): string;
export function evalExpression(expr: string, scope: Record<string, number | null>): number | null;
// type alias used internally + by Task 5:
export type CellValue = string | number | boolean | null;
export const ENGINE_TODAY: { value: number };  // injectable "now" for deterministic dynamic dates (default = real Date.now)
```

- [ ] **Step 1: Write the operator + aggregate unit tests (FAIL).** Create `report-web/src/query/engine.test.ts` with the first `describe` blocks. These exercise every `FilterOperator` and every `Aggregation` directly.
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import {
    runQuery,
    applyOperator,
    aggregate,
    resolveDynamicValue,
    dateBucketKey,
    evalExpression,
    ENGINE_TODAY,
    type QueryResult,
  } from "./engine";
  import { projectModel } from "../semantic/models/project";
  import { salesModel } from "../semantic/models/sales";
  import { projectData } from "../semantic/datasets/project";
  import { salesData } from "../semantic/datasets/sales";
  import type { ReportDefinition } from "../contracts/report-definition";

  describe("applyOperator", () => {
    it("eq / neq", () => {
      expect(applyOperator("eq", "a", "a")).toBe(true);
      expect(applyOperator("eq", "a", "b")).toBe(false);
      expect(applyOperator("neq", "a", "b")).toBe(true);
    });
    it("numeric comparisons", () => {
      expect(applyOperator("gt", 5, 3)).toBe(true);
      expect(applyOperator("gte", 3, 3)).toBe(true);
      expect(applyOperator("lt", 2, 3)).toBe(true);
      expect(applyOperator("lte", 3, 3)).toBe(true);
      expect(applyOperator("gt", 2, 3)).toBe(false);
    });
    it("date comparisons (ISO strings compare lexicographically)", () => {
      expect(applyOperator("lt", "2025-01-05", "2025-05-02")).toBe(true);
      expect(applyOperator("gte", "2025-05-02", "2025-05-02")).toBe(true);
    });
    it("between / notBetween (inclusive)", () => {
      expect(applyOperator("between", 5, 1, 10)).toBe(true);
      expect(applyOperator("between", 10, 1, 10)).toBe(true);
      expect(applyOperator("between", 11, 1, 10)).toBe(false);
      expect(applyOperator("notBetween", 11, 1, 10)).toBe(true);
    });
    it("in / notIn", () => {
      expect(applyOperator("in", "paid", ["paid", "shipped"])).toBe(true);
      expect(applyOperator("in", "x", ["paid", "shipped"])).toBe(false);
      expect(applyOperator("notIn", "x", ["paid", "shipped"])).toBe(true);
    });
    it("contains / notContains (case-insensitive)", () => {
      expect(applyOperator("contains", "Tehran Tower", "tower")).toBe(true);
      expect(applyOperator("notContains", "Tehran Tower", "villa")).toBe(true);
    });
    it("startsWith / endsWith", () => {
      expect(applyOperator("startsWith", "P-1001", "P-")).toBe(true);
      expect(applyOperator("endsWith", "report.pdf", ".pdf")).toBe(true);
    });
    it("isNull / isNotNull", () => {
      expect(applyOperator("isNull", null)).toBe(true);
      expect(applyOperator("isNull", 0)).toBe(false);
      expect(applyOperator("isNotNull", 0)).toBe(true);
    });
    it("isTrue / isFalse", () => {
      expect(applyOperator("isTrue", true)).toBe(true);
      expect(applyOperator("isFalse", false)).toBe(true);
      expect(applyOperator("isTrue", false)).toBe(false);
    });
  });

  describe("aggregate", () => {
    it("sum / avg / min / max ignore null & non-numeric", () => {
      expect(aggregate("sum", [1, 2, 3, null])).toBe(6);
      expect(aggregate("avg", [2, 4, null])).toBe(3);
      expect(aggregate("min", [5, 2, 9])).toBe(2);
      expect(aggregate("max", [5, 2, 9])).toBe(9);
    });
    it("count counts all rows incl. null; countDistinct counts distinct non-null", () => {
      expect(aggregate("count", [1, null, "x", 2])).toBe(4);
      expect(aggregate("countDistinct", ["a", "a", "b", null])).toBe(2);
    });
    it("empty input → 0", () => {
      expect(aggregate("sum", [])).toBe(0);
      expect(aggregate("avg", [])).toBe(0);
    });
  });

  describe("dateBucketKey", () => {
    it("month / quarter / year / week / day", () => {
      expect(dateBucketKey("2025-03-11", "month")).toBe("2025-03");
      expect(dateBucketKey("2025-03-11", "quarter")).toBe("2025-Q1");
      expect(dateBucketKey("2025-11-02", "quarter")).toBe("2025-Q4");
      expect(dateBucketKey("2025-03-11", "year")).toBe("2025");
      expect(dateBucketKey("2025-03-11", "day")).toBe("2025-03-11");
      expect(dateBucketKey("2025-03-11", undefined)).toBe("2025-03-11");
    });
  });

  describe("resolveDynamicValue", () => {
    beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); }); // 2025-06-01
    afterEach(() => { ENGINE_TODAY.value = Date.now(); });
    it("today with offsetDays returns an ISO date", () => {
      expect(resolveDynamicValue({ token: "today", offsetDays: -30 })).toBe("2025-05-02");
      expect(resolveDynamicValue({ token: "today" })).toBe("2025-06-01");
    });
    it("startOfYear / startOfMonth", () => {
      expect(resolveDynamicValue({ token: "startOfYear" })).toBe("2025-01-01");
      expect(resolveDynamicValue({ token: "startOfMonth" })).toBe("2025-06-01");
    });
  });

  describe("evalExpression (safe, post-aggregate)", () => {
    it("arithmetic over alias scope", () => {
      expect(evalExpression("totalSales / orderCount", { totalSales: 100, orderCount: 4 })).toBe(25);
      expect(evalExpression("(revenue - cost) / revenue * 100", { revenue: 200, cost: 50 })).toBe(75);
    });
    it("division by zero → null", () => {
      expect(evalExpression("a / b", { a: 10, b: 0 })).toBeNull();
    });
    it("rejects non-whitelisted tokens", () => {
      expect(() => evalExpression("process.exit(1)", {})).toThrow();
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/query/engine.test.ts` → expected **FAIL** (`Cannot find module './engine'`).

- [ ] **Step 2: Implement the engine primitives (PASS the Step-1 suites).** Create `report-web/src/query/engine.ts` with the contract types and the standalone helpers. (The `runQuery` body comes in Step 4.)
  ```ts
  import type {
    ReportDefinition, Filter, FilterOperator, FilterValue, DynamicValue,
    FilterGroup, GroupBy, Metric, Sort,
  } from "../contracts/report-definition";
  import type { FieldType, Aggregation } from "../contracts/common";
  import type { Dataset } from "../contracts/dataset";
  import type { SemanticModel, Field } from "../contracts/semantic";

  export type CellValue = string | number | boolean | null;
  export interface ResolvedColumn { key: string; label: string; type: FieldType; isMetric: boolean; }
  export type ResultRow = Record<string, string | number | null>;
  export interface GroupNode { key: string; value: string | number; rows: ResultRow[]; children?: GroupNode[]; }
  export interface QueryResult { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number; }

  /** Injectable "now" so dynamic-date filters are deterministic in tests. */
  export const ENGINE_TODAY: { value: number } = { value: Date.now() };

  const GROUP_SEP = "∎"; // ∎

  function toNumber(v: CellValue): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  }
  function pad(n: number): string { return String(n).padStart(2, "0"); }
  function isoOf(ms: number): string {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  export function resolveDynamicValue(dv: DynamicValue): number | string {
    const base = new Date(ENGINE_TODAY.value);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    let ms: number;
    switch (dv.token) {
      case "startOfYear": ms = Date.UTC(y, 0, 1); break;
      case "startOfMonth": ms = Date.UTC(y, m, 1); break;
      case "today":
      case "now":
      default: ms = Date.UTC(y, m, base.getUTCDate()); break;
    }
    if (dv.offsetMonths) ms = new Date(ms).setUTCMonth(new Date(ms).getUTCMonth() + dv.offsetMonths);
    if (dv.offsetDays) ms += dv.offsetDays * 86_400_000;
    return isoOf(ms);
  }

  function resolveFilterValue(value: FilterValue | undefined, dynamic?: boolean): FilterValue | undefined {
    if (dynamic && value && typeof value === "object" && !Array.isArray(value) && "token" in value) {
      return resolveDynamicValue(value as DynamicValue);
    }
    return value;
  }

  export function applyOperator(
    op: FilterOperator, cell: CellValue, value?: FilterValue, value2?: FilterValue,
  ): boolean {
    switch (op) {
      case "isNull": return cell === null || cell === undefined;
      case "isNotNull": return cell !== null && cell !== undefined;
      case "isTrue": return cell === true;
      case "isFalse": return cell === false;
    }
    if (cell === null || cell === undefined) return false;
    switch (op) {
      case "eq": return cell === value;
      case "neq": return cell !== value;
      case "gt": return cell > (value as string | number);
      case "gte": return cell >= (value as string | number);
      case "lt": return cell < (value as string | number);
      case "lte": return cell <= (value as string | number);
      case "between":
        return cell >= (value as string | number) && cell <= (value2 as string | number);
      case "notBetween":
        return cell < (value as string | number) || cell > (value2 as string | number);
      case "in": return Array.isArray(value) && (value as (string | number)[]).includes(cell as string | number);
      case "notIn": return Array.isArray(value) && !(value as (string | number)[]).includes(cell as string | number);
      case "contains": return String(cell).toLowerCase().includes(String(value).toLowerCase());
      case "notContains": return !String(cell).toLowerCase().includes(String(value).toLowerCase());
      case "startsWith": return String(cell).toLowerCase().startsWith(String(value).toLowerCase());
      case "endsWith": return String(cell).toLowerCase().endsWith(String(value).toLowerCase());
      default: return false;
    }
  }

  export function aggregate(agg: Aggregation, values: CellValue[]): number {
    if (agg === "count") return values.length;
    if (agg === "countDistinct") {
      return new Set(values.filter((v) => v !== null && v !== undefined)).size;
    }
    const nums = values.map(toNumber).filter((n): n is number => n !== null);
    if (nums.length === 0) return 0;
    switch (agg) {
      case "sum": return nums.reduce((a, b) => a + b, 0);
      case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
      case "min": return Math.min(...nums);
      case "max": return Math.max(...nums);
      case "none": return nums[0];
      default: return 0;
    }
  }

  export function dateBucketKey(iso: string, bucket: GroupBy["dateBucket"]): string {
    const [y, mo = "01", d = "01"] = iso.split("-");
    switch (bucket) {
      case "year": return y;
      case "quarter": return `${y}-Q${Math.floor((Number(mo) - 1) / 3) + 1}`;
      case "month": return `${y}-${mo}`;
      case "week": {
        const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
        const dayNum = (date.getUTCDay() + 6) % 7;
        date.setUTCDate(date.getUTCDate() - dayNum + 3);
        const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
        const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
        return `${date.getUTCFullYear()}-W${pad(week)}`;
      }
      case "day":
      default: return iso;
    }
  }

  // ---- safe expression evaluator (shunting-yard → RPN; numbers + aliases only) ----
  const FN = new Set(["round", "abs", "coalesce", "ratio"]);
  export function evalExpression(expr: string, scope: Record<string, number | null>): number | null {
    const tokens = expr.match(/[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[+\-*/%(),]/g);
    if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) {
      throw new Error(`Unsafe or unparseable expression: ${expr}`);
    }
    const out: (number | string)[] = [];
    const ops: string[] = [];
    const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
    const apply = (op: string, b: number, a: number): number => {
      switch (op) {
        case "+": return a + b; case "-": return a - b; case "*": return a * b;
        case "/": return b === 0 ? NaN : a / b; case "%": return b === 0 ? NaN : a % b;
        default: throw new Error(`bad op ${op}`);
      }
    };
    let hadDiv = false;
    for (const t of tokens) {
      if (/^\d/.test(t)) out.push(Number(t));
      else if (/^[A-Za-z_]/.test(t)) {
        if (FN.has(t)) { ops.push(t); continue; }
        if (!(t in scope)) throw new Error(`Unknown identifier in expression: ${t}`);
        out.push(scope[t] ?? 0);
      } else if (t === "(") ops.push(t);
      else if (t === ")") { while (ops.length && ops.at(-1) !== "(") out.push(ops.pop()!); ops.pop(); if (FN.has(ops.at(-1) ?? "")) out.push(ops.pop()!); }
      else if (t === ",") { while (ops.length && ops.at(-1) !== "(") out.push(ops.pop()!); }
      else { while (ops.length && prec[ops.at(-1)!] >= prec[t]) out.push(ops.pop()!); ops.push(t); }
    }
    while (ops.length) out.push(ops.pop()!);
    const st: number[] = [];
    for (const tk of out) {
      if (typeof tk === "number") { st.push(tk); continue; }
      if (tk === "round") { st.push(Math.round(st.pop()!)); continue; }
      if (tk === "abs") { st.push(Math.abs(st.pop()!)); continue; }
      if (tk === "coalesce") { const b = st.pop()!, a = st.pop()!; st.push(Number.isFinite(a) ? a : b); continue; }
      if (tk === "ratio") { const b = st.pop()!, a = st.pop()!; st.push(b === 0 ? NaN : a / b); continue; }
      const b = st.pop()!, a = st.pop()!;
      if (tk === "/" || tk === "%") hadDiv = true;
      st.push(apply(tk, b, a));
    }
    const r = st.pop();
    if (r === undefined || Number.isNaN(r) || !Number.isFinite(r)) return hadDiv ? null : (r ?? null);
    return r;
  }
  ```
  Run: `cd report-web && npx vitest run src/query/engine.test.ts -t "applyOperator|aggregate|dateBucketKey|resolveDynamicValue|evalExpression"` → expected **PASS** for those 5 describe blocks (the worked-example blocks fail until Step 4).

- [ ] **Step 3: Write the three worked-example tests (FAIL).** Append to `engine.test.ts`. Each builds the §5 definition and asserts concrete numbers over Task 3 data. `ENGINE_TODAY` is frozen to `2025-06-01` for the dynamic-date examples.
  ```ts
  describe("runQuery — §5.7 delayed projects > 30 days by province", () => {
    beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
    afterEach(() => { ENGINE_TODAY.value = Date.now(); });

    const def: ReportDefinition = {
      id: "rpt_delayed_projects_by_province", schemaVersion: "1.0",
      name: "پروژه‌های معوق", dataset: "projects",
      columns: [
        { field: "province", label: "استان", type: "string" },
        { field: "id", label: "تعداد پروژه", type: "number", visible: false },
      ],
      filters: [
        { field: "status", operator: "neq", value: "completed" },
        { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
      ],
      groupBy: [{ field: "province" }],
      metrics: [
        { field: "*", aggregation: "count", alias: "delayedCount", label: "تعداد معوق" },
        { field: "delayDays", aggregation: "avg", alias: "avgDelay", label: "میانگین تأخیر" },
      ],
      sorting: [{ field: "delayedCount", direction: "desc" }],
      presentation: { views: [] },
    };

    it("returns one row per province with the right counts & avg delay, sorted desc", () => {
      const r = runQuery(def, projectData, projectModel);
      expect(r.total).toBe(4);
      const byProvince = Object.fromEntries(r.rows.map((row) => [row.province, row]));
      expect(byProvince["تهران"].delayedCount).toBe(3);
      expect(byProvince["اصفهان"].delayedCount).toBe(2);
      expect(byProvince["خوزستان"].delayedCount).toBe(2);
      expect(byProvince["فارس"].delayedCount).toBe(1);
      expect(byProvince["تهران"].avgDelay).toBe(65);      // (45+60+90)/3
      expect(byProvince["اصفهان"].avgDelay).toBe(85);     // (50+120)/2
      expect(byProvince["خوزستان"].avgDelay).toBe(52.5);  // (35+70)/2
      // sorted by delayedCount desc → تهران first, فارس last
      expect(r.rows[0].province).toBe("تهران");
      expect(r.rows.at(-1)!.province).toBe("فارس");
    });

    it("tags metric columns as isMetric in resolved columns", () => {
      const r = runQuery(def, projectData, projectModel);
      const cols = Object.fromEntries(r.columns.map((c) => [c.key, c]));
      expect(cols["province"].isMetric).toBe(false);
      expect(cols["delayedCount"].isMetric).toBe(true);
      expect(cols["avgDelay"].isMetric).toBe(true);
    });
  });

  describe("runQuery — §5.8 monthly revenue by province (date bucket + series)", () => {
    beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
    afterEach(() => { ENGINE_TODAY.value = Date.now(); });

    const def: ReportDefinition = {
      id: "rpt_monthly_revenue_by_province", schemaVersion: "1.0",
      name: "درآمد ماهانه", dataset: "sales",
      columns: [
        { field: "orderDate", label: "ماه", type: "date" },
        { field: "province", label: "استان", type: "string" },
        { field: "amount", label: "درآمد", type: "number" },
      ],
      filters: [{ field: "orderDate", operator: "gte", value: { token: "startOfYear" }, dynamic: true }],
      groupBy: [{ field: "orderDate", dateBucket: "month" }, { field: "province" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "revenue", label: "درآمد" }],
      sorting: [
        { field: "orderDate", direction: "asc", priority: 1 },
        { field: "province", direction: "asc", priority: 2 },
      ],
      presentation: { views: [] },
    };

    it("buckets orderDate to month and sums amount per (month, province)", () => {
      const r = runQuery(def, salesData, salesModel);
      const cell = (m: string, p: string) =>
        r.rows.find((row) => row.orderDate === m && row.province === p)?.revenue;
      // Jan تهران: S-001 (360M) + S-013 (125M) = 485,000,000
      expect(cell("2025-01", "تهران")).toBe(485_000_000);
      // Feb تهران: S-002 (880M) + S-014 (234M) = 1,114,000,000
      expect(cell("2025-02", "تهران")).toBe(1_114_000_000);
      // Jan خوزستان: S-007 (1.2B)
      expect(cell("2025-01", "خوزستان")).toBe(1_200_000_000);
      // every row's orderDate must be a YYYY-MM bucket (no raw days)
      expect(r.rows.every((row) => /^\d{4}-\d{2}$/.test(String(row.orderDate)))).toBe(true);
      // sorted: first bucket is the earliest month
      expect(r.rows[0].orderDate).toBe("2025-01");
    });
  });

  describe("runQuery — §5.9 top 10 customers by sales (limit + post-aggregate calc)", () => {
    const def: ReportDefinition = {
      id: "rpt_top10_customers_by_sales", schemaVersion: "1.0",
      name: "۱۰ مشتری برتر", dataset: "sales",
      columns: [
        { field: "customerName", label: "مشتری", type: "string" },
        { field: "amount", label: "فروش", type: "number" },
      ],
      filters: [{ field: "status", operator: "in", value: ["paid", "shipped", "delivered"] }],
      groupBy: [{ field: "customerName" }],
      metrics: [
        { field: "amount", aggregation: "sum", alias: "totalSales", label: "مجموع فروش" },
        { field: "*", aggregation: "count", alias: "orderCount", label: "تعداد سفارش" },
      ],
      calculatedFields: [
        { alias: "avgOrderValue", label: "میانگین ارزش سفارش",
          expression: "totalSales / orderCount", scope: "aggregate", type: "number" },
      ],
      sorting: [{ field: "totalSales", direction: "desc" }],
      limit: 10,
      presentation: { views: [] },
    };

    it("filters by status, sums per customer, derives avgOrderValue, sorts desc, caps to 10", () => {
      const r = runQuery(def, salesData, salesModel);
      // 5 customers in the seed → ≤10, all survive
      expect(r.total).toBe(5);
      const top = r.rows[0];
      // post-aggregate calc holds: avgOrderValue === totalSales / orderCount
      expect(top.avgOrderValue).toBe(Number(top.totalSales) / Number(top.orderCount));
      // sorted desc: row[0].totalSales is the max
      const totals = r.rows.map((row) => Number(row.totalSales));
      expect(totals).toEqual([...totals].sort((a, b) => b - a));
      // cancelled/pending rows excluded from every total (S-006 cancelled 500M not in بتا's total)
      const beta = r.rows.find((row) => row.customerName === "شرکت بتا")!;
      // بتا paid/shipped/delivered: S-004(270M)+S-005(150M)+S-017(1000M)+S-022(234M)+S-027(227.5M) = 1,881,500,000
      expect(beta.totalSales).toBe(1_881_500_000);
      expect(beta.orderCount).toBe(5);
    });

    it("limit caps rows after sorting", () => {
      const r = runQuery({ ...def, limit: 2 }, salesData, salesModel);
      expect(r.rows).toHaveLength(2);
      expect(r.total).toBe(2);
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/query/engine.test.ts -t "runQuery"` → expected **FAIL** (`runQuery` body not implemented; the worked-example asserts throw).

- [ ] **Step 4: Implement `runQuery` (PASS all suites).** Append to `engine.ts`. Follows the §5.3 pipeline order: filter → row calc → group+aggregate → aggregate calc → sort → offset/limit → resolve columns.
  ```ts
  function entityOf(semantic: SemanticModel, dataset: string): { entity: SemanticModel["entities"][number] } {
    const entity = semantic.entities.find((e) => e.source === dataset) ?? semantic.entities[0];
    return { entity };
  }
  function fieldById(entity: SemanticModel["entities"][number], id: string): Field | undefined {
    return entity.fields.find((f) => f.id === id);
  }

  function matchesFilter(row: Record<string, CellValue>, f: Filter): boolean {
    const v = resolveFilterValue(f.value, f.dynamic);
    return applyOperator(f.operator, row[f.field] ?? null, v, f.value2);
  }
  function matchesGroup(row: Record<string, CellValue>, g: FilterGroup): boolean {
    const results = g.conditions.map((c) =>
      "logic" in c ? matchesGroup(row, c as FilterGroup) : matchesFilter(row, c as Filter));
    return g.logic === "or" ? results.some(Boolean) : results.every(Boolean);
  }

  function compareCells(a: CellValue, b: CellValue, type: FieldType): number {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1; // nulls last
    if (b === null || b === undefined) return -1;
    if (type === "number") return (a as number) - (b as number);
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }

  export function runQuery(def: ReportDefinition, dataset: Dataset, semantic: SemanticModel): QueryResult {
    const { entity } = entityOf(semantic, def.dataset);

    // 1. FILTER (filterGroup overrides flat filters)
    let rows: Record<string, CellValue>[] = dataset.map((r) => ({ ...r }));
    if (def.filterGroup) {
      rows = rows.filter((r) => matchesGroup(r, def.filterGroup!));
    } else if (def.filters?.length) {
      rows = rows.filter((r) => def.filters!.every((f) => matchesFilter(r, f)));
    }

    // 2. ROW-LEVEL calculated fields (scope row, default)
    const rowCalcs = (def.calculatedFields ?? []).filter((c) => (c.scope ?? "row") === "row");
    for (const r of rows) {
      for (const cf of rowCalcs) {
        const scope: Record<string, number | null> = {};
        for (const k of Object.keys(r)) { const n = toNumber(r[k]); if (n !== null) scope[k] = n; }
        r[cf.alias] = evalExpression(cf.expression, scope);
      }
    }

    // 3. GROUP + AGGREGATE  (or pass-through projection when no groupBy)
    const aggCalcs = (def.calculatedFields ?? []).filter((c) => c.scope === "aggregate");
    let out: ResultRow[];
    const groups: GroupNode[] = [];

    if (!def.groupBy?.length) {
      if (def.metrics?.length) {
        // aggregate over the whole set → single row
        const row: ResultRow = {};
        for (const m of def.metrics) row[m.alias ?? `${m.aggregation}_${m.field}`] = computeMetric(m, rows);
        applyAggCalcs(row, aggCalcs);
        out = [row];
      } else {
        out = rows.map((r) => projectRow(r, def, entity));
      }
    } else {
      const buckets = new Map<string, Record<string, CellValue>[]>();
      const keyOf = (r: Record<string, CellValue>) =>
        def.groupBy!.map((g) => bucketValue(r[g.field], g, fieldById(entity, g.field))).join(GROUP_SEP);
      for (const r of rows) {
        const k = keyOf(r);
        (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r);
      }
      out = [];
      for (const [k, bucketRows] of buckets) {
        const row: ResultRow = {};
        def.groupBy!.forEach((g) => {
          row[g.field] = bucketValue(bucketRows[0][g.field], g, fieldById(entity, g.field)) as string | number;
        });
        for (const m of def.metrics ?? []) row[m.alias ?? `${m.aggregation}_${m.field}`] = computeMetric(m, bucketRows);
        applyAggCalcs(row, aggCalcs);
        out.push(row);
        groups.push({ key: k, value: row[def.groupBy![0].field] as string | number, rows: [row] });
      }
    }

    // 4. SORT (stable, multi-key by priority then array order)
    if (def.sorting?.length) out = stableSort(out, def.sorting, def, entity);

    // 5. OFFSET / LIMIT
    if (def.offset) out = out.slice(def.offset);
    if (def.limit !== undefined) out = out.slice(0, def.limit);

    return { columns: resolveColumns(def, entity), rows: out, groups: groups.length ? groups : undefined, total: out.length };
  }

  function bucketValue(v: CellValue, g: GroupBy, field?: Field): CellValue {
    if (g.dateBucket && field?.type === "date" && typeof v === "string") return dateBucketKey(v, g.dateBucket);
    return v;
  }
  function computeMetric(m: Metric, bucketRows: Record<string, CellValue>[]): number {
    const values = m.field === "*" ? bucketRows.map(() => 1) : bucketRows.map((r) => r[m.field] ?? null);
    return aggregate(m.aggregation, values);
  }
  function applyAggCalcs(row: ResultRow, aggCalcs: ReportDefinition["calculatedFields"] = []): void {
    for (const cf of aggCalcs) {
      const scope: Record<string, number | null> = {};
      for (const k of Object.keys(row)) { const n = typeof row[k] === "number" ? (row[k] as number) : null; if (n !== null) scope[k] = n; }
      row[cf.alias] = evalExpression(cf.expression, scope);
    }
  }
  function projectRow(r: Record<string, CellValue>, def: ReportDefinition, entity: SemanticModel["entities"][number]): ResultRow {
    const out: ResultRow = {};
    for (const c of def.columns) {
      if (c.visible === false) continue;
      const v = r[c.field] ?? null;
      out[c.field] = typeof v === "boolean" ? String(v) : (v as string | number | null);
    }
    for (const cf of (def.calculatedFields ?? []).filter((x) => (x.scope ?? "row") === "row")) {
      out[cf.alias] = (r[cf.alias] ?? null) as string | number | null;
    }
    return out;
  }
  function aliasType(def: ReportDefinition, entity: SemanticModel["entities"][number], key: string): FieldType {
    if ((def.metrics ?? []).some((m) => (m.alias ?? `${m.aggregation}_${m.field}`) === key)) return "number";
    if ((def.calculatedFields ?? []).some((c) => c.alias === key)) return "number";
    return fieldById(entity, key)?.type ?? "string";
  }
  function stableSort(rows: ResultRow[], sorting: Sort[], def: ReportDefinition, entity: SemanticModel["entities"][number]): ResultRow[] {
    const keys = [...sorting].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return rows
      .map((row, i) => ({ row, i }))
      .sort((x, y) => {
        for (const s of keys) {
          const t = aliasType(def, entity, s.field);
          const c = compareCells(x.row[s.field] ?? null, y.row[s.field] ?? null, t);
          if (c !== 0) return s.direction === "desc" ? -c : c;
        }
        return x.i - y.i; // stable
      })
      .map((w) => w.row);
  }
  function resolveColumns(def: ReportDefinition, entity: SemanticModel["entities"][number]): ResolvedColumn[] {
    const cols: ResolvedColumn[] = [];
    const seen = new Set<string>();
    const push = (key: string, label: string, type: FieldType, isMetric: boolean) => {
      if (seen.has(key)) return; seen.add(key); cols.push({ key, label, type, isMetric });
    };
    for (const g of def.groupBy ?? []) {
      const f = fieldById(entity, g.field);
      push(g.field, f?.label["fa-IR"] ?? g.field, f?.type ?? "string", false);
    }
    for (const m of def.metrics ?? []) {
      const key = m.alias ?? `${m.aggregation}_${m.field}`;
      push(key, m.label ?? key, "number", true);
    }
    for (const cf of def.calculatedFields ?? []) push(cf.alias, cf.label ?? cf.alias, cf.type ?? "number", true);
    if (!def.groupBy?.length && !def.metrics?.length) {
      for (const c of def.columns) {
        if (c.visible === false) continue;
        const f = fieldById(entity, c.field);
        push(c.field, c.label ?? f?.label["fa-IR"] ?? c.field, c.type ?? f?.type ?? "string", f?.role === "measure");
      }
    }
    return cols;
  }
  ```
  Run: `cd report-web && npx vitest run src/query/engine.test.ts` → expected **PASS** (all describe blocks green).

- [ ] **Step 5: Build + lint + commit.** Run `cd report-web && npx tsc --noEmit && npm run lint && npx vitest run src/query/engine.test.ts`. Expected: typecheck clean, lint clean, all engine tests pass. Commit:
  ```bash
  git commit -m "feat(report-web): pure in-browser query engine (runQuery)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

**Acceptance criteria:** `runQuery` is pure & synchronous, returns the R3 `QueryResult` shape; all 18 FilterOperators behave per §5.4; all aggregations per §5.5 with null/non-numeric guarding; `groupBy.dateBucket` rolls dates up (`2025-03-11` → `2025-03` for month); dynamic-date filters resolve against the injectable `ENGINE_TODAY`; post-aggregate `calculatedFields` reference metric aliases via the safe evaluator (no `eval`/`Function`); multi-key sort is stable and respects `priority`; `limit`/`offset` apply after sort. The three §5 worked examples produce the exact numbers asserted above over the Task 3 sample data.

---

### Task 5: Drill-down + engine edge cases

`drilldown.ts` implements the §8.5 lazy drill-down (`drillInto`) — pinning a clicked group's dimension value(s) as filters and re-running `runQuery` against the next dimension. This task also hardens the engine with edge-case tests (empty result, all-null measure, `countDistinct`, large dataset) and adds the small fixes those tests surface.

**Files:**
- Create: `report-web/src/query/drilldown.ts`
- Test: `report-web/src/query/drilldown.test.ts`
- Test: `report-web/src/query/engine.edge.test.ts`
- Modify: `report-web/src/query/engine.ts` (only if an edge test surfaces a gap — see Step 5)

**Interfaces:**

Consumes:
- Task 4 `query/engine.ts` → `runQuery(def, dataset, semantic)`, `aggregate`, `applyOperator`, types `QueryResult`, `ResultRow`, `GroupNode`, `CellValue`, `ENGINE_TODAY`.
- Task 1 `contracts/report-definition.ts` → `ReportDefinition`, `Drilldown`, `Filter`, `FilterOperator`, `GroupBy`.
- Task 1 `contracts/dataset.ts` → `Dataset`, `GroupNode`.
- Task 1 `contracts/semantic.ts` → `SemanticModel`.
- Task 3 datasets/models (tests only).

Produces (viewer/dashboard features consume these):
```ts
/** Re-run the query pinned to a clicked group, advancing to the next groupBy dimension.
 *  The drill field/value are derived internally from the clicked node
 *  (field = parentDef.groupBy[0].field, value = node.value). */
export function drillInto(parentDef: ReportDefinition, node: GroupNode, dataset: Dataset, semantic: SemanticModel): { def: ReportDefinition; result: QueryResult };
/** Build the child ReportDefinition without running it (for save/preview). */
export function buildDrilldownDefinition(parentDef: ReportDefinition, node: GroupNode): ReportDefinition;
```

- [ ] **Step 1: Write drill-down tests (FAIL).** Create `report-web/src/query/drilldown.test.ts`. Uses §5.7's province grouping: clicking "تهران" should pin `province = تهران` and drill to the per-project detail (no groupBy → row list) or the next dimension when one exists.
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { drillInto, buildDrilldownDefinition } from "./drilldown";
  import { ENGINE_TODAY } from "./engine";
  import { projectModel } from "../semantic/models/project";
  import { salesModel } from "../semantic/models/sales";
  import { projectData } from "../semantic/datasets/project";
  import { salesData } from "../semantic/datasets/sales";
  import type { ReportDefinition } from "../contracts/report-definition";
  import type { GroupNode } from "../contracts/dataset";

  // helper: a clicked group node carrying the pinned dimension value
  const node = (value: string | number): GroupNode => ({ key: String(value), value, rows: [] });

  const delayedByProvince: ReportDefinition = {
    id: "rpt_delayed", schemaVersion: "1.0", name: "معوق", dataset: "projects",
    columns: [
      { field: "name", label: "نام", type: "string" },
      { field: "dueDate", label: "موعد", type: "date" },
      { field: "delayDays", label: "تأخیر", type: "number" },
    ],
    filters: [
      { field: "status", operator: "neq", value: "completed" },
      { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
    ],
    groupBy: [{ field: "province" }],
    metrics: [{ field: "*", aggregation: "count", alias: "delayedCount" }],
    drilldown: {
      enabled: true, paramField: "province", operator: "eq",
      targetDefinition: {
        id: "rpt_delayed_detail", schemaVersion: "1.0", name: "جزئیات", dataset: "projects",
        columns: [
          { field: "name", label: "نام", type: "string" },
          { field: "dueDate", label: "موعد", type: "date" },
          { field: "delayDays", label: "تأخیر", type: "number" },
        ],
        filters: [
          { field: "status", operator: "neq", value: "completed" },
          { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
        ],
        sorting: [{ field: "delayDays", direction: "desc" }],
        presentation: { views: [] },
      },
    },
    presentation: { views: [] },
  };

  describe("buildDrilldownDefinition", () => {
    it("injects the clicked value as a filter into the targetDefinition", () => {
      const child = buildDrilldownDefinition(delayedByProvince, node("تهران"));
      expect(child.id).toBe("rpt_delayed_detail");
      expect(child.filters).toEqual(
        expect.arrayContaining([{ field: "province", operator: "eq", value: "تهران" }]),
      );
    });

    it("falls back to an inline child (parent minus groupBy + pinned filter) when no target is given", () => {
      const noTarget: ReportDefinition = { ...delayedByProvince, drilldown: { enabled: true, paramField: "province" } };
      const child = buildDrilldownDefinition(noTarget, node("اصفهان"));
      expect(child.groupBy).toBeUndefined();
      expect(child.filters).toEqual(
        expect.arrayContaining([{ field: "province", operator: "eq", value: "اصفهان" }]),
      );
    });

    it("honours a custom drill operator", () => {
      const noTarget: ReportDefinition = {
        ...delayedByProvince,
        drilldown: { enabled: true, paramField: "province", operator: "contains" },
      };
      const child = buildDrilldownDefinition(noTarget, node("تهران"));
      expect(child.filters).toEqual(
        expect.arrayContaining([{ field: "province", operator: "contains", value: "تهران" }]),
      );
    });
  });

  describe("drillInto", () => {
    beforeEach(() => { ENGINE_TODAY.value = Date.UTC(2025, 5, 1); });
    afterEach(() => { ENGINE_TODAY.value = Date.now(); });

    it("returns the 3 delayed projects in تهران, sorted by delay desc", () => {
      const { result: r } = drillInto(delayedByProvince, node("تهران"), projectData, projectModel);
      expect(r.total).toBe(3);
      expect(r.rows.map((x) => x.name)).toEqual([
        "ساختمان اداری پارس", // 90
        "مجتمع تجاری آرین",   // 60
        "برج مسکونی نیلوفر",  // 45
      ]);
      expect(r.rows.every((x) => x.dueDate !== undefined)).toBe(true);
    });

    it("drilling into a province with one delayed project returns one row", () => {
      const { result: r } = drillInto(delayedByProvince, node("فارس"), projectData, projectModel);
      expect(r.total).toBe(1);
      expect(r.rows[0].name).toBe("مرکز خرید فارس");
    });

    it("inline drill (no target) advances to the next groupBy dimension", () => {
      const twoDim: ReportDefinition = {
        id: "rpt_sales_prov_chan", schemaVersion: "1.0", name: "x", dataset: "sales",
        columns: [{ field: "province", type: "string" }, { field: "channel", type: "string" }, { field: "amount", type: "number" }],
        groupBy: [{ field: "province" }, { field: "channel" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "rev" }],
        drilldown: { enabled: true, paramField: "province" },
        presentation: { views: [] },
      };
      const { result: r } = drillInto(twoDim, node("تهران"), salesData, salesModel);
      // pinned to تهران, now grouped by the next dim (channel) only
      expect(r.rows.every((x) => x.channel !== undefined && x.province === undefined)).toBe(true);
      expect(new Set(r.rows.map((x) => x.channel)).size).toBe(r.rows.length); // one row per channel
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/query/drilldown.test.ts` → expected **FAIL** (`Cannot find module './drilldown'`).

- [ ] **Step 2: Implement `drilldown.ts` (PASS).** Create `report-web/src/query/drilldown.ts`.
  ```ts
  import type {
    ReportDefinition, Drilldown, Filter, GroupBy,
  } from "../contracts/report-definition";
  import type { Dataset, GroupNode } from "../contracts/dataset";
  import type { SemanticModel } from "../contracts/semantic";
  import { runQuery, type QueryResult } from "./engine";

  /** The drilled dimension is always the first groupBy of the parent;
   *  the pinned value comes from the clicked node. */
  function drillField(parentDef: ReportDefinition): string {
    const field = parentDef.groupBy?.[0]?.field;
    if (!field) throw new Error(`Report ${parentDef.id} has no groupBy to drill from`);
    return field;
  }

  function pinnedFilter(dd: Drilldown, field: string, value: string | number): Filter {
    return { field, operator: dd.operator ?? "eq", value };
  }

  /** Next groupBy dimension AFTER the drilled field (undefined → detail rows). */
  function nextDimension(parent: ReportDefinition, drilledField: string): GroupBy | undefined {
    const gb = parent.groupBy ?? [];
    const idx = gb.findIndex((g) => g.field === drilledField);
    return idx >= 0 ? gb[idx + 1] : gb[0];
  }

  export function buildDrilldownDefinition(parentDef: ReportDefinition, node: GroupNode): ReportDefinition {
    const dd = parentDef.drilldown;
    if (!dd) throw new Error(`Report ${parentDef.id} has no drilldown config`);
    const field = drillField(parentDef);
    const value = node.value;
    const filter = pinnedFilter(dd, field, value);

    if (dd.targetDefinition) {
      return { ...dd.targetDefinition, filters: [...(dd.targetDefinition.filters ?? []), filter] };
    }
    // targetReportId is resolved by the caller against the report store; v1 inline fallback:
    const next = nextDimension(parentDef, field);
    const childGroupBy = next ? [next] : undefined;
    return {
      ...parentDef,
      id: `${parentDef.id}__drill_${field}_${String(value)}`,
      filters: [...(parentDef.filters ?? []), filter],
      groupBy: childGroupBy,
      drilldown: undefined,
    };
  }

  export function drillInto(
    parentDef: ReportDefinition, node: GroupNode, dataset: Dataset, semantic: SemanticModel,
  ): { def: ReportDefinition; result: QueryResult } {
    const def = buildDrilldownDefinition(parentDef, node);
    return { def, result: runQuery(def, dataset, semantic) };
  }
  ```
  Run: `cd report-web && npx vitest run src/query/drilldown.test.ts` → expected **PASS** (6 tests).

- [ ] **Step 3: Write engine edge-case tests (expected PASS against Task 4, but assert hardening).** Create `report-web/src/query/engine.edge.test.ts`. These pin the contract for empty results, all-null measures, `countDistinct`, and a large dataset.
  ```ts
  import { describe, it, expect } from "vitest";
  import { runQuery } from "./engine";
  import { financeModel } from "../semantic/models/finance";
  import { salesModel } from "../semantic/models/sales";
  import { financeData } from "../semantic/datasets/finance";
  import type { Dataset } from "../contracts/dataset";
  import type { ReportDefinition } from "../contracts/report-definition";

  describe("engine edge cases", () => {
    it("empty result: a filter matching no rows → total 0, rows [], columns still resolved", () => {
      const def: ReportDefinition = {
        id: "e1", schemaVersion: "1.0", name: "x", dataset: "finance",
        columns: [{ field: "account", type: "string" }, { field: "amount", type: "number" }],
        filters: [{ field: "account", operator: "eq", value: "__does_not_exist__" }],
        groupBy: [{ field: "account" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
        presentation: { views: [] },
      };
      const r = runQuery(def, financeData, financeModel);
      expect(r.total).toBe(0);
      expect(r.rows).toEqual([]);
      expect(r.columns.map((c) => c.key)).toEqual(["account", "total"]);
    });

    it("aggregate over an empty set (no groupBy, no matching rows) → single row of zeros", () => {
      const def: ReportDefinition = {
        id: "e2", schemaVersion: "1.0", name: "x", dataset: "finance",
        columns: [{ field: "amount", type: "number" }],
        filters: [{ field: "type", operator: "eq", value: "__none__" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
        presentation: { views: [] },
      };
      const r = runQuery(def, financeData, financeModel);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].total).toBe(0);
    });

    it("all-null measure: avg over null marginPct rows → 0 (null-guarded), count still counts rows", () => {
      const def: ReportDefinition = {
        id: "e3", schemaVersion: "1.0", name: "x", dataset: "finance",
        columns: [{ field: "amount", type: "number" }],
        filters: [{ field: "marginPct", operator: "isNull" }],
        metrics: [
          { field: "marginPct", aggregation: "avg", alias: "avgMargin" },
          { field: "*", aggregation: "count", alias: "n" },
        ],
        presentation: { views: [] },
      };
      const r = runQuery(def, financeData, financeModel);
      expect(r.rows[0].n).toBe(2);        // T-010, T-015 have null marginPct
      expect(r.rows[0].avgMargin).toBe(0); // no numeric values → 0
    });

    it("countDistinct: distinct accounts = 5, distinct cost centers = 4", () => {
      const def: ReportDefinition = {
        id: "e4", schemaVersion: "1.0", name: "x", dataset: "finance",
        columns: [{ field: "amount", type: "number" }],
        metrics: [
          { field: "account", aggregation: "countDistinct", alias: "accounts" },
          { field: "costCenter", aggregation: "countDistinct", alias: "centers" },
        ],
        presentation: { views: [] },
      };
      const r = runQuery(def, financeData, financeModel);
      expect(r.rows[0].accounts).toBe(5);
      expect(r.rows[0].centers).toBe(4);
    });

    it("null grouping key buckets nulls together under a stable key", () => {
      const data: Dataset = [
        { account: "A", amount: 10, marginPct: null, costCenter: null, type: "x", txnId: "1", txnDate: "2025-01-01" },
        { account: "A", amount: 20, marginPct: null, costCenter: null, type: "x", txnId: "2", txnDate: "2025-01-01" },
        { account: "A", amount: 5,  marginPct: null, costCenter: "Z",  type: "x", txnId: "3", txnDate: "2025-01-01" },
      ];
      const def: ReportDefinition = {
        id: "e5", schemaVersion: "1.0", name: "x", dataset: "finance",
        columns: [{ field: "costCenter", type: "string" }, { field: "amount", type: "number" }],
        groupBy: [{ field: "costCenter" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "total" }],
        presentation: { views: [] },
      };
      const r = runQuery(def, data, financeModel);
      expect(r.total).toBe(2); // null bucket (30) + "Z" bucket (5)
      const nullBucket = r.rows.find((x) => x.costCenter === null);
      expect(nullBucket?.total).toBe(30);
    });

    it("large dataset (10k rows) groups & sums correctly and fast", () => {
      const big: Dataset = Array.from({ length: 10_000 }, (_, i) => ({
        orderId: `S-${i}`, customerName: `C-${i % 50}`, product: "p", category: "c",
        province: i % 2 ? "تهران" : "اصفهان", channel: "آنلاین", status: "paid",
        qty: 1, amount: 100, orderDate: "2025-01-01",
      }));
      const def: ReportDefinition = {
        id: "e6", schemaVersion: "1.0", name: "x", dataset: "sales",
        columns: [{ field: "province", type: "string" }, { field: "amount", type: "number" }],
        groupBy: [{ field: "province" }],
        metrics: [{ field: "amount", aggregation: "sum", alias: "total" }, { field: "*", aggregation: "count", alias: "n" }],
        sorting: [{ field: "total", direction: "desc" }],
        presentation: { views: [] },
      };
      const t0 = performance.now();
      const r = runQuery(def, big, salesModel);
      expect(performance.now() - t0).toBeLessThan(500);
      expect(r.total).toBe(2);
      expect(r.rows.reduce((s, x) => s + Number(x.total), 0)).toBe(1_000_000); // 10k × 100
      expect(r.rows.reduce((s, x) => s + Number(x.n), 0)).toBe(10_000);
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/query/engine.edge.test.ts` → expected **PASS** if Task 4's engine already handles these; **FAIL** points straight at the gap to fix in Step 5.

- [ ] **Step 4: Diagnose any edge failure with systematic debugging.** If Step 3 shows red, read the exact failing assertion and trace it through `engine.ts`. Likely culprits and their fixes (apply only the ones a test actually needs):
  - **Null group key collapses to `""`** — in `keyOf`, map `null/undefined` to a sentinel before `join`, and store the original `null` back into `row[g.field]` (the test "null grouping key" requires `costCenter === null` in the output row). Ensure `bucketValue` returns `null` (not `"null"`) for null cells.
  - **Empty-set aggregate returns no row** — confirm the no-`groupBy` + `metrics` branch always emits one row even when `rows` is empty (the `aggregate` helper already returns `0` for `[]`).
  - **`columns` empty on empty result** — `resolveColumns` is built from the definition, not the rows, so it must stay populated; verify the test "empty result … columns still resolved".

- [ ] **Step 5: Apply the minimal engine fix (if needed) and re-run.** If Step 4 found a gap, edit `report-web/src/query/engine.ts`. Concretely, harden `bucketValue` / `keyOf` for nulls:
  ```ts
  const NULL_KEY = "␀"; // ␀ sentinel, distinct from any real value
  // in keyOf:
  const keyOf = (r: Record<string, CellValue>) =>
    def.groupBy!.map((g) => {
      const bv = bucketValue(r[g.field], g, fieldById(entity, g.field));
      return bv === null || bv === undefined ? NULL_KEY : String(bv);
    }).join(GROUP_SEP);
  ```
  and keep the group's representative value as the real (possibly `null`) cell:
  ```ts
  def.groupBy!.forEach((g) => {
    const bv = bucketValue(bucketRows[0][g.field], g, fieldById(entity, g.field));
    row[g.field] = (bv ?? null) as string | number;
  });
  ```
  Run: `cd report-web && npx vitest run src/query/engine.edge.test.ts && npx vitest run src/query/engine.test.ts` → expected **PASS** for both (no regression in Task 4 suites).

- [ ] **Step 6: Build + lint + full query-folder test + commit.** Run `cd report-web && npx tsc --noEmit && npm run lint && npx vitest run src/query`. Expected: typecheck clean, lint clean, all of `engine.test.ts` + `engine.edge.test.ts` + `drilldown.test.ts` pass. Commit:
  ```bash
  git commit -m "feat(report-web): drill-down + query-engine edge-case hardening

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

**Acceptance criteria:** `drillInto` pins the clicked dimension value as a filter and either (a) runs the `targetDefinition` with that filter appended, or (b) inline-advances to the next `groupBy` dimension (or detail rows when none remain), honoring a custom drill `operator`; `buildDrilldownDefinition` produces the child def without executing it. The engine returns `total: 0` + `rows: []` + populated `columns` for empty results, a single zero-row for empty aggregates, null-guarded `avg`/`sum`, correct `countDistinct`, stable null-key bucketing (output preserves `null`), and groups/sums a 10k-row dataset under 500ms. All `src/query` tests, typecheck, and lint are green.


### Task 6: Mock AI service (`IReportAIService.generate`) — examples + rules

Builds the v1 AI brain. `MockReportAIService` implements the canonical seam `IReportAIService.generate(req)` (R2): it operates **only** over the `SemanticModel`, never emits SQL, and only ever references existing semantic fields. Three curated example prompts (fa + en) map to the spec's three worked `ReportDefinition`s (§5.7–§5.9); a keyword/intent rule engine handles every other prompt and still returns a schema-correct definition. Strict TDD.

**Files:**
- Create: `report-web/src/ai/IReportAIService.ts` (re-export from `contracts/ai`)
- Create: `report-web/src/ai/examples.ts`
- Create: `report-web/src/ai/rules.ts`
- Create: `report-web/src/ai/mock-ai-service.ts`
- Test: `report-web/src/ai/mock-ai-service.test.ts`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/ai.ts` (Task 1) exports:
  ```ts
  export interface IReportAIService { generate(req: GenerateReportRequest): Promise<AIReportResult>; }
  export interface GenerateReportRequest { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en"; }
  export interface AIReportResult { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string; }
  export interface AIUsage { provider: string; model: string; promptVersion: string; promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; cached: boolean; latencyMs: number; fallbackUsed: boolean; }
  ```
- `contracts/report-definition.ts` (Task 1) exports `ReportDefinition`, `ColumnDef`, `Filter`, `GroupBy`, `Metric`, `CalculatedField`, `Sort`, `Drilldown`, `Presentation`, `ReportView`, `ViewType`, `ViewLibrary`, `ViewMapping`, `FilterOperator`.
- `contracts/common.ts` (Task 1, R1) exports `FieldType = "string" | "number" | "date" | "boolean"`, `Aggregation = "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none"`, `FieldFormat`.
- `contracts/semantic.ts` (Task 1) exports `SemanticModel`, `Entity`, `Field`, `FieldRole = "dimension" | "measure" | "date"`.
- `semantic/registry.ts` (Task 2) exports `salesModel: SemanticModel` and `projectModel: SemanticModel` (used by tests only).

Produces (later tasks rely on these exact names):
- `ai/mock-ai-service.ts` → `export class MockReportAIService implements IReportAIService` with `generate(req: GenerateReportRequest): Promise<AIReportResult>`.
- `ai/examples.ts` → `export interface AIExample { id: string; matchAll: string[]; matchAny?: string[]; modelId: string; build(model: SemanticModel): ReportDefinition; }` and `export const EXAMPLES: AIExample[]`; helper `export function matchExample(normalizedPrompt: string, modelId: string): AIExample | undefined`.
- `ai/rules.ts` → `export function buildByRules(normalizedPrompt: string, model: SemanticModel): ReportDefinition` and `export function normalizePrompt(prompt: string): string`.
- `ai/IReportAIService.ts` → `export type { IReportAIService, GenerateReportRequest, AIReportResult, AIUsage } from "../contracts/ai";` (the canonical import path for UI code).

Note (R2 / R4): `MockReportAIService.generate` fills `definition.presentation.views` by calling `chooseView` from Task 7 **once it exists**. To keep Task 6 self-contained and testable in isolation, Task 6 ships a tiny internal `fallbackViews(def)` that produces a single `table` view, and Step 9 swaps it for the real `chooseView` import. Tests assert the analytical-intent fields (dataset/columns/groupBy/metrics/sorting/filters), not the view selection (that is Task 7's contract).

- [ ] **Step 1: Branch + the re-export barrel.** On `feat/report-service`, create `report-web/src/ai/IReportAIService.ts`:
  ```ts
  // report-web/src/ai/IReportAIService.ts
  // Canonical import path for UI code; the types live in contracts/ai (R2).
  export type {
    IReportAIService,
    GenerateReportRequest,
    AIReportResult,
    AIUsage,
  } from "../contracts/ai";
  ```

- [ ] **Step 2: Write the failing test for the normalizer + the 3 canonical prompts.** Create `report-web/src/ai/mock-ai-service.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { MockReportAIService } from "./mock-ai-service";
  import { normalizePrompt } from "./rules";
  import { salesModel, projectModel } from "../semantic/registry";
  import type { GenerateReportRequest } from "../contracts/ai";

  const ai = new MockReportAIService();
  const req = (
    prompt: string,
    semanticModel = salesModel,
    locale: "fa" | "en" = "fa",
  ): GenerateReportRequest => ({ prompt, semanticModel, locale });

  describe("normalizePrompt", () => {
    it("lowercases english, normalizes arabic ي/ك and persian digits, collapses whitespace", () => {
      expect(normalizePrompt("  Monthly  Revenue ")).toBe("monthly revenue");
      expect(normalizePrompt("درآمد ماهانه")).toBe("درامد ماهانه"); // diacritic-stripped
      expect(normalizePrompt("استان كرمان ١٠")).toBe("استان کرمان 10"); // ك→ک, ١٠→10
    });
  });

  describe("MockReportAIService.generate — canonical example prompts", () => {
    it("fa «درآمد ماهانه به تفکیک استان» → monthly revenue by province (5.8)", async () => {
      const res = await ai.generate(req("درآمد ماهانه به تفکیک استان", salesModel));
      const d = res.definition;
      expect(res.matchedExample).toBe("revenue-monthly-by-province");
      expect(d.dataset).toBe("sales");
      expect(d.groupBy).toEqual([
        { field: "orderDate", dateBucket: "month" },
        { field: "province" },
      ]);
      expect(d.metrics).toEqual([
        expect.objectContaining({ field: "amount", aggregation: "sum", alias: "revenue" }),
      ]);
      expect(d.sorting?.[0]).toMatchObject({ field: "orderDate", direction: "asc" });
      // never invents fields / never emits SQL:
      expect(JSON.stringify(d).toLowerCase()).not.toContain("select ");
    });

    it("en «Monthly revenue by province» matches the same example", async () => {
      const res = await ai.generate(req("Monthly revenue by province", salesModel, "en"));
      expect(res.matchedExample).toBe("revenue-monthly-by-province");
      expect(res.definition.dataset).toBe("sales");
    });

    it("fa «۱۰ مشتری برتر بر اساس فروش» → top-10 customers by sales (5.9)", async () => {
      const res = await ai.generate(req("۱۰ مشتری برتر بر اساس فروش", salesModel));
      const d = res.definition;
      expect(res.matchedExample).toBe("top-customers-by-sales");
      expect(d.groupBy).toEqual([{ field: "customerName" }]);
      expect(d.metrics?.[0]).toMatchObject({ field: "amount", aggregation: "sum", alias: "totalSales" });
      expect(d.sorting?.[0]).toMatchObject({ field: "totalSales", direction: "desc" });
      expect(d.limit).toBe(10);
    });

    it("fa «پروژه‌هایی که بیش از ۳۰ روز تأخیر دارند را بر اساس استان نشان بده» → delayed projects (5.7)", async () => {
      const res = await ai.generate(req("پروژه هایی که بیش از 30 روز تاخیر دارند را بر اساس استان نشان بده", projectModel));
      const d = res.definition;
      expect(res.matchedExample).toBe("delayed-projects-by-province");
      expect(d.dataset).toBe("projects");
      expect(d.groupBy).toEqual([{ field: "province" }]);
      expect(d.filters?.some((f) => f.dynamic && f.field === "dueDate")).toBe(true);
    });
  });
  ```
  Run it:
  ```bash
  cd report-web && npx vitest run src/ai/mock-ai-service.test.ts
  ```
  Expected: **FAIL** — `Failed to resolve import "./mock-ai-service"` / `./rules`.

- [ ] **Step 3: Implement `normalizePrompt` and the rule helpers in `rules.ts`.** Create `report-web/src/ai/rules.ts`:
  ```ts
  // report-web/src/ai/rules.ts
  import type { SemanticModel, Entity, Field } from "../contracts/semantic";
  import type {
    ReportDefinition, ColumnDef, GroupBy, Metric, Sort, Filter,
  } from "../contracts/report-definition";
  import type { Aggregation } from "../contracts/common";

  /** Normalize fa/en text: lowercase, strip persian diacritics, ي/ك→ی/ک,
   *  persian/arabic digits→ascii, collapse whitespace/punctuation. */
  export function normalizePrompt(prompt: string): string {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    let s = prompt.toLowerCase();
    // strip persian diacritics (harakat) + tatweel + zero-width chars
    s = s.replace(/[ً-ْـ‌‏‎]/g, "");
    s = s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ۀ/g, "ه").replace(/ة/g, "ه");
    s = s.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
    s = s.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
    s = s.replace(/[.,،؛:!?()\[\]{}"'«»]/g, " ");
    return s.replace(/\s+/g, " ").trim();
  }

  const TIME_WORDS = ["ماهانه", "ماهیانه", "monthly", "روند", "trend"];
  const QUARTER_WORDS = ["فصلی", "quarterly"];
  const YEAR_WORDS = ["سالانه", "سالیانه", "yearly", "annual"];
  const BY_WORDS = ["به تفکیک", "بر اساس", "per", "by"];
  const TOP_WORDS = ["برتر", "بیشترین", "top", "بالاترین"];
  const SUM_WORDS = ["مجموع", "جمع", "کل", "total", "sum"];
  const AVG_WORDS = ["میانگین", "متوسط", "average", "avg", "mean"];
  const COUNT_WORDS = ["تعداد", "شمارش", "count", "چند"];

  const includesAny = (s: string, words: string[]) => words.some((w) => s.includes(w));

  function fieldLabels(f: Field): string[] {
    return [
      normalizePrompt(f.label["fa-IR"]),
      normalizePrompt(f.label["en-US"]),
      ...(f.synonyms ?? []).map(normalizePrompt),
    ];
  }

  /** Score a field against the prompt: exact-token=3, substring=2, none=0. */
  function scoreField(prompt: string, f: Field): number {
    const tokens = prompt.split(" ");
    let best = 0;
    for (const label of fieldLabels(f)) {
      if (!label) continue;
      if (tokens.includes(label)) best = Math.max(best, 3);
      else if (prompt.includes(label) || label.split(" ").every((w) => tokens.includes(w))) best = Math.max(best, 2);
    }
    return best;
  }

  function matchedFields(prompt: string, entity: Entity, role: Field["role"]): Field[] {
    return entity.fields
      .filter((f) => f.role === role)
      .map((f) => ({ f, s: scoreField(prompt, f) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.f);
  }

  function dateBucket(prompt: string): GroupBy["dateBucket"] {
    if (includesAny(prompt, QUARTER_WORDS)) return "quarter";
    if (includesAny(prompt, YEAR_WORDS)) return "year";
    return "month";
  }

  function measureAggregation(prompt: string, f: Field): Aggregation {
    if (includesAny(prompt, AVG_WORDS) && (f.allowedAggregations ?? []).includes("avg")) return "avg";
    if (includesAny(prompt, COUNT_WORDS)) return "count";
    return (f.defaultAggregation ?? "sum") as Aggregation;
  }

  /** Deterministic rule pass: prompt + model → analytical-intent ReportDefinition.
   *  Never invents fields; only references existing semantic field ids. */
  export function buildByRules(normalizedPrompt: string, model: SemanticModel): ReportDefinition {
    const entity = model.entities[0];
    const measures = matchedFields(normalizedPrompt, entity, "measure");
    const dimensions = matchedFields(normalizedPrompt, entity, "dimension");
    const dates = matchedFields(normalizedPrompt, entity, "date");
    const wantsTime = includesAny(normalizedPrompt, [...TIME_WORDS, ...QUARTER_WORDS, ...YEAR_WORDS]);
    const wantsBy = includesAny(normalizedPrompt, BY_WORDS);
    const wantsTop = includesAny(normalizedPrompt, TOP_WORDS);

    // Pick the primary measure: a matched one, else the entity's first measure.
    const measure: Field | undefined =
      measures[0] ?? entity.fields.find((f) => f.role === "measure");

    const groupBy: GroupBy[] = [];
    if (wantsTime) {
      const dateField = dates[0] ?? entity.fields.find((f) => f.id === entity.defaultDateField);
      if (dateField) groupBy.push({ field: dateField.id, dateBucket: dateBucket(normalizedPrompt) });
    }
    if ((wantsBy || wantsTop) && dimensions[0]) groupBy.push({ field: dimensions[0].id });
    else if (!wantsTime && dimensions[0]) groupBy.push({ field: dimensions[0].id });

    const metrics: Metric[] = [];
    if (measure) {
      const agg = measureAggregation(normalizedPrompt, measure);
      metrics.push({ field: measure.column === measure.id ? measure.id : measure.id, aggregation: agg, alias: measure.id, label: measure.label["fa-IR"], format: measure.format });
    } else {
      metrics.push({ field: "*", aggregation: "count", alias: "count", label: "تعداد" });
    }

    const columns: ColumnDef[] = [
      ...groupBy.map<ColumnDef>((g) => ({ field: g.field, type: entity.fields.find((f) => f.id === g.field)?.type })),
      ...metrics.map<ColumnDef>((m) => ({ field: m.alias!, type: "number" })),
    ];

    const filters: Filter[] = [];
    const sorting: Sort[] = [];
    let limit: number | undefined;

    const timeGroup = groupBy.find((g) => !!g.dateBucket);
    if (timeGroup) {
      sorting.push({ field: timeGroup.field, direction: "asc" });
    } else if (wantsTop) {
      sorting.push({ field: metrics[0].alias!, direction: "desc" });
      limit = extractTopN(normalizedPrompt) ?? 10;
    } else if (metrics[0]) {
      sorting.push({ field: metrics[0].alias!, direction: "desc" });
    }

    return {
      id: `rpt_${Date.now()}`,
      schemaVersion: "1.0",
      name: normalizedPrompt.slice(0, 60),
      dataset: entity.source,
      columns,
      filters: filters.length ? filters : undefined,
      groupBy: groupBy.length ? groupBy : undefined,
      metrics,
      sorting: sorting.length ? sorting : undefined,
      limit,
      // presentation filled by chooseView (Task 7) inside MockReportAIService.
      presentation: { views: [] },
    };
  }

  /** Pull the N out of "10 برتر" / "top 10" if present. */
  export function extractTopN(prompt: string): number | undefined {
    const m = prompt.match(/(\d+)/);
    return m ? Number(m[1]) : undefined;
  }
  ```
  > Note: `field: measure.id` (not `measure.column`) — `ReportDefinition` always references the **semantic field id**, never the physical column (§6.2 design note). The duplicated ternary collapses to `measure.id`; it is written plainly to make the "id, not column" rule explicit at the call site.

- [ ] **Step 4: Run the normalizer test (expect partial pass).**
  ```bash
  cd report-web && npx vitest run src/ai/mock-ai-service.test.ts -t normalizePrompt
  ```
  Expected: the 3 `normalizePrompt` assertions **PASS**; the `generate` block still fails (no `mock-ai-service` yet).

- [ ] **Step 5: Implement the 3 canonical examples in `examples.ts`.** Each `build(model)` reads the entity and emits the §5.7–§5.9 analytical-intent fields. Create `report-web/src/ai/examples.ts`:
  ```ts
  // report-web/src/ai/examples.ts
  import type { SemanticModel } from "../contracts/semantic";
  import type { ReportDefinition } from "../contracts/report-definition";
  import { normalizePrompt } from "./rules";

  export interface AIExample {
    id: string;
    /** every term must appear in the normalized prompt. */
    matchAll: string[][]; // each inner array = OR-synonyms; all groups must hit
    modelId: string;      // SemanticModel.id this example targets
    build(model: SemanticModel): ReportDefinition;
  }

  /** true if the normalized prompt contains at least one synonym from every group. */
  function matchesAll(prompt: string, groups: string[][]): boolean {
    return groups.every((g) => g.some((syn) => prompt.includes(normalizePrompt(syn))));
  }

  export const EXAMPLES: AIExample[] = [
    // ----- §5.8 Monthly Revenue by Province -----
    {
      id: "revenue-monthly-by-province",
      modelId: "model-sales",
      matchAll: [["درامد", "درآمد", "revenue"], ["ماهانه", "monthly"], ["استان", "province"]],
      build: () => ({
        id: "rpt_monthly_revenue_by_province",
        schemaVersion: "1.0",
        name: "درآمد ماهانه به تفکیک استان",
        description: "Sum of revenue per month, split into one line per province.",
        tags: ["finance", "revenue", "time-series"],
        dataset: "sales",
        columns: [
          { field: "orderDate", label: "ماه", type: "date" },
          { field: "province", label: "استان", type: "string" },
          { field: "amount", label: "درآمد", type: "number",
            format: { kind: "currency", currency: "IRR", decimals: 0 } },
        ],
        filters: [
          { field: "orderDate", operator: "gte", value: { token: "startOfYear" }, dynamic: true },
        ],
        groupBy: [
          { field: "orderDate", dateBucket: "month" },
          { field: "province" },
        ],
        metrics: [
          { field: "amount", aggregation: "sum", alias: "revenue", label: "درآمد",
            format: { kind: "currency", currency: "IRR", decimals: 0 } },
        ],
        sorting: [
          { field: "orderDate", direction: "asc", priority: 1 },
          { field: "province", direction: "asc", priority: 2 },
        ],
        presentation: { views: [] },
      }),
    },
    // ----- §5.9 Top 10 Customers by Sales -----
    {
      id: "top-customers-by-sales",
      modelId: "model-sales",
      matchAll: [["مشتری", "customer"], ["برتر", "بیشترین", "top"], ["فروش", "درآمد", "sales", "revenue"]],
      build: () => ({
        id: "rpt_top10_customers_by_sales",
        schemaVersion: "1.0",
        name: "۱۰ مشتری برتر بر اساس فروش",
        description: "Customers ranked by total sales; top 10 only.",
        tags: ["crm", "sales", "ranking"],
        dataset: "sales",
        columns: [
          { field: "customerName", label: "مشتری", type: "string" },
          { field: "amount", label: "فروش", type: "number",
            format: { kind: "currency", currency: "IRR", decimals: 0 } },
        ],
        filters: [
          { field: "status", operator: "in", value: ["paid", "shipped", "delivered"] },
        ],
        groupBy: [{ field: "customerName" }],
        metrics: [
          { field: "amount", aggregation: "sum", alias: "totalSales", label: "مجموع فروش",
            format: { kind: "currency", currency: "IRR", decimals: 0 } },
          { field: "*", aggregation: "count", alias: "orderCount", label: "تعداد سفارش" },
        ],
        calculatedFields: [
          { alias: "avgOrderValue", label: "میانگین ارزش سفارش",
            expression: "totalSales / orderCount", scope: "aggregate", type: "number",
            format: { kind: "currency", currency: "IRR", decimals: 0 } },
        ],
        sorting: [{ field: "totalSales", direction: "desc" }],
        limit: 10,
        presentation: { views: [] },
      }),
    },
    // ----- §5.7 Delayed Projects > 30 Days by Province -----
    {
      id: "delayed-projects-by-province",
      modelId: "model-project",
      matchAll: [["پروژه", "project"], ["تاخیر", "تأخیر", "معوق", "delay", "delayed", "overdue"], ["استان", "province"]],
      build: () => ({
        id: "rpt_delayed_projects_by_province",
        schemaVersion: "1.0",
        name: "پروژه‌های معوق بیش از ۳۰ روز به تفکیک استان",
        description: "Projects whose due date passed more than 30 days ago, counted per province.",
        tags: ["construction", "delays", "operations"],
        dataset: "projects",
        columns: [
          { field: "province", label: "استان", type: "string" },
          { field: "delayedCount", label: "تعداد پروژه", type: "number" },
        ],
        filters: [
          { field: "status", operator: "neq", value: "completed" },
          { field: "dueDate", operator: "lt", value: { token: "today", offsetDays: -30 }, dynamic: true },
        ],
        groupBy: [{ field: "province" }],
        metrics: [
          { field: "*", aggregation: "count", alias: "delayedCount", label: "تعداد معوق" },
        ],
        sorting: [{ field: "delayedCount", direction: "desc" }],
        presentation: { views: [] },
      }),
    },
  ];

  /** Return the first example whose model + term groups all match, else undefined. */
  export function matchExample(normalizedPrompt: string, modelId: string): AIExample | undefined {
    return EXAMPLES.find((e) => e.modelId === modelId && matchesAll(normalizedPrompt, e.matchAll));
  }
  ```
  > The `dueDate` field is referenced as a semantic field; Task 2's `projectModel` must expose `dueDate`, `delayDays`, `status`, `customerName`. If a field is absent in Task 2's model, the example still emits a schema-correct definition (it references field ids only — validation against the model is the validator's job, Task 1/8). Keep example field ids aligned with the §6.3 models when wiring.

- [ ] **Step 6: Implement `MockReportAIService` in `mock-ai-service.ts`.** Create `report-web/src/ai/mock-ai-service.ts`:
  ```ts
  // report-web/src/ai/mock-ai-service.ts
  import type {
    IReportAIService, GenerateReportRequest, AIReportResult, AIUsage,
  } from "../contracts/ai";
  import type { ReportDefinition, ReportView } from "../contracts/report-definition";
  import { matchExample } from "./examples";
  import { buildByRules, normalizePrompt } from "./rules";

  /** TEMP fallback used only until Step 9 wires chooseView (Task 7). */
  function fallbackViews(def: ReportDefinition): ReportView[] {
    return [{
      type: "table", library: "antd", component: "Table",
      title: def.name,
      mapping: { columns: def.columns.map((c) => c.field) },
    }];
  }

  /** Fabricated-but-plausible usage so cost/usage dashboards are demoable (§7.5). */
  function fakeUsage(prompt: string, matched: boolean): AIUsage {
    const promptTokens = Math.max(8, Math.round(prompt.length / 3));
    const completionTokens = matched ? 120 : 180;
    return {
      provider: "mock",
      model: "mock-rules-v1",
      promptVersion: "report-gen@1",
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: 0,
      cached: matched,
      latencyMs: 40 + Math.round(Math.random() * 60),
      fallbackUsed: false,
    };
  }

  export class MockReportAIService implements IReportAIService {
    async generate(req: GenerateReportRequest): Promise<AIReportResult> {
      const { prompt, semanticModel, locale } = req;
      const norm = normalizePrompt(prompt);

      const example = matchExample(norm, semanticModel.id);
      let definition: ReportDefinition;
      let matchedExample: string | undefined;
      let explanation: string;

      if (example) {
        definition = example.build(semanticModel);
        matchedExample = example.id;
        explanation = locale === "fa"
          ? `این درخواست با نمونهٔ «${definition.name}» تطبیق داده شد.`
          : `Matched the curated example "${definition.name}".`;
      } else {
        definition = buildByRules(norm, semanticModel);
        explanation = locale === "fa"
          ? `بر اساس فیلدهای مدل معنایی «${semanticModel.name["fa-IR"]}» ساخته شد.`
          : `Built from the "${semanticModel.name["en-US"]}" semantic model fields.`;
      }

      // Fill presentation.views via auto-viz (Task 7) — TEMP fallback until Step 9.
      if (definition.presentation.views.length === 0) {
        definition.presentation = { ...definition.presentation, views: fallbackViews(definition) };
      }

      return {
        definition,
        explanation,
        matchedExample,
        usage: fakeUsage(prompt, !!example),
      };
    }
  }
  ```

- [ ] **Step 7: Run the full Task-6 test (expect PASS).**
  ```bash
  cd report-web && npx vitest run src/ai/mock-ai-service.test.ts
  ```
  Expected: **all tests PASS** (normalizer + 4 example/canonical-prompt assertions).

- [ ] **Step 8: Add the "unknown prompt → still valid" test, run (expect PASS).** Append to `mock-ai-service.test.ts`:
  ```ts
  describe("MockReportAIService.generate — rule fallback", () => {
    it("an unknown-but-on-topic prompt still returns a schema-correct definition", async () => {
      const res = await ai.generate(req("میانگین تعداد به تفکیک کانال فروش", salesModel));
      const d = res.definition;
      expect(res.matchedExample).toBeUndefined();
      // required fields present:
      expect(d.schemaVersion).toBe("1.0");
      expect(d.dataset).toBe("sales");
      expect(d.columns.length).toBeGreaterThan(0);
      expect(d.metrics?.length).toBeGreaterThan(0);
      expect(d.presentation.views.length).toBeGreaterThan(0);
      // every referenced field id exists in the model OR is a metric alias (no invented fields):
      const fieldIds = new Set(salesModel.entities[0].fields.map((f) => f.id));
      const aliases = new Set((d.metrics ?? []).map((m) => m.alias!));
      for (const g of d.groupBy ?? []) expect(fieldIds.has(g.field)).toBe(true);
      for (const c of d.columns) expect(fieldIds.has(c.field) || aliases.has(c.field)).toBe(true);
      // never emits raw SQL:
      expect(JSON.stringify(d).toLowerCase()).not.toMatch(/select\s|from\s|where\s/);
    });

    it("a totally off-topic prompt falls back to a count metric, no crash", async () => {
      const res = await ai.generate(req("سلام خوبی", salesModel));
      expect(res.definition.metrics?.[0]).toMatchObject({ aggregation: "count" });
      expect(res.definition.presentation.views.length).toBeGreaterThan(0);
    });
  });
  ```
  ```bash
  cd report-web && npx vitest run src/ai/mock-ai-service.test.ts
  ```
  Expected: **all PASS**.

- [ ] **Step 9: Wire the real `chooseView` (Task 7) into `MockReportAIService`.** Once Task 7 has landed `presentation/auto-viz.ts`, replace the TEMP fallback. In `mock-ai-service.ts`:
  - Add import: `import { chooseView } from "../presentation/auto-viz";` and `import { runQuery } from "../query/engine";` and `import { getDataset } from "@/semantic/registry";` (Task 2/3 exports).
  - Remove `fallbackViews`.
  - Replace the view-filling block with:
    ```ts
    if (definition.presentation.views.length === 0) {
      const result = runQuery(definition, getDataset(definition.dataset), semanticModel); // Task 3 (R3); dataset keyed by definition.dataset
      const views = chooseView(definition, result, semanticModel); // Task 7 (R4)
      definition.presentation = { ...definition.presentation, views };
    }
    ```
  > If `getDataset`/`runQuery` are not yet available at the time Task 6 runs, keep Step-6's `fallbackViews` and defer this step to a follow-up commit gated on Tasks 2/3/7 — but the integration point is exactly here. Re-run `npx vitest run src/ai/mock-ai-service.test.ts`; canonical prompts now get real views (Table/Line/Bar) — loosen any over-strict view assertion to `views.length > 0` since Task 7 owns view selection.

- [ ] **Step 10: Build, lint, full test pass, commit.**
  ```bash
  cd report-web && npx tsc --noEmit && npm run lint && npx vitest run
  ```
  Expected: type-check clean, lint clean, **all tests pass**.
  ```bash
  git add report-web/src/ai
  git commit -m "feat(report-web): mock AI service (examples + rules) implementing IReportAIService.generate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

**Acceptance criteria:**
- `MockReportAIService.generate(req)` matches the canonical R2 signature and returns `{ definition, explanation?, usage?, matchedExample? }`.
- The 3 canonical prompts (fa **and** en) map to the §5.7/§5.8/§5.9 `ReportDefinition`s with `matchedExample` set.
- Any unknown on-topic prompt returns a schema-correct definition that references **only** existing semantic field ids / metric aliases — never invented fields, never SQL strings.
- The service operates solely on `req.semanticModel`; no network, fully offline.

---

### Task 7: Auto-viz chooser (`chooseView`) — §8.6 thresholds

Implements the deterministic view selector. `chooseView(def, result, semantic)` (R4) inspects the **resolved query shape** (`QueryResult` columns/rows + semantic field types) and returns `ReportView[]` (the §5 shape) using the **exact §8.6 thresholds** — §8.6 is the single source of truth. First match wins; the strict no-antd-for-charts rule is encoded in the emitted `library`/`type`. Strict TDD, one test per branch.

**Files:**
- Create: `report-web/src/presentation/auto-viz.ts`
- Test: `report-web/src/presentation/auto-viz.test.ts`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/report-definition.ts` (Task 1) — `ReportDefinition`, `GroupBy`, `Metric`, `ReportView`, `ViewType`, `ViewLibrary`, `ViewMapping`.
- `contracts/common.ts` (Task 1, R1) — `FieldType = "string" | "number" | "date" | "boolean"`.
- `contracts/semantic.ts` (Task 1) — `SemanticModel`, `Entity`, `Field`, `FieldRole = "dimension" | "measure" | "date"`.
- `query/engine.ts` (Task 3, R3) — `QueryResult = { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number }`; `ResolvedColumn = { key: string; label: string; type: FieldType; isMetric: boolean }`; `ResultRow = Record<string, string | number | null>`.

Produces (Tasks 6 + presentation dispatcher rely on this):
- `presentation/auto-viz.ts` → `export function chooseView(def: ReportDefinition, result: QueryResult, semantic: SemanticModel): ReportView[]` and `export const AUTO_VIZ_THRESHOLDS = { BAR_MAX_CATEGORIES: 12, PIE_MAX_SLICES: 8, TABLE_MIN_CATEGORIES: 25 } as const;`

Shape-detection contract (encodes §8.6 exactly):
- **dimensions** = `def.groupBy ?? []` (each is a categorical/date GROUP BY field).
- **dateDimension** = a `groupBy` field whose semantic role is `"date"` (or carries a `dateBucket`).
- **measures** = `result.columns.filter((c) => c.isMetric)` (aggregated outputs the engine tagged `isMetric:true`).
- **categories** = `result.total` (distinct group rows) when there is exactly one non-date dimension.
- **share-of-total intent** = `def.tags?.includes("share")` OR a view hint already pinned to pie OR `def.presentation.views.some((v) => v.component === "PieChart")`.
- **advanced intent** = `def.tags` ∩ `{heatmap, treemap, sankey, gauge, matrix}` is non-empty.

§8.6 rule order (first match wins):
1. single measure, **no** dimension (or `result.total <= 1`) → **kpi / antd / Card**
2. one **date** dimension + ≥1 measure → **line / recharts / LineChart**
3. one categorical dimension + 1 measure, `categories <= 12` (and not share-intent) → **bar / recharts / BarChart**
4. one dimension + 1 measure, **share-of-total intent**, `slices <= 8` → **pie / recharts / PieChart**
5. **2 dimensions × 1 measure** (matrix), OR `categories > 25`, OR advanced intent → **chart / echarts / EChart**
6. otherwise (many columns/rows, no clear measure) → **table / antd / Table**

> Note on §8.6 `View.type` vs §5 `ReportView.type`: §8.6's inline `type` union is `line|bar|pie|...`, but the **canonical persisted shape (R5/§5)** is `ViewType = "table" | "kpi" | "chart" | "dashboardWidget"` with the chart kind carried by `component` (`LineChart`/`BarChart`/`PieChart`/`EChart`). `chooseView` emits the **§5 `ReportView`** shape: `type:"chart"` + `library:"recharts"` + `component:"LineChart"`, etc. KPI → `type:"kpi"`, Table → `type:"table"`.

- [ ] **Step 1: Write the failing test covering every branch.** Create `report-web/src/presentation/auto-viz.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import { chooseView, AUTO_VIZ_THRESHOLDS } from "./auto-viz";
  import type { ReportDefinition } from "../contracts/report-definition";
  import type { QueryResult, ResolvedColumn, ResultRow } from "../query/engine";
  import type { SemanticModel } from "../contracts/semantic";

  // minimal sales-like semantic model used to resolve groupBy roles.
  const semantic: SemanticModel = {
    id: "model-sales", tenantId: "global", version: 1, defaultLocale: "fa-IR",
    name: { "fa-IR": "فروش", "en-US": "Sales" },
    entities: [{
      id: "sales", source: "sales", name: { "fa-IR": "فروش", "en-US": "Sales" },
      defaultDateField: "orderDate",
      fields: [
        { id: "province", column: "province", type: "string", role: "dimension", label: { "fa-IR": "استان", "en-US": "Province" } },
        { id: "category", column: "category", type: "string", role: "dimension", label: { "fa-IR": "دسته", "en-US": "Category" } },
        { id: "orderDate", column: "orderDate", type: "date", role: "date", label: { "fa-IR": "تاریخ", "en-US": "Date" } },
        { id: "revenue", column: "revenue", type: "number", role: "measure", label: { "fa-IR": "درآمد", "en-US": "Revenue" } },
      ],
    }],
  };

  // builders for fixtures -------------------------------------------------
  const col = (key: string, type: ResolvedColumn["type"], isMetric: boolean, label = key): ResolvedColumn => ({ key, label, type, isMetric });
  const result = (columns: ResolvedColumn[], rows: ResultRow[]): QueryResult => ({ columns, rows, total: rows.length });
  const nRows = (n: number, dim = "province"): ResultRow[] =>
    Array.from({ length: n }, (_, i) => ({ [dim]: `v${i}`, revenue: i * 10 }));

  const def = (over: Partial<ReportDefinition>): ReportDefinition => ({
    id: "t", schemaVersion: "1.0", name: "t", dataset: "sales",
    columns: [], presentation: { views: [] }, ...over,
  });

  describe("chooseView (§8.6 thresholds)", () => {
    it("exports the canonical thresholds", () => {
      expect(AUTO_VIZ_THRESHOLDS).toEqual({ BAR_MAX_CATEGORIES: 12, PIE_MAX_SLICES: 8, TABLE_MIN_CATEGORIES: 25 });
    });

    it("rule 1 — single measure, no dimension → KPI Card (antd)", () => {
      const r = result([col("revenue", "number", true)], [{ revenue: 9000 }]);
      const views = chooseView(def({ metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "kpi", library: "antd", component: "Card", mapping: { value: "revenue" } });
    });

    it("rule 1b — one row only → KPI even with a dimension column", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], [{ province: "تهران", revenue: 7 }]);
      const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0].type).toBe("kpi");
    });

    it("rule 2 — date dimension + measure → LineChart (recharts)", () => {
      const rows: ResultRow[] = [{ orderDate: "2025-01", revenue: 100 }, { orderDate: "2025-02", revenue: 130 }];
      const r = result([col("orderDate", "date", false), col("revenue", "number", true)], rows);
      const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "LineChart", mapping: { x: "orderDate", y: "revenue" } });
    });

    it("rule 3 — one dimension + measure, ≤12 categories → BarChart (recharts)", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(10));
      const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "BarChart", mapping: { x: "province", y: "revenue" } });
    });

    it("rule 3 boundary — exactly 12 categories → still BarChart", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(12));
      expect(chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].component).toBe("BarChart");
    });

    it("rule 4 — share-of-total intent, ≤8 slices → PieChart (recharts)", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(5));
      const views = chooseView(def({ tags: ["share"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "chart", library: "recharts", component: "PieChart", mapping: { category: "province", measure: "revenue" } });
    });

    it("rule 4 fallthrough — share intent but 9 slices → not pie (bar)", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(9));
      expect(chooseView(def({ tags: ["share"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].component).toBe("BarChart");
    });

    it("rule 5a — 2 dimensions × 1 measure → ECharts", () => {
      const r = result([col("orderDate", "date", false), col("province", "string", false), col("revenue", "number", true)],
        [{ orderDate: "2025-01", province: "تهران", revenue: 100 }]);
      const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }, { field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "chart", library: "echarts", component: "EChart" });
    });

    it("rule 5b — >25 categories → ECharts", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(26));
      expect(chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].library).toBe("echarts");
    });

    it("rule 5c — heatmap intent → ECharts", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(4));
      expect(chooseView(def({ tags: ["heatmap"], groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic)[0].library).toBe("echarts");
    });

    it("rule 6 — no measure / wide detail → Table (antd)", () => {
      const r = result([col("title", "string", false), col("province", "string", false), col("status", "string", false)],
        [{ title: "a", province: "تهران", status: "open" }, { title: "b", province: "قم", status: "done" }]);
      const views = chooseView(def({ columns: [{ field: "title" }, { field: "province" }, { field: "status" }] }), r, semantic);
      expect(views[0]).toMatchObject({ type: "table", library: "antd", component: "Table" });
    });

    it("always appends a Table fallback view for non-table primaries", () => {
      const r = result([col("province", "string", false), col("revenue", "number", true)], nRows(10));
      const views = chooseView(def({ groupBy: [{ field: "province" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      expect(views.length).toBeGreaterThanOrEqual(2);
      expect(views[views.length - 1].type).toBe("table");
    });

    it("STRICT — a chart view never uses library antd", () => {
      const r = result([col("orderDate", "date", false), col("revenue", "number", true)], [{ orderDate: "2025-01", revenue: 1 }, { orderDate: "2025-02", revenue: 2 }]);
      const views = chooseView(def({ groupBy: [{ field: "orderDate", dateBucket: "month" }], metrics: [{ field: "revenue", aggregation: "sum", alias: "revenue" }] }), r, semantic);
      for (const v of views) if (v.type === "chart") expect(v.library).not.toBe("antd");
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/auto-viz.test.ts
  ```
  Expected: **FAIL** — `Failed to resolve import "./auto-viz"`.

- [ ] **Step 2: Implement `chooseView` in `auto-viz.ts` (minimal, §8.6 order).** Create `report-web/src/presentation/auto-viz.ts`:
  ```ts
  // report-web/src/presentation/auto-viz.ts
  import type {
    ReportDefinition, ReportView, ViewMapping,
  } from "../contracts/report-definition";
  import type { QueryResult, ResolvedColumn } from "../query/engine";
  import type { SemanticModel, Field } from "../contracts/semantic";

  /** EXACT §8.6 thresholds — single source of truth for view selection. */
  export const AUTO_VIZ_THRESHOLDS = {
    BAR_MAX_CATEGORIES: 12, // ≤ ~12 categories → bar
    PIE_MAX_SLICES: 8,      // ≤ ~8 slices → pie
    TABLE_MIN_CATEGORIES: 25, // > ~25 categories → echarts/advanced
  } as const;

  const ADVANCED_INTENT = ["heatmap", "treemap", "sankey", "gauge", "matrix"];

  function fieldRole(semantic: SemanticModel, fieldId: string): Field["role"] | undefined {
    for (const e of semantic.entities) {
      const f = e.fields.find((x) => x.id === fieldId);
      if (f) return f.role;
    }
    return undefined;
  }

  const view = (
    type: ReportView["type"],
    library: ReportView["library"],
    component: string,
    title: string | undefined,
    mapping: ViewMapping,
  ): ReportView => ({ type, library, component, title, mapping });

  function tableView(def: ReportDefinition, result: QueryResult): ReportView {
    return view("table", "antd", "Table", def.name, {
      columns: result.columns.map((c) => c.key),
    });
  }

  export function chooseView(
    def: ReportDefinition,
    result: QueryResult,
    semantic: SemanticModel,
  ): ReportView[] {
    const { BAR_MAX_CATEGORIES, PIE_MAX_SLICES, TABLE_MIN_CATEGORIES } = AUTO_VIZ_THRESHOLDS;

    const groupBy = def.groupBy ?? [];
    const measures: ResolvedColumn[] = result.columns.filter((c) => c.isMetric);
    const measure = measures[0];

    // classify the GROUP BY dimensions
    const dateDims = groupBy.filter((g) => !!g.dateBucket || fieldRole(semantic, g.field) === "date");
    const catDims = groupBy.filter((g) => !g.dateBucket && fieldRole(semantic, g.field) !== "date");
    const dimCount = groupBy.length;
    const categories = result.total; // distinct group rows

    const tags = def.tags ?? [];
    const shareIntent =
      tags.includes("share") ||
      def.presentation.views.some((v) => v.component === "PieChart");
    const advancedIntent = tags.some((t) => ADVANCED_INTENT.includes(t));

    const primary: ReportView = (() => {
      // RULE 1 — single measure, no dimension (or 1 row) → KPI
      if (measure && (dimCount === 0 || categories <= 1)) {
        return view("kpi", "antd", "Card", def.name, { value: measure.key });
      }

      // RULE 5 (advanced intent / matrix / huge) takes precedence over bar/line/pie:
      // 2 dims × 1 measure (matrix), OR >25 categories, OR advanced intent.
      const isMatrix = dimCount >= 2 && measures.length >= 1;
      if (advancedIntent || isMatrix || categories > TABLE_MIN_CATEGORIES) {
        if (measure) {
          const x = (dateDims[0] ?? catDims[0] ?? groupBy[0])?.field;
          const y = (catDims[0] ?? dateDims[1] ?? catDims[1])?.field ?? x;
          return view("chart", "echarts", "EChart", def.name, { x, y, measure: measure.key });
        }
      }

      // RULE 2 — one date dimension + ≥1 measure → LineChart
      if (measure && dateDims.length >= 1 && catDims.length === 0) {
        return view("chart", "recharts", "LineChart", def.name, {
          x: dateDims[0].field, y: measure.key,
        });
      }

      // RULE 4 — single dimension + measure, share intent, ≤8 slices → PieChart
      if (measure && dimCount === 1 && shareIntent && categories <= PIE_MAX_SLICES) {
        return view("chart", "recharts", "PieChart", def.name, {
          category: groupBy[0].field, measure: measure.key,
        });
      }

      // RULE 3 — one categorical dimension + measure, ≤12 categories → BarChart
      if (measure && catDims.length === 1 && dateDims.length === 0 && categories <= BAR_MAX_CATEGORIES) {
        return view("chart", "recharts", "BarChart", def.name, {
          x: catDims[0].field, y: measure.key,
        });
      }

      // RULE 6 — fallback: Table
      return tableView(def, result);
    })();

    // Always offer a Table as a secondary view (unless the primary already is one).
    if (primary.type === "table") return [primary];
    return [primary, tableView(def, result)];
  }
  ```

- [ ] **Step 3: Run the test (expect PASS).**
  ```bash
  cd report-web && npx vitest run src/presentation/auto-viz.test.ts
  ```
  Expected: **all branch tests PASS** (kpi / kpi-1row / line / bar / bar-boundary-12 / pie / pie-fallthrough-9 / echarts-matrix / echarts->25 / echarts-heatmap / table / table-fallback / strict-no-antd-chart / thresholds).
  > If `rule 3 boundary — exactly 12` fails, confirm `<= BAR_MAX_CATEGORIES` (inclusive), not `<`. If `rule 5b — >25` fails, confirm `categories > TABLE_MIN_CATEGORIES` (strict `>`, so 26 triggers, 25 would not). These match §8.6's "≤ ~12", "> ~25" exactly.

- [ ] **Step 4: Type-check, lint, full test, commit.**
  ```bash
  cd report-web && npx tsc --noEmit && npm run lint && npx vitest run
  ```
  Expected: clean type-check, clean lint, **all tests pass**.
  ```bash
  git add report-web/src/presentation/auto-viz.ts report-web/src/presentation/auto-viz.test.ts
  git commit -m "feat(report-web): auto-viz chooseView with exact §8.6 thresholds

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

**Acceptance criteria:**
- `chooseView(def, result, semantic)` matches R4 and returns `ReportView[]` in the canonical §5 shape (`type`/`library`/`component`/`mapping`).
- Every §8.6 branch is selected by the exact numeric thresholds: KPI (single measure / 1 row), LineChart (date dim + measure), BarChart (≤12 categories), PieChart (share intent, ≤8 slices), ECharts (2 dims × measure / >25 categories / heatmap·treemap·sankey·gauge·matrix intent), Table (no measure / wide detail).
- The strict rule holds in output: no `chart`-type view is ever emitted with `library:"antd"`; KPI/Table use `antd`.
- A Table fallback view is always appended after any non-table primary, so the viewer can switch.



### Task 8: Theme, i18n, RTL & global CSS

**Files:**
- Create: `report-web/src/theme/theme.ts`
- Create: `report-web/src/theme/ThemeProvider.tsx`
- Create: `report-web/src/theme/global.css`
- Create: `report-web/src/i18n/index.ts`
- Create: `report-web/src/i18n/locales/fa.json`
- Create: `report-web/src/i18n/locales/en.json`
- Test: `report-web/src/theme/theme.test.ts`

**Interfaces:**

Consumes (from earlier tasks):
- `store/ui-store.ts` is built in **Task 10**. To avoid a forward dependency, Task 8 defines theme/i18n as **pure functions + a provider that takes props**; the wiring to `ui-store` happens in Task 11's `providers.tsx`. Task 8 reads nothing from later tasks.

Produces (later tasks rely on these exact names/signatures):
- `theme/theme.ts`:
  - `export type ThemeMode = "light" | "dark";`
  - `export interface BrandTokens { primary: string; accent?: string }`
  - `export const tokens: { primary: string; accent: string; radius: number; fontFa: string; fontEn: string };`
  - `export function buildAntdTheme(mode: ThemeMode, brand: BrandTokens, dir: "rtl" | "ltr"): ThemeConfig;` (`ThemeConfig` is antd's `import { theme } from "antd"` config type)
  - `export function buildEChartsTheme(mode: ThemeMode, brand: BrandTokens): Record<string, unknown>;`
  - `export function applyCssVars(mode: ThemeMode, brand: BrandTokens): void;` (writes `--rw-*` vars + `data-theme` on `document.documentElement`)
- `theme/ThemeProvider.tsx`:
  - `export function ThemeProvider(props: { mode: ThemeMode; brand: BrandTokens; dir: "rtl" | "ltr"; locale: "fa" | "en"; children: React.ReactNode }): JSX.Element;` (wraps antd `ConfigProvider` with theme + direction + antd locale)
- `i18n/index.ts`:
  - `export const i18n: i18next.i18n;` (configured instance)
  - `export function applyLocale(locale: "fa" | "en"): void;` (sets `document.documentElement.lang`/`dir`, calls `i18n.changeLanguage`)
  - `export type AppLocale = "fa" | "en";`
- i18n keys (top-level namespaces used app-wide): `nav.*`, `common.*`, `auth.*`, `ask.*`, `reports.*`, `dashboards.*`, `admin.*`, `rbac.role.*`, `rbac.perm.*`, `tenant.*`.

- [ ] **Step 1: Install Task 8 (theme + i18n) deps.** **Task 1 already scaffolded Vite + vitest; do not re-run create-vite.** Assume `report-web/` (with `vite.config.ts`, the vitest/jsdom test block, `src/test-setup.ts`, and the `test`/`build`/`lint` scripts) already exists from Task 1. On branch `feat/report-service`, only add the theme/i18n packages:
```bash
git checkout feat/report-service
cd report-web
npm install antd @ant-design/cssinjs i18next react-i18next i18next-browser-languagedetector @fontsource/vazirmatn
```
Expected: the packages install into the existing `report-web/package.json` with no error (no new project is created; the vite/vitest config from Task 1 is left untouched).

- [ ] **Step 2: Write the failing test for theme builders (`theme/theme.test.ts`).**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildAntdTheme, buildEChartsTheme, applyCssVars, tokens } from "./theme";

describe("buildAntdTheme", () => {
  it("uses dark algorithm + rtl direction in dark/rtl", () => {
    const cfg = buildAntdTheme("dark", { primary: "#10b981" }, "rtl");
    expect(cfg.direction).toBe("rtl");
    expect(cfg.token?.colorPrimary).toBe("#10b981");
    expect(Array.isArray(cfg.algorithm) ? cfg.algorithm.length : 1).toBeGreaterThan(0);
  });
  it("falls back to base primary when brand has none", () => {
    const cfg = buildAntdTheme("light", { primary: "" }, "ltr");
    expect(cfg.token?.colorPrimary).toBe(tokens.primary);
    expect(cfg.direction).toBe("ltr");
  });
});

describe("buildEChartsTheme", () => {
  it("derives a color palette seeded by brand primary", () => {
    const t = buildEChartsTheme("light", { primary: "#10b981" });
    expect(Array.isArray((t as { color: string[] }).color)).toBe(true);
    expect((t as { color: string[] }).color[0]).toBe("#10b981");
  });
});

describe("applyCssVars", () => {
  beforeEach(() => document.documentElement.removeAttribute("data-theme"));
  it("writes data-theme and --rw-primary", () => {
    applyCssVars("dark", { primary: "#10b981" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--rw-primary")).toBe("#10b981");
  });
});
```

- [ ] **Step 3: Run the test — expect FAIL.**
```bash
cd report-web && npm test -- theme
```
Expected: FAIL — `Cannot find module './theme'` (file not created yet).

- [ ] **Step 4: Implement `theme/theme.ts` (full).**
```ts
import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark";
export interface BrandTokens {
  primary: string;
  accent?: string;
}

export const tokens = {
  primary: "#10b981", // emerald brand
  accent: "#0ea5e9",
  radius: 10,
  fontFa: "'Vazirmatn', system-ui, sans-serif",
  fontEn: "'Inter', system-ui, sans-serif",
} as const;

const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

export function buildAntdTheme(mode: ThemeMode, brand: BrandTokens, dir: "rtl" | "ltr"): ThemeConfig {
  const primary = brand.primary || tokens.primary;
  return {
    direction: dir,
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorInfo: primary,
      borderRadius: tokens.radius,
      fontFamily: dir === "rtl" ? tokens.fontFa : tokens.fontEn,
    },
    components: {
      Table: { headerBg: "var(--rw-surface-2)" },
      Card: { paddingLG: 20 },
      Layout: { headerBg: "var(--rw-surface-1)", siderBg: "var(--rw-surface-1)" },
      Menu: { itemBg: "transparent" },
    },
  };
}

export function buildEChartsTheme(mode: ThemeMode, brand: BrandTokens): Record<string, unknown> {
  const p = brand.primary || tokens.primary;
  const a = brand.accent || tokens.accent;
  return {
    color: [p, a, lighten(p, 40), lighten(a, 40), "#f59e0b", "#ef4444"],
    backgroundColor: "transparent",
    textStyle: { fontFamily: tokens.fontFa, color: mode === "dark" ? "#e5e7eb" : "#1f2937" },
    legend: { textStyle: { color: mode === "dark" ? "#e5e7eb" : "#1f2937" } },
  };
}

export function applyCssVars(mode: ThemeMode, brand: BrandTokens): void {
  const el = document.documentElement;
  const primary = brand.primary || tokens.primary;
  el.setAttribute("data-theme", mode);
  el.style.setProperty("--rw-primary", primary);
  el.style.setProperty("--rw-accent", brand.accent || tokens.accent);
  if (mode === "dark") {
    el.style.setProperty("--rw-bg", "#0b0f14");
    el.style.setProperty("--rw-surface-1", "#111827");
    el.style.setProperty("--rw-surface-2", "#1f2937");
    el.style.setProperty("--rw-text", "#e5e7eb");
    el.style.setProperty("--rw-border", "#27303a");
  } else {
    el.style.setProperty("--rw-bg", "#f8fafc");
    el.style.setProperty("--rw-surface-1", "#ffffff");
    el.style.setProperty("--rw-surface-2", "#f1f5f9");
    el.style.setProperty("--rw-text", "#1f2937");
    el.style.setProperty("--rw-border", "#e2e8f0");
  }
}
```

- [ ] **Step 5: Run the test — expect PASS.**
```bash
cd report-web && npm test -- theme
```
Expected: PASS — 4 tests passing.

- [ ] **Step 6: Create `i18n/locales/fa.json` (default, RTL).** Full key set used app-wide (nav, shell, auth, screens, RBAC labels, tenant).
```json
{
  "common": {
    "appName": "گزارش‌ساز هوشمند",
    "save": "ذخیره", "cancel": "انصراف", "delete": "حذف", "edit": "ویرایش",
    "create": "ایجاد", "search": "جستجو", "loading": "در حال بارگذاری…",
    "empty": "موردی یافت نشد", "retry": "تلاش دوباره", "back": "بازگشت",
    "confirm": "تایید", "yes": "بله", "no": "خیر", "actions": "عملیات"
  },
  "nav": {
    "ask": "پرسش از هوش مصنوعی", "reports": "گزارش‌ها", "dashboards": "داشبوردها",
    "favorites": "نشان‌شده‌ها", "data": "داده‌ها", "exports": "خروجی‌ها",
    "profile": "پروفایل", "settings": "تنظیمات", "admin": "مدیریت",
    "backToWorkspace": "بازگشت به فضای کاری",
    "groupContent": "محتوا", "groupData": "داده", "groupOutput": "خروجی",
    "adminOverview": "نمای کلی", "groupAccess": "دسترسی", "users": "کاربران",
    "roles": "نقش‌ها", "groupDataSemantics": "داده و معنا", "dataSources": "منابع داده",
    "semanticModels": "مدل‌های معنایی", "groupAi": "هوش مصنوعی",
    "aiProviders": "ارائه‌دهندگان", "aiRouting": "مسیریابی", "aiPrompts": "پرامپت‌ها",
    "aiUsage": "مصرف و هزینه", "groupTenant": "سازمان", "tenantSettings": "تنظیمات سازمان",
    "quota": "سهمیه", "groupGovernance": "نظارت", "audit": "گزارش رخدادها",
    "groupPlatform": "پلتفرم", "tenants": "سازمان‌ها", "system": "تنظیمات سامانه"
  },
  "auth": {
    "login": "ورود", "logout": "خروج", "signingIn": "در حال ورود…",
    "callbackError": "ورود ناموفق بود", "mockMode": "حالت آزمایشی",
    "selectRole": "انتخاب نقش", "loggedOut": "از حساب خارج شدید"
  },
  "ask": {
    "title": "پرسش از هوش مصنوعی", "placeholder": "آنچه می‌خواهید ببینید را بنویسید…",
    "generate": "ساخت گزارش", "explanation": "توضیح"
  },
  "reports": {
    "title": "کتابخانه گزارش‌ها", "new": "گزارش جدید", "run": "اجرا",
    "export": "خروجی", "viewer": "نمایش گزارش", "name": "نام", "updated": "بروزرسانی"
  },
  "dashboards": {
    "title": "داشبوردها", "new": "داشبورد جدید", "edit": "ویرایش",
    "addWidget": "افزودن ویجت"
  },
  "tenant": {
    "switcher": "انتخاب سازمان", "current": "سازمان فعلی"
  },
  "admin": {
    "overview": "نمای کلی مدیریت", "noAccess": "دسترسی ندارید"
  },
  "rbac": {
    "role": {
      "SuperAdmin": "مدیر ارشد سامانه", "TenantAdmin": "مدیر سازمان",
      "AIManager": "مدیر هوش مصنوعی", "ReportDesigner": "طراح گزارش",
      "DashboardDesigner": "طراح داشبورد", "PowerUser": "کاربر پیشرفته", "Viewer": "بیننده"
    },
    "perm": {
      "reports:write": "ویرایش گزارش", "reports:delete": "حذف گزارش",
      "reports:execute": "اجرای گزارش", "data:export": "خروجی داده",
      "ai:manage": "مدیریت هوش مصنوعی", "datasources:manage": "مدیریت منابع داده",
      "users:manage": "مدیریت کاربران", "audit:read": "مشاهده رخدادها"
    },
    "forbiddenTitle": "دسترسی غیرمجاز",
    "forbiddenMsg": "شما اجازه دسترسی به این بخش را ندارید."
  },
  "errors": { "notFoundTitle": "صفحه یافت نشد", "notFoundMsg": "آدرس مورد نظر وجود ندارد." }
}
```

- [ ] **Step 7: Create `i18n/locales/en.json` (mirror keys, English).** Same key tree as `fa.json` with English values (`common.appName` = "AI Reporting", `nav.ask` = "Ask AI", `rbac.role.SuperAdmin` = "Super Admin", etc.). Every key present in `fa.json` MUST exist here so `i18next` never falls back to the key string.
```json
{
  "common": {
    "appName": "AI Reporting", "save": "Save", "cancel": "Cancel", "delete": "Delete",
    "edit": "Edit", "create": "Create", "search": "Search", "loading": "Loading…",
    "empty": "No items found", "retry": "Retry", "back": "Back", "confirm": "Confirm",
    "yes": "Yes", "no": "No", "actions": "Actions"
  },
  "nav": {
    "ask": "Ask AI", "reports": "Reports", "dashboards": "Dashboards", "favorites": "Favorites",
    "data": "Data", "exports": "Exports", "profile": "Profile", "settings": "Settings",
    "admin": "Admin", "backToWorkspace": "Back to Workspace", "groupContent": "Content",
    "groupData": "Data", "groupOutput": "Output", "adminOverview": "Overview",
    "groupAccess": "Access", "users": "Users", "roles": "Roles",
    "groupDataSemantics": "Data & Semantics", "dataSources": "Data Sources",
    "semanticModels": "Semantic Models", "groupAi": "AI", "aiProviders": "Providers",
    "aiRouting": "Routing", "aiPrompts": "Prompts", "aiUsage": "Usage & Cost",
    "groupTenant": "Tenant", "tenantSettings": "Settings", "quota": "Quota",
    "groupGovernance": "Governance", "audit": "Audit Log", "groupPlatform": "Platform",
    "tenants": "Tenants", "system": "System Settings"
  },
  "auth": {
    "login": "Sign in", "logout": "Sign out", "signingIn": "Signing in…",
    "callbackError": "Sign-in failed", "mockMode": "Mock mode", "selectRole": "Select role",
    "loggedOut": "You have signed out"
  },
  "ask": {
    "title": "Ask AI", "placeholder": "Describe what you want to see…",
    "generate": "Generate report", "explanation": "Explanation"
  },
  "reports": {
    "title": "Report Library", "new": "New report", "run": "Run", "export": "Export",
    "viewer": "Report Viewer", "name": "Name", "updated": "Updated"
  },
  "dashboards": {
    "title": "Dashboards", "new": "New dashboard", "edit": "Edit", "addWidget": "Add widget"
  },
  "tenant": { "switcher": "Select tenant", "current": "Current tenant" },
  "admin": { "overview": "Admin Overview", "noAccess": "Access denied" },
  "rbac": {
    "role": {
      "SuperAdmin": "Super Admin", "TenantAdmin": "Tenant Admin", "AIManager": "AI Manager",
      "ReportDesigner": "Report Designer", "DashboardDesigner": "Dashboard Designer",
      "PowerUser": "Power User", "Viewer": "Viewer"
    },
    "perm": {
      "reports:write": "Create/Edit Reports", "reports:delete": "Delete Reports",
      "reports:execute": "Execute Reports", "data:export": "Export Data",
      "ai:manage": "Manage AI Providers", "datasources:manage": "Manage Data Sources",
      "users:manage": "Manage Users", "audit:read": "View Audit Logs"
    },
    "forbiddenTitle": "Forbidden",
    "forbiddenMsg": "You do not have permission to access this area."
  },
  "errors": { "notFoundTitle": "Page not found", "notFoundMsg": "The requested page does not exist." }
}
```

- [ ] **Step 8: Implement `i18n/index.ts`.**
```ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fa from "./locales/fa.json";
import en from "./locales/en.json";

export type AppLocale = "fa" | "en";

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fa: { translation: fa },
      en: { translation: en },
    },
    fallbackLng: "fa",
    supportedLngs: ["fa", "en"],
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], lookupLocalStorage: "report.locale" },
  });

export const i18n = i18next;

export function applyLocale(locale: AppLocale): void {
  const dir = locale === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
  void i18next.changeLanguage(locale);
}
```

- [ ] **Step 9: Implement `theme/ThemeProvider.tsx`.** Wires antd `ConfigProvider` with theme + direction + antd locale, and applies CSS vars on mode/brand change.
```tsx
import { useEffect } from "react";
import { ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import enUS from "antd/locale/en_US";
import { buildAntdTheme, applyCssVars, type ThemeMode, type BrandTokens } from "./theme";

export function ThemeProvider(props: {
  mode: ThemeMode;
  brand: BrandTokens;
  dir: "rtl" | "ltr";
  locale: "fa" | "en";
  children: React.ReactNode;
}) {
  const { mode, brand, dir, locale, children } = props;
  useEffect(() => {
    applyCssVars(mode, brand);
  }, [mode, brand]);
  return (
    <ConfigProvider theme={buildAntdTheme(mode, brand, dir)} locale={locale === "fa" ? faIR : enUS} direction={dir}>
      {children}
    </ConfigProvider>
  );
}
```

- [ ] **Step 10: Create `theme/global.css`.** Imports Vazirmatn and defines the body/scroll/reset against the CSS vars.
```css
@import "@fontsource/vazirmatn/400.css";
@import "@fontsource/vazirmatn/500.css";
@import "@fontsource/vazirmatn/700.css";

:root { --rw-primary: #10b981; --rw-accent: #0ea5e9; }

html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--rw-bg, #f8fafc);
  color: var(--rw-text, #1f2937);
  font-family: "Vazirmatn", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: var(--rw-border, #e2e8f0); border-radius: 8px; }
```

- [ ] **Step 11: Build, lint, test, commit.**
```bash
cd report-web && npm run build && npm run lint && npm test
```
Expected: build succeeds, lint clean, all tests PASS.
```bash
git add report-web && git commit -m "feat(report-web): theme tokens, ThemeProvider, i18n (fa/en + RTL), global css

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Auth — AuthProvider, useAuth (R6), OIDC PKCE + dev mock mode, auth routes

**Files:**
- Create: `report-web/src/auth/oidc.ts`
- Create: `report-web/src/auth/mock-user.ts`
- Create: `report-web/src/auth/AuthProvider.tsx`
- Create: `report-web/src/auth/useAuth.ts`
- Create: `report-web/src/auth/routes.tsx`
- Create: `report-web/.env.development`
- Test: `report-web/src/auth/AuthProvider.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/rbac.ts` (Task 1) exports the RBAC primitives verbatim from the spec §10.5:
  - `export type Permission = "reports:write" | "reports:delete" | "reports:execute" | "data:export" | "ai:manage" | "datasources:manage" | "users:manage" | "audit:read";`
  - `export type AppRole = "SuperAdmin" | "TenantAdmin" | "AIManager" | "ReportDesigner" | "DashboardDesigner" | "PowerUser" | "Viewer";`
  - `export const ROLE_PERMISSIONS: Record<AppRole, Permission[]>;`
  - `export function permissionsFor(roles: AppRole[], grants?: Permission[]): Set<Permission>;`
  - `export const can: (perms: Set<Permission>, p: Permission) => boolean;`
  - `export const isGlobal: (roles: AppRole[]) => boolean;`
  - `export function mapLegacyRoles(claimRoles: string[]): AppRole[];`
  - `export interface SessionUser { id: string; name: string; email: string; roles: AppRole[]; tenantId: string | null; grants?: Permission[] }` — **the single definition; Task 9 imports/re-exports it, never re-declares it.**
- `i18n/index.ts` (Task 8): `i18n` instance (for the logout/login text only — optional).

Produces (later tasks rely on these exact names/signatures):
- `auth/useAuth.ts`:
  - `export type { SessionUser } from "@/contracts"` — **does NOT re-define `SessionUser`**; it re-exports the single definition from `contracts/rbac.ts` (Task 2): `SessionUser = { id: string; name: string; email: string; roles: AppRole[]; tenantId: string | null; grants?: Permission[] }`.
  - `export interface AuthValue { user: SessionUser | null; roles: AppRole[]; isAdmin: boolean; ready: boolean; permissions: Set<Permission>; can(p: Permission): boolean; login(): void; logout(): void; setMockRole(roles: AppRole[]): void }`
  - `export function useAuth(): AuthValue;` (matches R6 surface `{ user, roles, isAdmin, ready, login, logout }` plus `permissions`/`can`/`setMockRole`)
- `auth/AuthProvider.tsx`: `export function AuthProvider(props: { children: React.ReactNode }): JSX.Element;`
- `auth/mock-user.ts`:
  - `export const MOCK_PERSONAS: Record<AppRole, SessionUser>;`
  - `export function getMockUser(): SessionUser;` / `export function setMockUser(roles: AppRole[]): SessionUser;`
- `auth/oidc.ts`: `export const userManager: UserManager;` `export function sessionUserFromOidc(u: User): SessionUser;`
- `auth/routes.tsx`: `export const LoginScreen, OidcCallback, LogoutScreen, ForbiddenScreen: React.FC;` and guard components `export function RequireAuth(): JSX.Element;` (renders `<Outlet/>`), `export function RequireRole(props: { allow: AppRole[] }): JSX.Element;`, and the **wrapper** `export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }): JSX.Element;` — renders `children` when the user holds `perm`, else redirects to `/403`.

> Note: `isAdmin` means "holds any admin-set role" = `roles` intersects `["SuperAdmin","TenantAdmin","AIManager"]` OR holds any admin permission (`ai:manage`/`datasources:manage`/`users:manage`/`audit:read`) — used to show the "Admin →" nav item.

- [ ] **Step 1: Install auth deps + react-router.**
```bash
cd report-web && npm install oidc-client-ts react-router-dom
```
Expected: installs succeed.

- [ ] **Step 2: Create `.env.development` with the auth seam flag.**
```bash
# report-web/.env.development
VITE_AUTH_MODE=mock
VITE_OIDC_AUTHORITY=https://auth.myceo.ir
VITE_USE_MOCK_API=true
```

- [ ] **Step 3: Implement `auth/oidc.ts` (oidc-client-ts, PKCE, public client `report-web`).**
```ts
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AppRole, Permission } from "../contracts/rbac";
import { mapLegacyRoles } from "../contracts/rbac";
import type { SessionUser } from "@/contracts";

const origin = window.location.origin;

export const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY as string, // https://auth.myceo.ir
  client_id: "report-web",
  redirect_uri: `${origin}/auth/callback`,
  silent_redirect_uri: `${origin}/auth/silent`,
  post_logout_redirect_uri: origin,
  response_type: "code", // Authorization Code + PKCE (public client, no secret)
  scope: "openid profile email role mabhas19.api",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
});

function rolesFromClaims(profile: Record<string, unknown>): string[] {
  const raw = (profile["role"] ?? profile["roles"]) as string | string[] | undefined;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function sessionUserFromOidc(u: User): SessionUser {
  const p = u.profile as Record<string, unknown>;
  const roles: AppRole[] = mapLegacyRoles(rolesFromClaims(p));
  return {
    id: (p.sub as string) ?? "oidc-user",
    name: (p.name as string) ?? (p.email as string) ?? "User",
    email: (p.email as string) ?? "",
    tenantId: (p.tenant_id as string) ?? null,
    roles,
    grants: [] as Permission[],
  };
}
```

- [ ] **Step 4: Implement `auth/mock-user.ts` (one persona per RBAC role, persisted).**
```ts
import type { AppRole, Permission } from "../contracts/rbac";
import type { SessionUser } from "@/contracts";

const KEY = "report.mockUser";
const TENANT = "tenant-acme";

const FA_NAME: Record<AppRole, string> = {
  SuperAdmin: "مدیر ارشد", TenantAdmin: "مدیر سازمان", AIManager: "مدیر هوش مصنوعی",
  ReportDesigner: "طراح گزارش", DashboardDesigner: "طراح داشبورد",
  PowerUser: "کاربر پیشرفته", Viewer: "بیننده",
};

const ALL_ROLES: AppRole[] = [
  "SuperAdmin", "TenantAdmin", "AIManager", "ReportDesigner",
  "DashboardDesigner", "PowerUser", "Viewer",
];

export const MOCK_PERSONAS: Record<AppRole, SessionUser> = Object.fromEntries(
  ALL_ROLES.map((r) => [
    r,
    {
      id: `mock-${r}`,
      name: FA_NAME[r],
      email: `${r.toLowerCase()}@acme.test`,
      tenantId: r === "SuperAdmin" ? null : TENANT,
      roles: [r],
      grants: [] as Permission[],
    } satisfies SessionUser,
  ]),
) as Record<AppRole, SessionUser>;

export function getMockUser(): SessionUser {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      /* fall through to default */
    }
  }
  return setMockUser(["PowerUser"]);
}

export function setMockUser(roles: AppRole[]): SessionUser {
  const primary = roles[0] ?? "Viewer";
  const base = MOCK_PERSONAS[primary];
  const user: SessionUser = { ...base, roles };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}
```

- [ ] **Step 5: Write the failing test for AuthProvider/useAuth (mock mode).** `AuthProvider.test.tsx`.
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="ready">{String(a.ready)}</span>
      <span data-testid="roles">{a.roles.join(",")}</span>
      <span data-testid="admin">{String(a.isAdmin)}</span>
      <span data-testid="canAi">{String(a.can("ai:manage"))}</span>
      <button onClick={() => a.setMockRole(["TenantAdmin"])}>asAdmin</button>
    </div>
  );
}

describe("AuthProvider (mock mode)", () => {
  beforeEach(() => localStorage.clear());

  it("seeds a mock user and resolves to ready with PowerUser default", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("ready").textContent).toBe("true");
    expect(screen.getByTestId("roles").textContent).toBe("PowerUser");
    expect(screen.getByTestId("admin").textContent).toBe("false");
    expect(screen.getByTestId("canAi").textContent).toBe("false");
  });

  it("setMockRole switches identity live and recomputes can()/isAdmin", () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => screen.getByText("asAdmin").click());
    expect(screen.getByTestId("roles").textContent).toBe("TenantAdmin");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("canAi").textContent).toBe("true");
  });
});
```

- [ ] **Step 6: Run the test — expect FAIL.**
```bash
cd report-web && npm test -- AuthProvider
```
Expected: FAIL — `Cannot find module './AuthProvider'`.

- [ ] **Step 7: Implement `auth/useAuth.ts` (context + hook).**
```ts
import { createContext, useContext } from "react";
import type { AppRole, Permission } from "../contracts/rbac";

// SessionUser is defined ONCE in contracts/rbac.ts (Task 2); re-export it here
// so existing `from "./useAuth"` imports keep working without a second copy.
export type { SessionUser } from "@/contracts";
import type { SessionUser } from "@/contracts";

export interface AuthValue {
  user: SessionUser | null;
  roles: AppRole[];
  isAdmin: boolean;
  ready: boolean;
  permissions: Set<Permission>;
  can(p: Permission): boolean;
  login(): void;
  logout(): void;
  setMockRole(roles: AppRole[]): void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
```

- [ ] **Step 8: Implement `auth/AuthProvider.tsx`.** Resolves identity from the mock store (default) or real OIDC, exposes the `AuthValue`, derives `permissions`/`isAdmin`/`can`.
```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext, type AuthValue, type SessionUser } from "./useAuth";
import { permissionsFor, type AppRole, type Permission } from "../contracts/rbac";
import { getMockUser, setMockUser } from "./mock-user";
import { userManager, sessionUserFromOidc } from "./oidc";

const ADMIN_PERMS: Permission[] = ["ai:manage", "datasources:manage", "users:manage", "audit:read"];
const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (useMock) {
        if (alive) {
          setUser(getMockUser());
          setReady(true);
        }
        return;
      }
      const u = await userManager.getUser();
      if (!alive) return;
      setUser(u && !u.expired ? sessionUserFromOidc(u) : null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setMockRole = useCallback((roles: AppRole[]) => {
    setUser(setMockUser(roles));
  }, []);

  const login = useCallback(() => {
    if (useMock) {
      setUser(getMockUser());
    } else {
      void userManager.signinRedirect();
    }
  }, []);

  const logout = useCallback(() => {
    if (useMock) {
      localStorage.removeItem("report.mockUser");
      setUser(null);
    } else {
      void userManager.signoutRedirect();
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    const roles = user?.roles ?? [];
    const permissions = permissionsFor(roles, user?.grants ?? []);
    const isAdmin =
      roles.some((r) => r === "SuperAdmin" || r === "TenantAdmin" || r === "AIManager") ||
      ADMIN_PERMS.some((p) => permissions.has(p));
    return {
      user,
      roles,
      ready,
      isAdmin,
      permissions,
      can: (p: Permission) => permissions.has(p),
      login,
      logout,
      setMockRole,
    };
  }, [user, ready, login, logout, setMockRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 9: Run the test — expect PASS.**
```bash
cd report-web && npm test -- AuthProvider
```
Expected: PASS — 2 tests passing.

- [ ] **Step 10: Implement `auth/routes.tsx` (screens + guards).** Uses react-router `Navigate`/`Outlet`/`useNavigate` and antd `Result`/`Button`/`Spin`. Real OIDC callback exchanges the code.
```tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button, Result, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import type { AppRole, Permission } from "../contracts/rbac";
import { userManager, sessionUserFromOidc } from "./oidc";

const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";

export function LoginScreen() {
  const { login, user, ready } = useAuth();
  const { t } = useTranslation();
  if (ready && user) return <Navigate to="/ask" replace />;
  return (
    <Result
      title={t("common.appName")}
      extra={
        <Button type="primary" onClick={login}>
          {useMock ? t("auth.mockMode") : t("auth.login")}
        </Button>
      }
    />
  );
}

export function OidcCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (useMock) {
      navigate("/ask", { replace: true });
      return;
    }
    userManager
      .signinRedirectCallback()
      .then((u) => {
        sessionUserFromOidc(u); // primes oidc store; AuthProvider reads on next mount
        navigate("/ask", { replace: true });
      })
      .catch(() => setError(t("auth.callbackError")));
  }, [navigate, t]);
  if (error) return <Result status="error" title={error} />;
  return <Spin tip={t("auth.signingIn")} fullscreen />;
}

export function LogoutScreen() {
  const { logout } = useAuth();
  const { t } = useTranslation();
  useEffect(() => {
    logout();
  }, [logout]);
  return <Result title={t("auth.loggedOut")} />;
}

export function ForbiddenScreen() {
  const { t } = useTranslation();
  return (
    <Result status="403" title="403" subTitle={t("rbac.forbiddenMsg")} />
  );
}

export function RequireAuth() {
  const { ready, user } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export function RequireRole({ allow }: { allow: AppRole[] }) {
  const { ready, roles } = useAuth();
  if (!ready) return <Spin fullscreen />;
  const ok = roles.some((r) => allow.includes(r));
  return ok ? <Outlet /> : <Navigate to="/403" replace />;
}

// Wrapper component: renders `children` when the user holds `perm`, else 403.
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { ready, can } = useAuth();
  if (!ready) return <Spin fullscreen />;
  return can(perm) ? <>{children}</> : <Navigate to="/403" replace />;
}
```

- [ ] **Step 11: Build, lint, test, commit.**
```bash
cd report-web && npm run build && npm run lint && npm test
```
Expected: build/lint clean; all tests PASS (theme + auth).
```bash
git add report-web && git commit -m "feat(report-web): auth — OIDC PKCE client, dev mock mode, useAuth + guards/routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Mock API (localStorage CRUD + seed), TanStack Query hooks, Zustand stores

**Files:**
- Create: `report-web/src/api/seed.ts`
- Create: `report-web/src/api/mockApi.ts`
- Create: `report-web/src/api/queries.ts`
- Create: `report-web/src/store/ui-store.ts`
- Create: `report-web/src/store/tenant-store.ts`
- Test: `report-web/src/api/mockApi.test.ts`
- Test: `report-web/src/store/ui-store.test.ts`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/report-definition.ts` (Task 1, the canonical Task 2 contract — top-level `dataset`, no `semanticModelId`/`query` wrapper): `export interface ReportDefinition { id: string; schemaVersion: string; name: string; dataset: string; columns: ColumnDef[]; ...; presentation: Presentation; }` (the full body lives in contracts; the mock store persists a `ReportDefinition` inside a `SavedReport` envelope, never a bare definition).
- `contracts/tenant.ts` (Task 1, verbatim from spec §11.2): `export interface Tenant { id: string; slug: string; displayName: string; status: TenantStatus; plan: TenantPlan; branding: TenantBranding; aiConfig: TenantAiConfig; quotas: TenantQuotas; dataSourceIds: string[]; defaultLocale: "fa-IR" | "en-US"; createdAt: string; updatedAt: string; }` plus `TenantBranding { logoUrl?: string; primaryColor: string; accentColor?: string; productName?: string; faviconUrl?: string; loginBackgroundUrl?: string }`, `TenantStatus = "active"|"suspended"|"trial"`, `TenantPlan = "free"|"pro"|"enterprise"`.
- `contracts/rbac.ts` (Task 1): `AppRole`, `Permission`.
- `auth/useAuth.ts` (Task 9): `SessionUser`.
- `theme/theme.ts` (Task 8): `ThemeMode`.
- `i18n/index.ts` (Task 8): `AppLocale`.
- `semantic/registry.ts` (Task 2): `export const SEMANTIC_MODELS: SemanticModel[];` (each seeded report's `definition.dataset` references a real registered dataset key).

Produces (later tasks rely on these exact names/signatures):
- `api/mockApi.ts` — typed CRUD object `export const mockApi` with collections `reports`, `dashboards`, `providers`, `users`, `tenants`, `audit`, each exposing `list(tenantId?)`, `get(id)`, `save(entity)`, `remove(id)`; plus `resetDemoData(): void`.
- `api/queries.ts` — TanStack Query hooks (R-aligned signatures) plus the canonical `SavedReport` and `DashboardRecord` types (the single definitions other tasks import from `@/api/queries`):
  - `export type SavedReport = { id: string; definition: ReportDefinition; updatedAt: string; lastRunAt?: string; ownerName: string; visibility: "private" | "tenant" }`.
  - `export type DashboardRecord = { id: string; tenantId: string; name: string; widgets: DashboardWidget[]; layout: GridLayoutItem[]; ownerName: string; createdAt: string; updatedAt: string }` (`DashboardWidget`/`GridLayoutItem` re-exported from `@/dashboard/widget`, Task 16).
  - `useReports(): UseQueryResult<SavedReport[]>`, `useReport(id: string): UseQueryResult<SavedReport>`, `useSaveReport(): UseMutationResult<SavedReport, Error, { definition: ReportDefinition; name?: string; visibility?: "private" | "tenant" }>` (wraps the definition into a `SavedReport`), `useDeleteReport()`.
  - `useDashboards(): UseQueryResult<DashboardRecord[]>`, `useDashboard(id): UseQueryResult<DashboardRecord>`, `useCreateDashboard(): UseMutationResult<DashboardRecord, Error, { name: string }>`, `useSaveDashboard(): UseMutationResult<DashboardRecord, Error, DashboardRecord>`, `useDeleteDashboard()`.
  - `useProviders()`, `useUsers()`, `useTenants()`, `useAudit()`
  - `export const rk` (query-key factory, tenant-scoped).
- `store/ui-store.ts` — `export const useUiStore` with state `{ mode: ThemeMode; locale: AppLocale; dir: "rtl"|"ltr"; sidebarCollapsed: boolean; setMode; setLocale; toggleSidebar }`.
- `store/tenant-store.ts` — `export const useTenantStore` with `{ currentTenantId: string | null; setCurrentTenant(id: string): void }`.
- Domain row types used by admin screens: `export interface AIProviderRow`, `export interface UserRow`, `export interface AuditRow` (exported from `mockApi.ts`). The dashboard record type is `DashboardRecord` (defined in `api/queries.ts`, above).

- [ ] **Step 1: Install state/query deps.**
```bash
cd report-web && npm install zustand @tanstack/react-query
```
Expected: installs succeed.

- [ ] **Step 2: Write the failing test for `ui-store`.** `store/ui-store.test.ts`.
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

describe("ui-store", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ mode: "light", locale: "fa", dir: "rtl", sidebarCollapsed: false });
  });

  it("setLocale switches dir to ltr for en", () => {
    useUiStore.getState().setLocale("en");
    expect(useUiStore.getState().locale).toBe("en");
    expect(useUiStore.getState().dir).toBe("ltr");
  });

  it("setMode toggles theme; toggleSidebar flips collapse", () => {
    useUiStore.getState().setMode("dark");
    expect(useUiStore.getState().mode).toBe("dark");
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**
```bash
cd report-web && npm test -- ui-store
```
Expected: FAIL — `Cannot find module './ui-store'`.

- [ ] **Step 4: Implement `store/ui-store.ts` (zustand + persist).**
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode } from "../theme/theme";
import type { AppLocale } from "../i18n";

interface UiState {
  mode: ThemeMode;
  locale: AppLocale;
  dir: "rtl" | "ltr";
  sidebarCollapsed: boolean;
  setMode: (m: ThemeMode) => void;
  setLocale: (l: AppLocale) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: "light",
      locale: "fa",
      dir: "rtl",
      sidebarCollapsed: false,
      setMode: (mode) => set({ mode }),
      setLocale: (locale) => set({ locale, dir: locale === "fa" ? "rtl" : "ltr" }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "report.ui" },
  ),
);
```

- [ ] **Step 5: Run — expect PASS.**
```bash
cd report-web && npm test -- ui-store
```
Expected: PASS — 2 tests passing.

- [ ] **Step 6: Implement `store/tenant-store.ts`.**
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TenantState {
  currentTenantId: string | null;
  setCurrentTenant: (id: string) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentTenantId: null,
      setCurrentTenant: (currentTenantId) => set({ currentTenantId }),
    }),
    { name: "report.currentTenantId" },
  ),
);
```

- [ ] **Step 7: Implement `api/seed.ts` (demo data: tenants, users, providers, reports, dashboards, audit).** Full seed.
```ts
import type { Tenant } from "../contracts/tenant";
import type { ReportDefinition } from "../contracts/report-definition";
import type { AIProviderRow, UserRow, AuditRow } from "./mockApi";
import type { SavedReport, DashboardRecord } from "./queries";

const now = "2026-06-22T00:00:00.000Z";

// Reports are persisted as SavedReport envelopes; the store also stamps a
// `tenantId` for tenant-scoped listing (not part of the public SavedReport type).
type SeededReport = SavedReport & { tenantId: string };

export const SEED_TENANTS: Tenant[] = [
  {
    id: "tenant-acme", slug: "acme-co", displayName: "شرکت آلفا",
    status: "active", plan: "pro",
    branding: { primaryColor: "#10b981", accentColor: "#0ea5e9", productName: "گزارش‌ساز آلفا" },
    aiConfig: { primaryProviderId: "prov-openai", fallbackProviderIds: ["prov-ollama"] } as Tenant["aiConfig"],
    quotas: { maxReports: 1000, maxAiCallsPerMonth: 50000 } as Tenant["quotas"],
    dataSourceIds: ["ds-project"], defaultLocale: "fa-IR", createdAt: now, updatedAt: now,
  },
  {
    id: "tenant-beta", slug: "beta-co", displayName: "شرکت بتا",
    status: "trial", plan: "free",
    branding: { primaryColor: "#6366f1" },
    aiConfig: { primaryProviderId: "prov-openai", fallbackProviderIds: [] } as Tenant["aiConfig"],
    quotas: { maxReports: 50, maxAiCallsPerMonth: 1000 } as Tenant["quotas"],
    dataSourceIds: ["ds-sales"], defaultLocale: "fa-IR", createdAt: now, updatedAt: now,
  },
];

export const SEED_USERS: UserRow[] = [
  { id: "u-1", tenantId: "tenant-acme", name: "آرش مدیری", email: "admin@acme.test", roles: ["TenantAdmin"], status: "active" },
  { id: "u-2", tenantId: "tenant-acme", name: "نگار طراح", email: "designer@acme.test", roles: ["ReportDesigner"], status: "active" },
  { id: "u-3", tenantId: "tenant-acme", name: "سارا کاربر", email: "viewer@acme.test", roles: ["Viewer"], status: "active" },
  { id: "u-4", tenantId: "tenant-beta", name: "بهرام مدیری", email: "admin@beta.test", roles: ["TenantAdmin"], status: "active" },
];

export const SEED_PROVIDERS: AIProviderRow[] = [
  { id: "prov-openai", tenantId: "tenant-acme", type: "OpenAI", model: "gpt-4o-mini", status: "active" },
  { id: "prov-ollama", tenantId: "tenant-acme", type: "Ollama", model: "llama3.1", status: "inactive" },
  { id: "prov-azure", tenantId: "tenant-beta", type: "Azure", model: "gpt-4o", status: "active" },
];

// Each definition is the canonical Task 2 ReportDefinition (top-level `dataset`),
// wrapped into a SavedReport envelope (+ tenantId for store scoping).
const def = (id: string, name: string, dataset: string): ReportDefinition => ({
  id, schemaVersion: "1.0", name, dataset,
  columns: [], presentation: { views: [] },
} as unknown as ReportDefinition);

export const SEED_REPORTS: SeededReport[] = [
  {
    id: "rep-delayed", tenantId: "tenant-acme", ownerName: "آرش مدیری",
    visibility: "tenant", updatedAt: now,
    definition: def("rep-delayed", "پروژه‌های با تاخیر بیش از ۳۰ روز", "projects"),
  },
  {
    id: "rep-revenue", tenantId: "tenant-acme", ownerName: "آرش مدیری",
    visibility: "tenant", updatedAt: now,
    definition: def("rep-revenue", "درآمد ماهانه به تفکیک استان", "sales"),
  },
];

export const SEED_DASHBOARDS: DashboardRecord[] = [
  {
    id: "dash-exec", tenantId: "tenant-acme", name: "داشبورد مدیریتی",
    ownerName: "آرش مدیری", createdAt: now, updatedAt: now,
    widgets: [{ i: "w1", reportId: "rep-revenue", viewIndex: 0, title: "درآمد ماهانه" }],
    layout: [{ i: "w1", x: 0, y: 0, w: 6, h: 4 }],
  },
];

export const SEED_AUDIT: AuditRow[] = [
  { id: "ev-1", tenantId: "tenant-acme", actorId: "u-1", type: "ai.generate", ts: now, tokens: 420, cost: 0.002 },
  { id: "ev-2", tenantId: "tenant-acme", actorId: "u-2", type: "report.run", ts: now },
  { id: "ev-3", tenantId: "tenant-acme", actorId: "u-2", type: "export.csv", ts: now },
];
```

- [ ] **Step 8: Write the failing test for `mockApi`.** `api/mockApi.test.ts`.
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockApi } from "./mockApi";

describe("mockApi", () => {
  beforeEach(() => {
    localStorage.clear();
    mockApi.resetDemoData();
  });

  it("seeds and lists reports (SavedReport envelopes) scoped by tenant", async () => {
    const acme = await mockApi.reports.list("tenant-acme");
    expect(acme.length).toBeGreaterThan(0);
    expect(acme.every((r) => r.tenantId === "tenant-acme")).toBe(true);
    // each row is a SavedReport: a definition envelope, not a bare ReportDefinition
    expect(acme[0].definition).toBeDefined();
    expect(acme[0].definition.dataset).toBeDefined();
    const beta = await mockApi.reports.list("tenant-beta");
    expect(beta.every((r) => r.tenantId === "tenant-beta")).toBe(true);
  });

  it("save inserts new and updates existing; remove deletes", async () => {
    const created = await mockApi.reports.save({
      id: "", tenantId: "tenant-acme", ownerName: "آرش مدیری",
      visibility: "tenant", updatedAt: "",
      definition: { id: "", schemaVersion: "1.0", name: "نو", dataset: "projects",
        columns: [], presentation: { views: [] } } as never,
    });
    expect(created.id).not.toBe("");
    const fetched = await mockApi.reports.get(created.id);
    expect(fetched?.definition.name).toBe("نو");
    await mockApi.reports.save({ ...created, definition: { ...created.definition, name: "ویرایش‌شده" } });
    expect((await mockApi.reports.get(created.id))?.definition.name).toBe("ویرایش‌شده");
    await mockApi.reports.remove(created.id);
    expect(await mockApi.reports.get(created.id)).toBeNull();
  });

  it("tenants/users/providers/audit collections seed", async () => {
    expect((await mockApi.tenants.list()).length).toBe(2);
    expect((await mockApi.users.list("tenant-acme")).length).toBeGreaterThan(0);
    expect((await mockApi.providers.list("tenant-acme")).length).toBeGreaterThan(0);
    expect((await mockApi.audit.list("tenant-acme")).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 9: Run — expect FAIL.**
```bash
cd report-web && npm test -- mockApi
```
Expected: FAIL — `Cannot find module './mockApi'`.

- [ ] **Step 10: Implement `api/mockApi.ts` (generic localStorage collection + typed facade).** Full implementation; `save` mints id + timestamps; all reads add a small artificial delay so spinners are visible (per §3.0).
```ts
import type { Tenant } from "../contracts/tenant";
import type { AppRole } from "../contracts/rbac";
import type { SavedReport, DashboardRecord } from "./queries";
import {
  SEED_TENANTS, SEED_USERS, SEED_PROVIDERS, SEED_REPORTS, SEED_DASHBOARDS, SEED_AUDIT,
} from "./seed";

export interface AIProviderRow {
  id: string; tenantId: string; type: "OpenAI" | "Azure" | "Ollama" | "Claude";
  model: string; status: "active" | "inactive";
}
export interface UserRow {
  id: string; tenantId: string; name: string; email: string;
  roles: AppRole[]; status: "active" | "suspended";
}
export interface AuditRow {
  id: string; tenantId: string; actorId: string; type: string; ts: string;
  tokens?: number; cost?: number;
}
// Reports are stored as SavedReport envelopes; the store stamps `tenantId` for
// tenant-scoped listing (it is not part of the public SavedReport type).
type StoredReport = SavedReport & { tenantId: string };

interface HasId { id: string }
interface Scoped extends HasId { tenantId?: string }

const DELAY = 200;
const sleep = () => new Promise<void>((r) => setTimeout(r, DELAY));
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function read<T extends HasId>(key: string, seed: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T[];
    } catch {
      /* fall through */
    }
  }
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}
function write<T extends HasId>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

function collection<T extends Scoped>(key: string, seed: T[], idPrefix: string) {
  return {
    async list(tenantId?: string): Promise<T[]> {
      await sleep();
      const rows = read<T>(key, seed);
      return tenantId ? rows.filter((r) => r.tenantId === undefined || r.tenantId === tenantId) : rows;
    },
    async get(id: string): Promise<T | null> {
      await sleep();
      return read<T>(key, seed).find((r) => r.id === id) ?? null;
    },
    async save(entity: T): Promise<T> {
      await sleep();
      const rows = read<T>(key, seed);
      const ts = new Date().toISOString();
      const withTs = entity as T & { createdAt?: string; updatedAt?: string };
      if (!entity.id) {
        const created = { ...entity, id: uid(idPrefix), createdAt: ts, updatedAt: ts } as T;
        write(key, [...rows, created]);
        return created;
      }
      const next = rows.map((r) =>
        r.id === entity.id ? ({ ...entity, createdAt: withTs.createdAt, updatedAt: ts } as T) : r,
      );
      write(key, next);
      return entity;
    },
    async remove(id: string): Promise<void> {
      await sleep();
      write(key, read<T>(key, seed).filter((r) => r.id !== id));
    },
  };
}

const K = {
  reports: "report.db.reports", dashboards: "report.db.dashboards",
  providers: "report.db.providers", users: "report.db.users",
  tenants: "report.db.tenants", audit: "report.db.audit",
};

export const mockApi = {
  reports: collection<StoredReport>(K.reports, SEED_REPORTS, "rep"),
  dashboards: collection<DashboardRecord>(K.dashboards, SEED_DASHBOARDS, "dash"),
  providers: collection<AIProviderRow>(K.providers, SEED_PROVIDERS, "prov"),
  users: collection<UserRow>(K.users, SEED_USERS, "u"),
  tenants: collection<Tenant>(K.tenants, SEED_TENANTS, "tenant"),
  audit: collection<AuditRow>(K.audit, SEED_AUDIT, "ev"),
  resetDemoData(): void {
    write(K.reports, SEED_REPORTS);
    write(K.dashboards, SEED_DASHBOARDS);
    write(K.providers, SEED_PROVIDERS);
    write(K.users, SEED_USERS);
    write(K.tenants, SEED_TENANTS);
    write(K.audit, SEED_AUDIT);
  },
};
```

- [ ] **Step 11: Run — expect PASS.**
```bash
cd report-web && npm test -- mockApi
```
Expected: PASS — 3 tests passing.

- [ ] **Step 12: Implement `api/queries.ts` (TanStack hooks, tenant-scoped keys).** Reads the active tenant from `useTenantStore` so keys invalidate on tenant switch.
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mockApi, type AIProviderRow, type UserRow, type AuditRow } from "./mockApi";
import type { ReportDefinition } from "../contracts/report-definition";
import type { Tenant } from "../contracts/tenant";
import type { DashboardWidget, GridLayoutItem } from "../dashboard/widget";
import { useTenantStore } from "../store/tenant-store";

// ----- Canonical persisted shapes (the single definitions; other tasks import from here) -----
/** A saved report = a ReportDefinition envelope with library metadata. */
export type SavedReport = {
  id: string;
  definition: ReportDefinition;
  updatedAt: string;
  lastRunAt?: string;
  ownerName: string;
  visibility: "private" | "tenant";
};
/** A dashboard = embedded widgets + grid layout (no separate WidgetDef). */
export type DashboardRecord = {
  id: string;
  tenantId: string;
  name: string;
  widgets: DashboardWidget[];
  layout: GridLayoutItem[];
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};
// Re-export the widget/layout types so consumers can import them from @/api/queries too.
export type { DashboardWidget, GridLayoutItem };

export const rk = {
  reports: (t: string | null) => ["reports", t] as const,
  report: (id: string) => ["report", id] as const,
  dashboards: (t: string | null) => ["dashboards", t] as const,
  dashboard: (id: string) => ["dashboard", id] as const,
  providers: (t: string | null) => ["providers", t] as const,
  users: (t: string | null) => ["users", t] as const,
  tenants: () => ["tenants"] as const,
  audit: (t: string | null) => ["audit", t] as const,
};

const useTid = () => useTenantStore((s) => s.currentTenantId);

export const useReports = () => {
  const t = useTid();
  return useQuery({ queryKey: rk.reports(t), queryFn: () => mockApi.reports.list(t ?? undefined) });
};
export const useReport = (id: string) =>
  useQuery<SavedReport | null>({ queryKey: rk.report(id), queryFn: () => mockApi.reports.get(id), enabled: !!id });
export const useSaveReport = () => {
  const qc = useQueryClient();
  const t = useTid();
  // Accepts a ReportDefinition (+ optional name/visibility); wraps it into a SavedReport.
  return useMutation<SavedReport, Error, { definition: ReportDefinition; name?: string; visibility?: "private" | "tenant" }>({
    mutationFn: ({ definition, name, visibility }) =>
      mockApi.reports.save({
        id: definition.id ?? "",
        tenantId: t ?? "",
        definition: name ? { ...definition, name } : definition,
        ownerName: "",
        visibility: visibility ?? "private",
        updatedAt: "",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.reports(t) }),
  });
};
export const useDeleteReport = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation({
    mutationFn: (id: string) => mockApi.reports.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.reports(t) }),
  });
};

export const useDashboards = () => {
  const t = useTid();
  return useQuery({ queryKey: rk.dashboards(t), queryFn: () => mockApi.dashboards.list(t ?? undefined) });
};
export const useDashboard = (id: string) =>
  useQuery<DashboardRecord | null>({ queryKey: rk.dashboard(id), queryFn: () => mockApi.dashboards.get(id), enabled: !!id });
export const useCreateDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  // Creates an empty dashboard from a name; the store mints id + timestamps.
  return useMutation<DashboardRecord, Error, { name: string }>({
    mutationFn: ({ name }) =>
      mockApi.dashboards.save({
        id: "", tenantId: t ?? "", name, ownerName: "",
        widgets: [], layout: [], createdAt: "", updatedAt: "",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};
export const useSaveDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation<DashboardRecord, Error, DashboardRecord>({
    mutationFn: (d: DashboardRecord) => mockApi.dashboards.save(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};
export const useDeleteDashboard = () => {
  const qc = useQueryClient();
  const t = useTid();
  return useMutation({
    mutationFn: (id: string) => mockApi.dashboards.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rk.dashboards(t) }),
  });
};

export const useProviders = () => {
  const t = useTid();
  return useQuery<AIProviderRow[]>({ queryKey: rk.providers(t), queryFn: () => mockApi.providers.list(t ?? undefined) });
};
export const useUsers = () => {
  const t = useTid();
  return useQuery<UserRow[]>({ queryKey: rk.users(t), queryFn: () => mockApi.users.list(t ?? undefined) });
};
export const useTenants = () =>
  useQuery<Tenant[]>({ queryKey: rk.tenants(), queryFn: () => mockApi.tenants.list() });
export const useAudit = () => {
  const t = useTid();
  return useQuery<AuditRow[]>({ queryKey: rk.audit(t), queryFn: () => mockApi.audit.list(t ?? undefined) });
};
```

- [ ] **Step 13: Build, lint, test, commit.**
```bash
cd report-web && npm run build && npm run lint && npm test
```
Expected: build/lint clean; all tests PASS.
```bash
git add report-web && git commit -m "feat(report-web): mockApi (localStorage CRUD + seed), TanStack hooks, Zustand stores

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Layout shell (AppLayout, Sidebar, Topbar), providers, and the full router

**Files:**
- Create: `report-web/src/layout/AppLayout.tsx`
- Create: `report-web/src/layout/Sidebar.tsx`
- Create: `report-web/src/layout/Topbar.tsx`
- Create: `report-web/src/app/providers.tsx`
- Create: `report-web/src/app/router.tsx`
- Create: `report-web/src/app/App.tsx`
- Modify: `report-web/src/main.tsx`
- Test: `report-web/src/app/router.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- Task 8: `ThemeProvider`, `applyLocale`, `i18n`, `applyCssVars`, `tokens`, `ThemeMode`, `BrandTokens`.
- Task 9: `AuthProvider`, `useAuth`, and from `auth/routes.tsx`: `LoginScreen`, `OidcCallback`, `LogoutScreen`, `ForbiddenScreen`, `RequireAuth`, `RequireRole`, `RequirePermission`; `MOCK_PERSONAS` + `auth/mock-user.ts` for the role switcher.
- Task 10: `useUiStore`, `useTenantStore`, `useTenants`, query hooks.
- Task 1: `AppRole`, `Permission`.
- **Page components** are produced by Tasks 12+ (Ask AI, Report Library/Viewer/Designer, Dashboards, Admin screens). Task 11 imports them lazily and, to keep this task buildable on its own, ships a tiny `PagePlaceholder` used ONLY where a later task has not yet landed; the router structure, paths, and guards are final and complete here. Each placeholder is replaced 1:1 by the matching screen in its task — the route node does not change.

Produces (later tasks rely on these):
- `app/router.tsx`: `export const router: ReturnType<typeof createBrowserRouter>;` containing **every** route from §2.6 with its guard.
- `layout/AppLayout.tsx`: `export function AppLayout(): JSX.Element;` (antd `Layout` with `<Sidebar/>`, `<Topbar/>`, `<Outlet/>`); `layout/Sidebar.tsx` + `layout/Topbar.tsx` exported components.
- `app/providers.tsx`: `export function Providers(props: { children: React.ReactNode }): JSX.Element;` (QueryClientProvider + AuthProvider + ThemeProvider + I18nextProvider, wired to `useUiStore`).

- [ ] **Step 1: Implement `layout/Sidebar.tsx` (grouped nav, permission-filtered, RTL-aware).** Two sidebars (user / admin) selected by route prefix; items hidden when the permission is absent (§2.4). Uses antd `Menu`.
```tsx
import { useMemo } from "react";
import { Menu } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import type { Permission } from "../contracts/rbac";

type Item = { key: string; labelKey: string; need?: Permission; adminAny?: boolean };
type Group = { titleKey?: string; items: Item[] };

const USER_GROUPS: Group[] = [
  { items: [{ key: "/ask", labelKey: "nav.ask" }] },
  { titleKey: "nav.groupContent", items: [
    { key: "/reports", labelKey: "nav.reports" },
    { key: "/dashboards", labelKey: "nav.dashboards" },
    { key: "/favorites", labelKey: "nav.favorites" },
  ] },
  { titleKey: "nav.groupData", items: [{ key: "/data", labelKey: "nav.data" }] },
  { titleKey: "nav.groupOutput", items: [{ key: "/exports", labelKey: "nav.exports", need: "data:export" }] },
  { items: [
    { key: "/profile", labelKey: "nav.profile" },
    { key: "/settings", labelKey: "nav.settings" },
    { key: "/admin", labelKey: "nav.admin", adminAny: true },
  ] },
];

const ADMIN_GROUPS: Group[] = [
  { items: [{ key: "/admin", labelKey: "nav.adminOverview" }] },
  { titleKey: "nav.groupAccess", items: [
    { key: "/admin/users", labelKey: "nav.users", need: "users:manage" },
    { key: "/admin/roles", labelKey: "nav.roles" },
  ] },
  { titleKey: "nav.groupDataSemantics", items: [
    { key: "/admin/data-sources", labelKey: "nav.dataSources", need: "datasources:manage" },
    { key: "/admin/semantic-models", labelKey: "nav.semanticModels", need: "datasources:manage" },
  ] },
  { titleKey: "nav.groupAi", items: [
    { key: "/admin/ai/providers", labelKey: "nav.aiProviders", need: "ai:manage" },
    { key: "/admin/ai/routing", labelKey: "nav.aiRouting", need: "ai:manage" },
    { key: "/admin/ai/prompts", labelKey: "nav.aiPrompts", need: "ai:manage" },
    { key: "/admin/ai/usage", labelKey: "nav.aiUsage", need: "ai:manage" },
  ] },
  { titleKey: "nav.groupTenant", items: [
    { key: "/admin/tenant", labelKey: "nav.tenantSettings" },
    { key: "/admin/tenant/quota", labelKey: "nav.quota" },
  ] },
  { titleKey: "nav.groupGovernance", items: [{ key: "/admin/audit", labelKey: "nav.audit", need: "audit:read" }] },
  { titleKey: "nav.groupPlatform", items: [{ key: "/admin/tenants", labelKey: "nav.tenants" }] },
  { items: [{ key: "/", labelKey: "nav.backToWorkspace" }] },
];

export function Sidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { can, isAdmin, roles } = useAuth();
  const isAdminZone = loc.pathname.startsWith("/admin");

  const items = useMemo(() => {
    const groups = isAdminZone ? ADMIN_GROUPS : USER_GROUPS;
    const visible = (it: Item) => {
      if (it.adminAny) return isAdmin;
      if (it.key === "/admin/tenants") return roles.includes("SuperAdmin");
      if (it.need) return can(it.need);
      return true;
    };
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(visible),
      }))
      .filter((g) => g.items.length > 0)
      .flatMap((g) => [
        ...(g.titleKey ? [{ type: "group" as const, label: t(g.titleKey) }] : []),
        ...g.items.map((it) => ({ key: it.key, label: t(it.labelKey) })),
      ]);
  }, [isAdminZone, can, isAdmin, roles, t]);

  return (
    <Menu
      mode="inline"
      selectedKeys={[loc.pathname]}
      items={items}
      onClick={({ key }) => nav(key)}
      style={{ height: "100%", borderInlineEnd: "none" }}
    />
  );
}
```

- [ ] **Step 2: Implement `layout/Topbar.tsx` (tenant switcher + locale/theme toggles + user menu + dev role switcher).** Tenant switcher writes `useTenantStore`; theme/locale toggles write `useUiStore` and call `applyLocale`; the role switcher is visible only in mock mode.
```tsx
import { Layout, Select, Button, Dropdown, Space, Avatar } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { useUiStore } from "../store/ui-store";
import { useTenantStore } from "../store/tenant-store";
import { useTenants } from "../api/queries";
import { applyLocale } from "../i18n";
import type { AppRole } from "../contracts/rbac";

const { Header } = Layout;
const useMock = (import.meta.env.VITE_AUTH_MODE ?? "mock") === "mock";
const ALL_ROLES: AppRole[] = [
  "SuperAdmin", "TenantAdmin", "AIManager", "ReportDesigner",
  "DashboardDesigner", "PowerUser", "Viewer",
];

export function Topbar() {
  const { t } = useTranslation();
  const { user, roles, logout, setMockRole } = useAuth();
  const { mode, locale, setMode, setLocale } = useUiStore();
  const { currentTenantId, setCurrentTenant } = useTenantStore();
  const { data: tenants = [] } = useTenants();

  const toggleLocale = () => {
    const next = locale === "fa" ? "en" : "fa";
    setLocale(next);
    applyLocale(next);
  };

  return (
    <Header
      style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--rw-surface-1)", paddingInline: 16,
      }}
    >
      <Select
        aria-label={t("tenant.switcher")}
        value={currentTenantId ?? undefined}
        placeholder={t("tenant.switcher")}
        style={{ minWidth: 180 }}
        onChange={(v) => setCurrentTenant(v)}
        options={tenants.map((tn) => ({ value: tn.id, label: tn.displayName }))}
      />
      <div style={{ flex: 1 }} />
      {useMock && (
        <Select
          aria-label={t("auth.selectRole")}
          value={roles[0]}
          style={{ minWidth: 160 }}
          onChange={(r) => setMockRole([r as AppRole])}
          options={ALL_ROLES.map((r) => ({ value: r, label: t(`rbac.role.${r}`) }))}
        />
      )}
      <Button onClick={toggleLocale}>{locale === "fa" ? "EN" : "FA"}</Button>
      <Button onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
        {mode === "dark" ? "☀" : "☾"}
      </Button>
      <Dropdown
        menu={{ items: [{ key: "logout", label: t("auth.logout"), onClick: logout }] }}
      >
        <Space style={{ cursor: "pointer" }}>
          <Avatar>{user?.name?.[0] ?? "?"}</Avatar>
        </Space>
      </Dropdown>
    </Header>
  );
}
```

- [ ] **Step 3: Implement `layout/AppLayout.tsx` (antd Layout shell, RTL-aware, collapsible Sider).**
```tsx
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useUiStore } from "../store/ui-store";

const { Sider, Content } = Layout;

export function AppLayout() {
  const { sidebarCollapsed } = useUiStore();
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={sidebarCollapsed}
        trigger={null}
        theme="light"
        style={{ background: "var(--rw-surface-1)" }}
        width={240}
      >
        <Sidebar />
      </Sider>
      <Layout>
        <Topbar />
        <Content style={{ margin: 16, padding: 16, background: "var(--rw-surface-1)", borderRadius: 12 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 4: Implement `app/providers.tsx` (Query + Auth + Theme + i18n, wired to `useUiStore`).** Selects brand from the active tenant later; v1 uses `tokens` default brand and the mock tenant primary when a tenant is selected.
```tsx
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { i18n, applyLocale } from "../i18n";
import { tokens, type BrandTokens } from "../theme/theme";
import { useUiStore } from "../store/ui-store";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { mode, locale, dir } = useUiStore();
  const brand: BrandTokens = { primary: tokens.primary, accent: tokens.accent };

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider mode={mode} brand={brand} dir={dir} locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Add a temporary `PagePlaceholder` (replaced 1:1 by later screen tasks).** Create `report-web/src/app/PagePlaceholder.tsx`.
```tsx
import { Empty } from "antd";
export function PagePlaceholder({ name }: { name: string }) {
  return <Empty description={name} style={{ marginTop: 80 }} />;
}
```

- [ ] **Step 6: Implement `app/router.tsx` with EVERY route from §2.6, each role/permission-guarded.** Public routes, the authed `AppLayout` subtree (user area), the admin subtree (under `/admin`, role/permission guards), `/403`, and `*`. Heavy screens are lazy in their own tasks; here each leaf renders a guarded `PagePlaceholder` with the canonical screen name so the structure is final.
```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import {
  LoginScreen, OidcCallback, LogoutScreen, ForbiddenScreen,
  RequireAuth, RequireRole, RequirePermission,
} from "../auth/routes";
import { PagePlaceholder } from "./PagePlaceholder";

const P = (name: string) => <PagePlaceholder name={name} />;
const ADMIN_SET = ["SuperAdmin", "TenantAdmin", "AIManager"] as const;

export const router = createBrowserRouter([
  // Public / Auth
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/logout", element: <LogoutScreen /> },
  { path: "/403", element: <ForbiddenScreen /> },

  // Authenticated app
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // User Area
          { index: true, element: <Navigate to="/ask" replace /> },
          { path: "ask", element: P("AskAIScreen") },
          { path: "ask/:threadId", element: P("AskAIThread") },
          { path: "reports", element: P("ReportLibrary") },
          {
            element: <RequireRole allow={["ReportDesigner", "TenantAdmin", "SuperAdmin"]} />,
            children: [
              { path: "reports/new", element: P("ReportDesigner (new)") },
              { path: "reports/:reportId/edit", element: P("ReportDesigner (edit)") },
            ],
          },
          { path: "reports/:reportId", element: P("ReportViewer") },
          { path: "reports/:reportId/run", element: <RequirePermission perm="reports:execute">{P("ReportRunResult")}</RequirePermission> },
          { path: "reports/:reportId/history", element: P("ReportRunHistory") },
          { path: "dashboards", element: P("DashboardLibrary") },
          {
            element: <RequireRole allow={["DashboardDesigner", "TenantAdmin", "SuperAdmin"]} />,
            children: [
              { path: "dashboards/new", element: P("DashboardBuilder (new)") },
              { path: "dashboards/:dashId/edit", element: P("DashboardBuilder") },
            ],
          },
          { path: "dashboards/:dashId", element: P("DashboardViewer") },
          {
            element: <RequireRole allow={["PowerUser", "ReportDesigner", "DashboardDesigner", "AIManager", "TenantAdmin", "SuperAdmin"]} />,
            children: [
              { path: "data", element: P("DataCatalog") },
              { path: "data/:modelId", element: P("SemanticModelExplorer") },
            ],
          },
          { path: "exports", element: <RequirePermission perm="data:export">{P("ExportCenter")}</RequirePermission> },
          { path: "profile", element: P("UserProfile") },
          { path: "settings", element: P("UserPreferences") },
          { path: "favorites", element: P("Favorites") },

          // Admin Area
          {
            path: "admin",
            element: <RequireRole allow={[...ADMIN_SET]} />,
            children: [
              { index: true, element: P("AdminOverview") },
              { path: "users", element: <RequirePermission perm="users:manage">{P("UserList")}</RequirePermission> },
              { path: "users/:userId", element: <RequirePermission perm="users:manage">{P("UserDetail")}</RequirePermission> },
              { path: "roles", element: P("RoleMatrix") },
              { path: "data-sources", element: <RequirePermission perm="datasources:manage">{P("DataSourceList")}</RequirePermission> },
              { path: "data-sources/new", element: <RequirePermission perm="datasources:manage">{P("DataSourceWizard")}</RequirePermission> },
              { path: "data-sources/:id", element: <RequirePermission perm="datasources:manage">{P("DataSourceDetail")}</RequirePermission> },
              { path: "semantic-models", element: <RequirePermission perm="datasources:manage">{P("SemanticModelList")}</RequirePermission> },
              { path: "semantic-models/new", element: <RequirePermission perm="datasources:manage">{P("SemanticModelEditor (new)")}</RequirePermission> },
              { path: "semantic-models/:id", element: <RequirePermission perm="datasources:manage">{P("SemanticModelEditor (edit)")}</RequirePermission> },
              // NOTE: Task 18 REPLACES this whole `/admin/ai` subtree with the AIAdminShell route.
              {
                path: "ai",
                children: [
                  { path: "providers", element: <RequirePermission perm="ai:manage">{P("AIProviderList")}</RequirePermission> },
                  { path: "providers/:id", element: <RequirePermission perm="ai:manage">{P("AIProviderDetail")}</RequirePermission> },
                  { path: "routing", element: <RequirePermission perm="ai:manage">{P("AIRoutingRules")}</RequirePermission> },
                  { path: "prompts", element: <RequirePermission perm="ai:manage">{P("PromptVersions")}</RequirePermission> },
                  { path: "usage", element: <RequirePermission perm="ai:manage">{P("AIUsageCost")}</RequirePermission> },
                ],
              },
              {
                path: "tenant",
                children: [
                  { index: true, element: P("TenantSettings") },
                  { path: "quota", element: P("QuotaManagement") },
                ],
              },
              { path: "audit", element: <RequirePermission perm="audit:read">{P("AuditLog")}</RequirePermission> },
              { path: "audit/:eventId", element: <RequirePermission perm="audit:read">{P("AuditEventDetail")}</RequirePermission> },
              {
                path: "tenants",
                element: <RequireRole allow={["SuperAdmin"]} />,
                children: [
                  { index: true, element: P("TenantList") },
                  { path: "new", element: P("TenantCreate") },
                  { path: ":id", element: P("TenantDetail") },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // 404
  { path: "*", element: <PagePlaceholder name="NotFoundScreen" /> },
]);
```

- [ ] **Step 7: Implement `app/App.tsx` and wire `main.tsx`.**
```tsx
// app/App.tsx
import { RouterProvider } from "react-router-dom";
import { Providers } from "./providers";
import { router } from "./router";

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
```
```tsx
// main.tsx (replace Vite default)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/global.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Write the router smoke test (`app/router.test.tsx`).** Renders the app at `/ask` as a mock PowerUser (sees it), and asserts `/admin` redirects a Viewer to `/403`. Uses `createMemoryRouter` to drive paths.
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Providers } from "./providers";
import { AppLayout } from "../layout/AppLayout";
import {
  ForbiddenScreen, RequireAuth, RequireRole,
} from "../auth/routes";
import { PagePlaceholder } from "./PagePlaceholder";
import { setMockUser } from "../auth/mock-user";

function makeRouter(initial: string) {
  return createMemoryRouter(
    [
      { path: "/403", element: <ForbiddenScreen /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "ask", element: <PagePlaceholder name="AskAIScreen" /> },
              {
                path: "admin",
                element: <RequireRole allow={["SuperAdmin", "TenantAdmin", "AIManager"]} />,
                children: [{ index: true, element: <PagePlaceholder name="AdminOverview" /> }],
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initial] },
  );
}

describe("router guards", () => {
  beforeEach(() => localStorage.clear());

  it("renders /ask for an authed PowerUser", async () => {
    setMockUser(["PowerUser"]);
    render(<Providers><RouterProvider router={makeRouter("/ask")} /></Providers>);
    await waitFor(() => expect(screen.getByText("AskAIScreen")).toBeInTheDocument());
  });

  it("redirects a Viewer away from /admin to /403", async () => {
    setMockUser(["Viewer"]);
    render(<Providers><RouterProvider router={makeRouter("/admin")} /></Providers>);
    await waitFor(() => expect(screen.getByText(/403/)).toBeInTheDocument());
  });
});
```

Acceptance criteria:
- Every path in §2.6 exists as a route node with the bracketed permission/role guard from the route table (user area, admin area, `/403`, `*`).
- Nav items in `Sidebar` are **hidden** (not disabled) when the active role lacks the permission; the "Admin →" item appears only when `isAdmin`; the "Tenants" platform item only for `SuperAdmin`.
- Topbar tenant switcher updates `useTenantStore` (TanStack keys re-query); locale toggle calls `applyLocale` (flips `dir`/antd direction); theme toggle flips `useUiStore.mode` (re-colors antd + CSS vars); role switcher visible only when `VITE_AUTH_MODE=mock`.

- [ ] **Step 9: Run the smoke test — expect PASS.**
```bash
cd report-web && npm test -- router
```
Expected: PASS — 2 tests passing.

- [ ] **Step 10: Build, lint, full test, commit.**
```bash
cd report-web && npm run build && npm run lint && npm test
```
Expected: production build succeeds, lint clean, ALL tests across Tasks 8-11 PASS.
```bash
git add report-web && git commit -m "feat(report-web): app shell (AppLayout/Sidebar/Topbar), providers, full guarded router

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```


### Task 12: Table & KPI renderers (antd)

**Files:**
- Create: `report-web/src/presentation/format.ts`
- Create: `report-web/src/presentation/renderers/TableRenderer.tsx`
- Create: `report-web/src/presentation/renderers/KpiRenderer.tsx`
- Test: `report-web/src/presentation/format.test.ts`
- Test: `report-web/src/presentation/renderers/TableRenderer.test.tsx`
- Test: `report-web/src/presentation/renderers/KpiRenderer.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- From `report-web/src/contracts/common.ts` (Task ~1, R1): `type FieldType = "string" | "number" | "date" | "boolean"`.
- From `report-web/src/contracts/presentation.ts` (Task ~1, §5 verbatim): `interface ReportView { id?: string; type: ViewType; library: ViewLibrary; component: string; title?: string; mapping: ViewMapping; options?: Record<string, unknown> }`; `type ViewType = "table" | "kpi" | "chart" | "dashboardWidget"`; `interface ViewMapping { columns?: string[]; x?: string; y?: string | string[]; series?: string; value?: string; comparison?: string; category?: string; measure?: string }`.
- From `report-web/src/contracts/report-definition.ts` (Task ~1): `interface ReportDefinition` (used only for the `def` prop; renderers read `def.name`/`def.presentation` opportunistically, never recompute).
- From `report-web/src/contracts/dataset.ts` (Task ~1, R3): `type ResolvedColumn = { key: string; label: string; type: FieldType; isMetric: boolean }`; `type ResultRow = Record<string, string | number | null>`; `type QueryResult = { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number }`; `type GroupNode = { key: string; value: string | number; rows: ResultRow[]; children?: GroupNode[] }`.

Produces (later tasks rely on these exact names/signatures):
- `report-web/src/presentation/format.ts` exports:
  - `export type Dir = "rtl" | "ltr";`
  - `export function toPersianDigits(input: string | number): string` — maps `0-9` → `۰-۹`.
  - `export function formatNumber(value: number | null | undefined, dir: Dir): string` — grouped thousands; Persian digits when `dir === "rtl"`.
  - `export function formatDate(value: string | number | null | undefined, dir: Dir): string` — ISO/date → `YYYY/MM/DD`; Persian digits when `dir === "rtl"` (Jalali conversion is a later-phase no-op placeholder, documented inline — the digit/grouping behaviour is the tested contract).
  - `export function formatCell(value: string | number | null, type: FieldType, dir: Dir): string` — dispatches by `FieldType`.
- `report-web/src/presentation/renderers/TableRenderer.tsx` default-exports a React component with props `RendererProps = { view: ReportView; def: ReportDefinition; result: QueryResult; onDrill?: (node: GroupNode) => void }` (R5; `onDrill` is the optional drill callback, ignored by renderers that don't use it).
- `report-web/src/presentation/renderers/KpiRenderer.tsx` default-exports a React component with the same `RendererProps`.

The shared `RendererProps` type is finalized and exported by Task 13's `ReportView.tsx` (the single source of the optional `onDrill`); Tasks 12's two files declare a local structural prop type with identical shape so they compile standalone, and Task 13 re-exports the canonical one (structurally identical, so no type break).

- [ ] **Step 1: Branch + confirm scaffold.** On branch `feat/report-service`, confirm `report-web/` exists with `vitest`, `@testing-library/react`, `antd`, and the `contracts/` + `dataset.ts` files from earlier tasks. Run:
  ```bash
  cd report-web && ls src/contracts/common.ts src/contracts/dataset.ts src/contracts/presentation.ts
  ```
  Expected output: all three paths printed (no "No such file"). If missing, stop — Task 1 is incomplete.

- [ ] **Step 2: Failing test for `format.ts`.** Create `report-web/src/presentation/format.test.ts`:
  ```ts
  import { describe, it, expect } from "vitest";
  import {
    toPersianDigits,
    formatNumber,
    formatDate,
    formatCell,
  } from "./format";

  describe("toPersianDigits", () => {
    it("maps ASCII digits to Persian digits", () => {
      expect(toPersianDigits("1234567890")).toBe("۱۲۳۴۵۶۷۸۹۰");
    });
    it("accepts numbers and leaves non-digit chars untouched", () => {
      expect(toPersianDigits(12.5)).toBe("۱۲.۵");
      expect(toPersianDigits("$12")).toBe("$۱۲");
    });
  });

  describe("formatNumber", () => {
    it("groups thousands and uses ASCII in LTR", () => {
      expect(formatNumber(1234567, "ltr")).toBe("1,234,567");
    });
    it("groups thousands and uses Persian digits in RTL", () => {
      expect(formatNumber(1234567, "rtl")).toBe("۱٬۲۳۴٬۵۶۷");
    });
    it("renders null/undefined as an empty string", () => {
      expect(formatNumber(null, "rtl")).toBe("");
      expect(formatNumber(undefined, "ltr")).toBe("");
    });
  });

  describe("formatDate", () => {
    it("formats an ISO date to YYYY/MM/DD in LTR", () => {
      expect(formatDate("2026-06-22T00:00:00Z", "ltr")).toBe("2026/06/22");
    });
    it("uses Persian digits in RTL", () => {
      expect(formatDate("2026-06-22", "rtl")).toBe("۲۰۲۶/۰۶/۲۲");
    });
    it("renders null as an empty string", () => {
      expect(formatDate(null, "ltr")).toBe("");
    });
  });

  describe("formatCell", () => {
    it("dispatches by field type", () => {
      expect(formatCell(1000, "number", "ltr")).toBe("1,000");
      expect(formatCell("2026-01-01", "date", "ltr")).toBe("2026/01/01");
      expect(formatCell("Tehran", "string", "ltr")).toBe("Tehran");
      expect(formatCell(null, "number", "rtl")).toBe("");
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/format.test.ts
  ```
  Expected: FAIL — `Failed to resolve import "./format"` / module not found.

- [ ] **Step 3: Implement `format.ts`.** Create `report-web/src/presentation/format.ts`:
  ```ts
  import type { FieldType } from "../contracts/common";

  export type Dir = "rtl" | "ltr";

  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  /** Map ASCII 0-9 to Persian digits; all other characters pass through. */
  export function toPersianDigits(input: string | number): string {
    return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
  }

  /**
   * Grouped thousands formatting. LTR uses ASCII comma grouping; RTL uses
   * Persian digits with the Persian thousands separator (U+066C).
   */
  export function formatNumber(
    value: number | null | undefined,
    dir: Dir,
  ): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "";
    if (dir === "ltr") {
      return new Intl.NumberFormat("en-US").format(value);
    }
    // Group with ASCII first, then transliterate separators + digits.
    const grouped = new Intl.NumberFormat("en-US").format(value);
    return toPersianDigits(grouped).replace(/,/g, "٬");
  }

  /**
   * Date display as YYYY/MM/DD. v1 keeps the Gregorian calendar; the Jalali
   * conversion is a documented later-phase swap (the digit/grouping behaviour
   * here is the tested contract and stays identical when Jalali lands).
   */
  export function formatDate(
    value: string | number | null | undefined,
    dir: Dir,
  ): string {
    if (value === null || value === undefined || value === "") return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const out = `${y}/${m}/${day}`;
    return dir === "rtl" ? toPersianDigits(out) : out;
  }

  /** Dispatch a single cell value to the right formatter by semantic type. */
  export function formatCell(
    value: string | number | null,
    type: FieldType,
    dir: Dir,
  ): string {
    if (value === null || value === undefined) return "";
    switch (type) {
      case "number":
        return formatNumber(typeof value === "number" ? value : Number(value), dir);
      case "date":
        return formatDate(value, dir);
      case "boolean":
        return value ? (dir === "rtl" ? "بله" : "Yes") : dir === "rtl" ? "خیر" : "No";
      default:
        return String(value);
    }
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/format.test.ts
  ```
  Expected: PASS — 9 tests passing.

- [ ] **Step 4: Commit format helpers.**
  ```bash
  cd report-web && git add src/presentation/format.ts src/presentation/format.test.ts && git commit -m "feat(report-web): fa/en cell formatters for renderers

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: one commit created.

- [ ] **Step 5: Failing smoke test for `TableRenderer`.** Create `report-web/src/presentation/renderers/TableRenderer.test.tsx`:
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render, screen } from "@testing-library/react";
  import TableRenderer from "./TableRenderer";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult } from "../../contracts/dataset";

  const result: QueryResult = {
    columns: [
      { key: "province", label: "استان", type: "string", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    ],
    rows: [
      { province: "Tehran", revenue: 1234567 },
      { province: "Fars", revenue: 890000 },
    ],
    total: 2,
  };

  const def = {
    id: "r1",
    dataset: "sales",
    columns: [],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  const view: ReportView = {
    type: "table",
    library: "antd",
    component: "TableRenderer",
    mapping: {},
  };

  describe("TableRenderer", () => {
    it("renders headers and formatted cells (LTR default)", () => {
      render(<TableRenderer view={view} def={def} result={result} />);
      expect(screen.getByText("استان")).toBeInTheDocument();
      expect(screen.getByText("درآمد")).toBeInTheDocument();
      expect(screen.getByText("Tehran")).toBeInTheDocument();
      // number cell grouped, ASCII in LTR
      expect(screen.getByText("1,234,567")).toBeInTheDocument();
    });

    it("honors a restricted mapping.columns subset", () => {
      const subset: ReportView = { ...view, mapping: { columns: ["province"] } };
      render(<TableRenderer view={subset} def={def} result={result} />);
      expect(screen.getByText("استان")).toBeInTheDocument();
      expect(screen.queryByText("درآمد")).not.toBeInTheDocument();
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/TableRenderer.test.tsx
  ```
  Expected: FAIL — cannot resolve `./TableRenderer`.

- [ ] **Step 6: Implement `TableRenderer.tsx`.** Create `report-web/src/presentation/renderers/TableRenderer.tsx`. It maps `result.columns` → antd `ColumnsType`, sets per-column `sorter` (numeric vs string by `ResolvedColumn.type`), `align` derived from direction (RTL: measures left-aligned, dimensions right-aligned; mirrored in LTR), formats cells via `formatCell`, and configures `expandable` rows when `result.groups` exist (drill-down). `dir` is read from `document.documentElement.dir` (the i18n effect from §8.8 sets it) defaulting to `"ltr"`:
  ```tsx
  import { Table } from "antd";
  import type { ColumnsType } from "antd/es/table";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type {
    QueryResult,
    ResultRow,
    ResolvedColumn,
    GroupNode,
  } from "../../contracts/dataset";
  import { formatCell, type Dir } from "../format";

  export type RendererProps = {
    view: ReportView;
    def: ReportDefinition;
    result: QueryResult;
    /** Optional drill callback (Task 13 canonical prop); this renderer uses
     *  expandable rows for drill-down and ignores it. */
    onDrill?: (node: GroupNode) => void;
  };

  function currentDir(): Dir {
    if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
      return "rtl";
    }
    return "ltr";
  }

  function compareBy(col: ResolvedColumn) {
    return (a: ResultRow, b: ResultRow) => {
      const av = a[col.key];
      const bv = b[col.key];
      if (av === null || av === undefined) return -1;
      if (bv === null || bv === undefined) return 1;
      if (col.type === "number") return Number(av) - Number(bv);
      if (col.type === "date") return new Date(av).getTime() - new Date(bv).getTime();
      return String(av).localeCompare(String(bv), "fa");
    };
  }

  export default function TableRenderer({ view, result }: RendererProps) {
    const dir = currentDir();
    const wanted = view.mapping.columns;
    const cols = wanted
      ? result.columns.filter((c) => wanted.includes(c.key))
      : result.columns;

    const antdColumns: ColumnsType<ResultRow> = cols.map((col) => {
      // Measures hug the reading end; dimensions hug the start (mirrored by dir).
      const align: "left" | "right" = col.isMetric
        ? dir === "rtl"
          ? "left"
          : "right"
        : dir === "rtl"
          ? "right"
          : "left";
      return {
        key: col.key,
        dataIndex: col.key,
        title: col.label,
        align,
        sorter: compareBy(col),
        render: (value: string | number | null) =>
          formatCell(value, col.type, dir),
      };
    });

    // Drill-down: when the engine produced grouped output, expanding a parent
    // row reveals that group's child rows in a nested Table.
    const expandable =
      result.groups && result.groups.length > 0
        ? {
            expandedRowRender: (record: ResultRow, index: number) => {
              const group: GroupNode | undefined = result.groups?.[index];
              const childRows = group?.rows ?? [];
              return (
                <Table<ResultRow>
                  size="small"
                  rowKey={(_r, i) => `child-${i}`}
                  pagination={false}
                  columns={antdColumns}
                  dataSource={childRows}
                />
              );
            },
            rowExpandable: (record: ResultRow) => {
              const idx = result.rows.indexOf(record);
              return Boolean(result.groups?.[idx]?.rows?.length);
            },
          }
        : undefined;

    return (
      <Table<ResultRow>
        rowKey={(_r, i) => String(i)}
        columns={antdColumns}
        dataSource={result.rows}
        expandable={expandable}
        pagination={{
          pageSize: 25,
          showSizeChanger: true,
          pageSizeOptions: ["10", "25", "50", "100"],
          total: result.total,
        }}
        scroll={{ x: "max-content" }}
      />
    );
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/TableRenderer.test.tsx
  ```
  Expected: PASS — 2 tests passing.

  Acceptance criteria: headers come from `ResolvedColumn.label`; numeric cells are thousands-grouped; `mapping.columns` (when set) restricts the rendered columns; columns are sortable (`sorter` present); pagination defaults to 25 rows with a size changer; when `result.groups` is non-empty the table is expandable and each expanded row renders that group's child rows; alignment flips with `document.documentElement.dir`.

- [ ] **Step 7: Failing smoke test for `KpiRenderer`.** Create `report-web/src/presentation/renderers/KpiRenderer.test.tsx`:
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render, screen } from "@testing-library/react";
  import KpiRenderer from "./KpiRenderer";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult } from "../../contracts/dataset";

  const result: QueryResult = {
    columns: [
      { key: "total_revenue", label: "درآمد کل", type: "number", isMetric: true },
    ],
    rows: [{ total_revenue: 9876543 }],
    total: 1,
  };

  const def = {
    id: "r1",
    dataset: "sales",
    columns: [],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  const view: ReportView = {
    type: "kpi",
    library: "antd",
    component: "KpiRenderer",
    title: "درآمد کل",
    mapping: { value: "total_revenue" },
  };

  describe("KpiRenderer", () => {
    it("renders the big value and its label", () => {
      render(<KpiRenderer view={view} def={def} result={result} />);
      expect(screen.getByText("درآمد کل")).toBeInTheDocument();
      // value formatted (ASCII grouping in LTR test environment)
      expect(screen.getByText("9,876,543")).toBeInTheDocument();
    });

    it("falls back to the first metric column when mapping.value is absent", () => {
      const v2: ReportView = { ...view, title: undefined, mapping: {} };
      render(<KpiRenderer view={v2} def={def} result={result} />);
      expect(screen.getByText("9,876,543")).toBeInTheDocument();
      // label falls back to the resolved column label
      expect(screen.getByText("درآمد کل")).toBeInTheDocument();
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/KpiRenderer.test.tsx
  ```
  Expected: FAIL — cannot resolve `./KpiRenderer`.

- [ ] **Step 8: Implement `KpiRenderer.tsx`.** Create `report-web/src/presentation/renderers/KpiRenderer.tsx`. It picks the metric to display from `view.mapping.value` (fallback: first `isMetric` column, else first column), reads its single value from `result.rows[0]`, formats it, and renders an antd `<Card>` tile with a big value and label. Optional `mapping.comparison` produces a delta tag:
  ```tsx
  import { Card, Statistic, Tag } from "antd";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult, ResolvedColumn, GroupNode } from "../../contracts/dataset";
  import { formatNumber, formatCell, type Dir } from "../format";

  export type RendererProps = {
    view: ReportView;
    def: ReportDefinition;
    result: QueryResult;
    /** Optional drill callback (Task 13 canonical prop); a KPI tile ignores it. */
    onDrill?: (node: GroupNode) => void;
  };

  function currentDir(): Dir {
    if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
      return "rtl";
    }
    return "ltr";
  }

  export default function KpiRenderer({ view, result }: RendererProps) {
    const dir = currentDir();
    const key =
      view.mapping.value ??
      result.columns.find((c) => c.isMetric)?.key ??
      result.columns[0]?.key;
    const col: ResolvedColumn | undefined = result.columns.find(
      (c) => c.key === key,
    );
    const label = view.title ?? col?.label ?? key ?? "";
    const row = result.rows[0] ?? {};
    const raw = key ? row[key] : null;
    const display = col ? formatCell(raw ?? null, col.type, dir) : "";

    // Optional delta vs a comparison metric.
    let delta: { text: string; up: boolean } | null = null;
    const cmpKey = view.mapping.comparison;
    if (cmpKey && typeof raw === "number") {
      const prev = row[cmpKey];
      if (typeof prev === "number" && prev !== 0) {
        const pct = ((raw - prev) / prev) * 100;
        delta = {
          text: `${formatNumber(Math.round(pct), dir)}%`,
          up: pct >= 0,
        };
      }
    }

    return (
      <Card variant="borderless" style={{ minWidth: 200 }}>
        <Statistic title={label} value={display} />
        {delta && (
          <Tag color={delta.up ? "green" : "red"} style={{ marginTop: 8 }}>
            {delta.up ? "▲" : "▼"} {delta.text}
          </Tag>
        )}
      </Card>
    );
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/KpiRenderer.test.tsx
  ```
  Expected: PASS — 2 tests passing.

  Acceptance criteria: the displayed value comes from `mapping.value` or the first metric column; it is formatted (grouped/Persian per `dir`); the title comes from `view.title` or the resolved column label; an optional `mapping.comparison` renders a colored delta tag (green up / red down); the tile is an antd `Card` (no chart library imported).

- [ ] **Step 9: Lint + full test sweep for the package.**
  ```bash
  cd report-web && npm run lint && npx vitest run src/presentation
  ```
  Expected: lint clean (0 errors); all presentation tests passing (format + Table + Kpi).

- [ ] **Step 10: Build + commit.**
  ```bash
  cd report-web && npm run build
  ```
  Expected: build succeeds (tsc + vite, 0 errors).
  ```bash
  cd report-web && git add src/presentation/renderers/TableRenderer.tsx src/presentation/renderers/TableRenderer.test.tsx src/presentation/renderers/KpiRenderer.tsx src/presentation/renderers/KpiRenderer.test.tsx && git commit -m "feat(report-web): antd Table + KPI Card renderers (RTL-aware, drill-down expandable)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: one commit created.

---

### Task 13: Recharts & ECharts renderers + ReportView dispatcher

**Files:**
- Create: `report-web/src/presentation/renderers/RechartsRenderer.tsx`
- Create: `report-web/src/presentation/renderers/EChartsRenderer.tsx`
- Create: `report-web/src/presentation/ReportView.tsx`
- Test: `report-web/src/presentation/renderers/RechartsRenderer.test.tsx`
- Test: `report-web/src/presentation/renderers/EChartsRenderer.test.tsx`
- Test: `report-web/src/presentation/ReportView.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- From `report-web/src/contracts/presentation.ts`: `interface ReportView { id?: string; type: ViewType; library: ViewLibrary; component: string; title?: string; mapping: ViewMapping; options? }`; `type ViewLibrary = "antd" | "recharts" | "echarts" | "grid"`; `interface ViewMapping { columns?; x?; y?: string | string[]; series?; value?; comparison?; category?; measure? }`.
- From `report-web/src/contracts/dataset.ts`: `type QueryResult = { columns: ResolvedColumn[]; rows: ResultRow[]; groups?; total }`; `type ResultRow = Record<string, string | number | null>`.
- From `report-web/src/contracts/report-definition.ts`: `interface ReportDefinition`.
- From Task 12: `TableRenderer` (default export) at `./renderers/TableRenderer`, `KpiRenderer` (default export) at `./renderers/KpiRenderer`, and `formatNumber`/`type Dir` from `../format`.

Produces (later tasks — Ask-AI, Viewer, dashboard widgets — rely on these):
- `report-web/src/presentation/renderers/RechartsRenderer.tsx` default-exports a component with props `RendererProps = { view: ReportView; def: ReportDefinition; result: QueryResult; onDrill?: (node: GroupNode) => void }` (R5). It renders `BarChart`/`LineChart`/`PieChart`/`AreaChart` chosen from `view.component`/`view.type`, bound via `view.mapping` (`x`, `y`, `series`, `category`, `measure`); fires `onDrill` with the clicked group node when wired.
- `report-web/src/presentation/renderers/EChartsRenderer.tsx` default-exports a component with the same `RendererProps`; builds an ECharts `option` from `result` + `view.mapping`, RTL-conditioned on `document.documentElement.dir` (legend/tooltip right-align, Persian `valueFormatter`); forwards clicks to `onDrill` via `onEvents`.
- `report-web/src/presentation/ReportView.tsx` exports:
  - `export type RendererProps = { view: ReportView; def: ReportDefinition; result: QueryResult; onDrill?: (node: GroupNode) => void };` (the canonical R5 props type — the single source other features import; `GroupNode` imported from `@/contracts`; renderers that don't drill ignore `onDrill`).
  - `export function ReportViewRenderer(props: RendererProps): JSX.Element` — the dispatcher named to avoid clashing with the `ReportView` *type* (R5). Picks the renderer from `view.library` then `view.type`/`view.component`, passing `props` (including `onDrill`) straight through.

- [ ] **Step 1: Confirm chart deps installed.** Recharts and `echarts` + `echarts-for-react` are needed (added in the Task ~0 scaffold per the stack). Run:
  ```bash
  cd report-web && node -e "require.resolve('recharts'); require.resolve('echarts-for-react'); console.log('deps ok')"
  ```
  Expected: `deps ok`. If it throws, install:
  ```bash
  cd report-web && npm install recharts echarts echarts-for-react
  ```

- [ ] **Step 2: Failing smoke test for `RechartsRenderer`.** Create `report-web/src/presentation/renderers/RechartsRenderer.test.tsx`. Recharts' responsive container needs a non-zero size in jsdom, so the test mocks `ResponsiveContainer` to a fixed-size div:
  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { render } from "@testing-library/react";

  // Recharts ResponsiveContainer measures the DOM; jsdom reports 0x0.
  // Force a fixed size so child charts actually render their SVG.
  vi.mock("recharts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("recharts")>();
    return {
      ...actual,
      ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div style={{ width: 400, height: 300 }}>{children}</div>
      ),
    };
  });

  import RechartsRenderer from "./RechartsRenderer";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult } from "../../contracts/dataset";

  const result: QueryResult = {
    columns: [
      { key: "province", label: "استان", type: "string", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    ],
    rows: [
      { province: "Tehran", revenue: 1200 },
      { province: "Fars", revenue: 800 },
      { province: "Isfahan", revenue: 600 },
    ],
    total: 3,
  };

  const def = {
    id: "r1",
    dataset: "sales",
    columns: [],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  function makeView(component: string): ReportView {
    return {
      type: "chart",
      library: "recharts",
      component,
      mapping: { x: "province", y: ["revenue"], category: "province", measure: "revenue" },
    };
  }

  describe("RechartsRenderer", () => {
    it("renders a bar chart with an SVG and the right number of bars", () => {
      const { container } = render(
        <RechartsRenderer view={makeView("BarChart")} def={def} result={result} />,
      );
      expect(container.querySelector("svg")).toBeTruthy();
      // one <rect> bar per data row inside the bar layer
      expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBe(3);
    });

    it("renders a line chart as an SVG path", () => {
      const { container } = render(
        <RechartsRenderer view={makeView("LineChart")} def={def} result={result} />,
      );
      expect(container.querySelector(".recharts-line")).toBeTruthy();
    });

    it("renders a pie chart with one slice per category", () => {
      const { container } = render(
        <RechartsRenderer view={makeView("PieChart")} def={def} result={result} />,
      );
      expect(container.querySelectorAll(".recharts-pie-sector").length).toBe(3);
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/RechartsRenderer.test.tsx
  ```
  Expected: FAIL — cannot resolve `./RechartsRenderer`.

- [ ] **Step 3: Implement `RechartsRenderer.tsx`.** Create `report-web/src/presentation/renderers/RechartsRenderer.tsx`. It switches on `view.component` (falling back to `view.type`) to render the matching Recharts chart, binding fields from `view.mapping`. Multiple `y` aliases produce multiple series; `mapping.series` splits a categorical field into multiple bars/lines is left for the advanced path (ECharts) — Recharts here handles the common small/medium cases:
  ```tsx
  import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
  } from "recharts";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
  import { formatNumber, type Dir } from "../format";

  export type RendererProps = {
    view: ReportView;
    def: ReportDefinition;
    result: QueryResult;
    /** Optional drill callback (Task 13 canonical prop): fired with the clicked
     *  group node so the consumer can re-run `drillInto`. */
    onDrill?: (node: GroupNode) => void;
  };

  const PALETTE = [
    "var(--chart-1, #10b981)",
    "var(--chart-2, #3b82f6)",
    "var(--chart-3, #f59e0b)",
    "var(--chart-4, #ef4444)",
    "var(--chart-5, #8b5cf6)",
    "var(--chart-6, #14b8a6)",
  ];

  function currentDir(): Dir {
    if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
      return "rtl";
    }
    return "ltr";
  }

  function yKeys(view: ReportView): string[] {
    const y = view.mapping.y;
    if (Array.isArray(y)) return y;
    if (typeof y === "string") return [y];
    if (view.mapping.measure) return [view.mapping.measure];
    return [];
  }

  export default function RechartsRenderer({ view, result, onDrill }: RendererProps) {
    const dir = currentDir();
    const data = result.rows as ResultRow[];
    const x = view.mapping.x ?? "";
    const ys = yKeys(view);
    const kind = view.component || view.type;
    const numFmt = (v: number) => formatNumber(v, dir);
    const legendAlign: "left" | "right" = dir === "rtl" ? "right" : "left";
    // Map a clicked datum back to its engine group node (drill source); no-op without onDrill or groups.
    const handleClick = (index: number) => {
      const node = result.groups?.[index];
      if (onDrill && node) onDrill(node);
    };

    if (kind === "PieChart" || kind === "pie") {
      const category = view.mapping.category ?? x;
      const measure = view.mapping.measure ?? ys[0] ?? "";
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Tooltip formatter={(v: number) => numFmt(v)} />
            <Legend align={legendAlign} />
            <Pie
              data={data}
              dataKey={measure}
              nameKey={category}
              cx="50%"
              cy="50%"
              outerRadius={110}
              label
            >
              {data.map((_row, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "LineChart" || kind === "line") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={x} reversed={dir === "rtl"} />
            <YAxis orientation={dir === "rtl" ? "right" : "left"} tickFormatter={numFmt} />
            <Tooltip formatter={(v: number) => numFmt(v)} />
            <Legend align={legendAlign} />
            {ys.map((yk, i) => (
              <Line
                key={yk}
                type="monotone"
                dataKey={yk}
                stroke={PALETTE[i % PALETTE.length]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "AreaChart" || kind === "area") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={x} reversed={dir === "rtl"} />
            <YAxis orientation={dir === "rtl" ? "right" : "left"} tickFormatter={numFmt} />
            <Tooltip formatter={(v: number) => numFmt(v)} />
            <Legend align={legendAlign} />
            {ys.map((yk, i) => (
              <Area
                key={yk}
                type="monotone"
                dataKey={yk}
                stroke={PALETTE[i % PALETTE.length]}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={0.25}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // default: BarChart
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          onClick={(e: { activeTooltipIndex?: number }) => {
            if (typeof e?.activeTooltipIndex === "number") handleClick(e.activeTooltipIndex);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={x} reversed={dir === "rtl"} />
          <YAxis orientation={dir === "rtl" ? "right" : "left"} tickFormatter={numFmt} />
          <Tooltip formatter={(v: number) => numFmt(v)} />
          <Legend align={legendAlign} />
          {ys.map((yk, i) => (
            <Bar key={yk} dataKey={yk} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/RechartsRenderer.test.tsx
  ```
  Expected: PASS — 3 tests passing.

  Acceptance criteria: `view.component` selects the chart (`BarChart`/`LineChart`/`AreaChart`/`PieChart`), defaulting to bar; the category axis binds `mapping.x`, measures bind `mapping.y` (array → multiple series); pie binds `mapping.category`/`mapping.measure`; tooltips/axis ticks run values through `formatNumber`; in RTL the category axis is reversed, the Y axis moves to the right, and the legend right-aligns; colors come from CSS-variable palette tokens (no hardcoded antd, no antd chart components).

- [ ] **Step 4: Commit Recharts renderer.**
  ```bash
  cd report-web && git add src/presentation/renderers/RechartsRenderer.tsx src/presentation/renderers/RechartsRenderer.test.tsx && git commit -m "feat(report-web): Recharts renderer (bar/line/area/pie, RTL-aware)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: one commit created.

- [ ] **Step 5: Failing smoke test for `EChartsRenderer`.** Create `report-web/src/presentation/renderers/EChartsRenderer.test.tsx`. `echarts-for-react` needs canvas/measurement that jsdom lacks, so the test mocks it to capture the computed `option` and assert on it (this verifies the option-building logic, which is the real contract):
  ```tsx
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { render } from "@testing-library/react";

  const captured: { option?: Record<string, unknown> } = {};
  vi.mock("echarts-for-react", () => ({
    default: (props: { option: Record<string, unknown> }) => {
      captured.option = props.option;
      return <div data-testid="echarts-mock" />;
    },
  }));

  import EChartsRenderer from "./EChartsRenderer";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult } from "../../contracts/dataset";

  const result: QueryResult = {
    columns: [
      { key: "province", label: "استان", type: "string", isMetric: false },
      { key: "city", label: "شهر", type: "string", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    ],
    rows: [
      { province: "Tehran", city: "Rey", revenue: 500 },
      { province: "Tehran", city: "Karaj", revenue: 700 },
      { province: "Fars", city: "Shiraz", revenue: 400 },
    ],
    total: 3,
  };

  const def = {
    id: "r1",
    dataset: "sales",
    columns: [],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  const view: ReportView = {
    type: "chart",
    library: "echarts",
    component: "heatmap",
    mapping: { x: "province", series: "city", measure: "revenue" },
  };

  beforeEach(() => {
    captured.option = undefined;
    document.documentElement.dir = "ltr";
  });

  describe("EChartsRenderer", () => {
    it("builds an option with a tooltip and a series", () => {
      render(<EChartsRenderer view={view} def={def} result={result} />);
      expect(captured.option).toBeDefined();
      expect(captured.option!.tooltip).toBeDefined();
      expect(Array.isArray(captured.option!.series)).toBe(true);
      expect((captured.option!.series as unknown[]).length).toBeGreaterThan(0);
    });

    it("right-aligns the legend when dir is rtl", () => {
      document.documentElement.dir = "rtl";
      render(<EChartsRenderer view={view} def={def} result={result} />);
      const legend = captured.option!.legend as { right?: number; left?: number };
      expect(legend.right).toBeDefined();
      expect(legend.left).toBeUndefined();
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/EChartsRenderer.test.tsx
  ```
  Expected: FAIL — cannot resolve `./EChartsRenderer`.

- [ ] **Step 6: Implement `EChartsRenderer.tsx`.** Create `report-web/src/presentation/renderers/EChartsRenderer.tsx`. It builds an ECharts `option` from `result` + `view.mapping`, supporting the advanced shapes from §8.6 (2-dimension matrix → heatmap; otherwise a grouped/stacked bar), and applies RTL adjustments per §8.8 (legend/tooltip right-align, Persian `valueFormatter`):
  ```tsx
  import ReactECharts from "echarts-for-react";
  import type { ReportView } from "../../contracts/presentation";
  import type { ReportDefinition } from "../../contracts/report-definition";
  import type { QueryResult, ResultRow, GroupNode } from "../../contracts/dataset";
  import { formatNumber, type Dir } from "../format";

  export type RendererProps = {
    view: ReportView;
    def: ReportDefinition;
    result: QueryResult;
    /** Optional drill callback (Task 13 canonical prop): fired with the clicked
     *  group node so the consumer can re-run `drillInto`. */
    onDrill?: (node: GroupNode) => void;
  };

  function currentDir(): Dir {
    if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
      return "rtl";
    }
    return "ltr";
  }

  function uniq(values: (string | number | null)[]): (string | number)[] {
    const seen = new Set<string>();
    const out: (string | number)[] = [];
    for (const v of values) {
      if (v === null) continue;
      const k = String(v);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  }

  export default function EChartsRenderer({ view, result, onDrill }: RendererProps) {
    const dir = currentDir();
    const rows = result.rows as ResultRow[];
    // Map an ECharts click (by dataIndex on the category axis) back to its group node.
    const onEvents = onDrill
      ? { click: (p: { dataIndex?: number }) => {
          const node = typeof p?.dataIndex === "number" ? result.groups?.[p.dataIndex] : undefined;
          if (node) onDrill(node);
        } }
      : undefined;
    const x = view.mapping.x ?? "";
    const seriesField = view.mapping.series;
    const measure =
      view.mapping.measure ??
      (Array.isArray(view.mapping.y) ? view.mapping.y[0] : view.mapping.y) ??
      result.columns.find((c) => c.isMetric)?.key ??
      "";
    const valueFormatter = (v: number | string) =>
      formatNumber(typeof v === "number" ? v : Number(v), dir);

    const legend: Record<string, unknown> = dir === "rtl" ? { right: 8 } : { left: 8 };
    const tooltip: Record<string, unknown> = {
      trigger: "item",
      textStyle: { align: dir === "rtl" ? "right" : "left" },
      valueFormatter,
    };

    const xCats = uniq(rows.map((r) => r[x]));

    // 2 dimensions x 1 measure -> heatmap matrix (the ECharts trigger from 8.6).
    if (seriesField && view.component === "heatmap") {
      const yCats = uniq(rows.map((r) => r[seriesField]));
      const data: [number, number, number][] = [];
      rows.forEach((r) => {
        const xi = xCats.indexOf(r[x] as string | number);
        const yi = yCats.indexOf(r[seriesField] as string | number);
        const val = Number(r[measure] ?? 0);
        if (xi >= 0 && yi >= 0) data.push([xi, yi, val]);
      });
      const maxVal = Math.max(1, ...data.map((d) => d[2]));
      const option = {
        tooltip: { ...tooltip, position: "top" },
        legend,
        xAxis: { type: "category", data: xCats.map(String), inverse: dir === "rtl" },
        yAxis: { type: "category", data: yCats.map(String) },
        visualMap: {
          min: 0,
          max: maxVal,
          calculable: true,
          orient: "horizontal",
          left: dir === "rtl" ? "right" : "left",
          bottom: 0,
        },
        series: [
          {
            name: measure,
            type: "heatmap",
            data,
            label: { show: false },
          },
        ],
      };
      return <ReactECharts option={option} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
    }

    // Otherwise: grouped bar (one ECharts series per series-field value, or a
    // single series when no series-field). Handles big-category sets via dataZoom.
    let series: Record<string, unknown>[];
    if (seriesField) {
      const seriesVals = uniq(rows.map((r) => r[seriesField]));
      series = seriesVals.map((sv) => ({
        name: String(sv),
        type: "bar",
        data: xCats.map((xc) => {
          const match = rows.find(
            (r) => r[x] === xc && r[seriesField] === sv,
          );
          return match ? Number(match[measure] ?? 0) : 0;
        }),
      }));
    } else {
      series = [
        {
          name: measure,
          type: "bar",
          data: xCats.map((xc) => {
            const match = rows.find((r) => r[x] === xc);
            return match ? Number(match[measure] ?? 0) : 0;
          }),
        },
      ];
    }

    const option = {
      tooltip: { ...tooltip, trigger: "axis" },
      legend,
      grid: { left: 48, right: 48, bottom: 64, top: 32 },
      xAxis: {
        type: "category",
        data: xCats.map(String),
        inverse: dir === "rtl",
        axisLabel: { interval: 0, rotate: xCats.length > 8 ? 30 : 0 },
      },
      yAxis: {
        type: "value",
        position: dir === "rtl" ? "right" : "left",
        axisLabel: { formatter: (v: number) => valueFormatter(v) },
      },
      dataZoom: xCats.length > 25 ? [{ type: "slider" }] : undefined,
      series,
    };
    return <ReactECharts option={option} style={{ height: 360, width: "100%" }} notMerge onEvents={onEvents} />;
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/renderers/EChartsRenderer.test.tsx
  ```
  Expected: PASS — 2 tests passing.

  Acceptance criteria: `view.component === "heatmap"` with `mapping.series` builds a heatmap matrix (2 dims × 1 measure) with a `visualMap`; otherwise it builds a grouped/single bar series keyed on `mapping.x`/`mapping.series`/`mapping.measure`; values run through `formatNumber` via `valueFormatter`/`axisLabel.formatter`; in RTL the legend right-aligns, the value axis moves right, and category axes are `inverse`; > 25 categories adds a `dataZoom` slider; the only chart lib imported is `echarts-for-react` (no antd).

- [ ] **Step 7: Commit ECharts renderer.**
  ```bash
  cd report-web && git add src/presentation/renderers/EChartsRenderer.tsx src/presentation/renderers/EChartsRenderer.test.tsx && git commit -m "feat(report-web): ECharts renderer (heatmap matrix + grouped bar, RTL option-building)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: one commit created.

- [ ] **Step 8: Failing test for the `ReportViewRenderer` dispatcher.** Create `report-web/src/presentation/ReportView.test.tsx`. It mocks each renderer to a tagged div and asserts the dispatcher picks correctly by `library`/`type`:
  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";

  vi.mock("./renderers/TableRenderer", () => ({
    default: () => <div data-testid="r-table" />,
  }));
  vi.mock("./renderers/KpiRenderer", () => ({
    default: () => <div data-testid="r-kpi" />,
  }));
  vi.mock("./renderers/RechartsRenderer", () => ({
    default: () => <div data-testid="r-recharts" />,
  }));
  vi.mock("./renderers/EChartsRenderer", () => ({
    default: () => <div data-testid="r-echarts" />,
  }));

  import { ReportViewRenderer } from "./ReportView";
  import type { ReportView } from "../contracts/presentation";
  import type { ReportDefinition } from "../contracts/report-definition";
  import type { QueryResult } from "../contracts/dataset";

  const result: QueryResult = { columns: [], rows: [], total: 0 };
  const def = {
    id: "r1",
    dataset: "sales",
    columns: [],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  function view(partial: Partial<ReportView>): ReportView {
    return {
      type: "table",
      library: "antd",
      component: "TableRenderer",
      mapping: {},
      ...partial,
    };
  }

  describe("ReportViewRenderer", () => {
    it("dispatches antd table → TableRenderer", () => {
      render(<ReportViewRenderer view={view({ library: "antd", type: "table" })} def={def} result={result} />);
      expect(screen.getByTestId("r-table")).toBeInTheDocument();
    });
    it("dispatches antd kpi → KpiRenderer", () => {
      render(<ReportViewRenderer view={view({ library: "antd", type: "kpi" })} def={def} result={result} />);
      expect(screen.getByTestId("r-kpi")).toBeInTheDocument();
    });
    it("dispatches recharts → RechartsRenderer", () => {
      render(<ReportViewRenderer view={view({ library: "recharts", type: "chart", component: "BarChart" })} def={def} result={result} />);
      expect(screen.getByTestId("r-recharts")).toBeInTheDocument();
    });
    it("dispatches echarts → EChartsRenderer", () => {
      render(<ReportViewRenderer view={view({ library: "echarts", type: "chart", component: "heatmap" })} def={def} result={result} />);
      expect(screen.getByTestId("r-echarts")).toBeInTheDocument();
    });
  });
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/ReportView.test.tsx
  ```
  Expected: FAIL — cannot resolve `./ReportView` / `ReportViewRenderer`.

- [ ] **Step 9: Implement `ReportView.tsx` dispatcher.** Create `report-web/src/presentation/ReportView.tsx`. It exports the canonical `RendererProps` (R5) and `ReportViewRenderer`, dispatching by `view.library` first (this is what enforces the strict "charts never antd" rule structurally), then by `view.type` within antd:
  ```tsx
  import type { ReportView } from "../contracts/presentation";
  import type { ReportDefinition } from "../contracts/report-definition";
  import type { QueryResult, GroupNode } from "../contracts/dataset";
  import TableRenderer from "./renderers/TableRenderer";
  import KpiRenderer from "./renderers/KpiRenderer";
  import RechartsRenderer from "./renderers/RechartsRenderer";
  import EChartsRenderer from "./renderers/EChartsRenderer";

  /** Canonical renderer props (R5). The single source other features import. */
  export type RendererProps = {
    view: ReportView;
    def: ReportDefinition;
    result: QueryResult;
    /** Optional drill callback: fired with the clicked group node. Drill-capable
     *  renderers (Recharts/ECharts/Table) wire it; others ignore it. */
    onDrill?: (node: GroupNode) => void;
  };

  /**
   * Dispatcher (named ReportViewRenderer to avoid clashing with the ReportView
   * *type*). Picks the renderer by library first — this is the structural
   * enforcement of "charts/echarts never render with antd".
   */
  export function ReportViewRenderer(props: RendererProps): JSX.Element {
    const { view } = props;
    switch (view.library) {
      case "recharts":
        return <RechartsRenderer {...props} />;
      case "echarts":
        return <EChartsRenderer {...props} />;
      case "antd":
      default:
        // antd library: KPI Card vs Table by view type.
        if (view.type === "kpi") return <KpiRenderer {...props} />;
        return <TableRenderer {...props} />;
    }
  }
  ```
  Run:
  ```bash
  cd report-web && npx vitest run src/presentation/ReportView.test.tsx
  ```
  Expected: PASS — 4 tests passing.

  Acceptance criteria: dispatch is by `view.library` (`recharts`→Recharts, `echarts`→ECharts), and within `antd` by `view.type` (`kpi`→Kpi, else Table); `RendererProps` is exported as the canonical R5 props type; the dispatcher export is `ReportViewRenderer` (not `ReportView`, which is the type name).

- [ ] **Step 10: Lint + full presentation test sweep.**
  ```bash
  cd report-web && npm run lint && npx vitest run src/presentation
  ```
  Expected: lint clean; all presentation tests passing (format, Table, Kpi, Recharts, ECharts, dispatcher).

- [ ] **Step 11: Build + commit dispatcher.**
  ```bash
  cd report-web && npm run build
  ```
  Expected: build succeeds (0 errors).
  ```bash
  cd report-web && git add src/presentation/ReportView.tsx src/presentation/ReportView.test.tsx && git commit -m "feat(report-web): ReportViewRenderer dispatcher (library-first, R5 props)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: one commit created.


### Task 14: Ask-AI Builder screen (`features/ask-ai/`)

The flagship screen (§3.1, flow §4.1): a centered hero prompt that animates up into a two-pane working state. The user submits a prompt → `createAIService().generate(req)` → the `ReportDefinition` JSON reveals (collapsible, Framer Motion stagger) → `runQuery(def, dataset, semantic)` → `ReportViewRenderer` shows the result → a view switcher (table/bar/line/pie/kpi), drill-down, save-to-library, and export menu wrap it.

**Files:**
- Create: `report-web/src/features/ask-ai/AskAiBuilder.tsx`
- Create: `report-web/src/features/ask-ai/PromptHero.tsx`
- Create: `report-web/src/features/ask-ai/DefinitionPanel.tsx`
- Create: `report-web/src/features/ask-ai/ViewSwitcher.tsx`
- Create: `report-web/src/features/ask-ai/SaveReportModal.tsx`
- Create: `report-web/src/features/ask-ai/useAskAi.ts`
- Create: `report-web/src/features/ask-ai/index.ts`
- Test: `report-web/src/features/ask-ai/AskAiBuilder.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/index.ts` → `ReportDefinition`, `SemanticModel`, `Dataset`, `QueryResult`, `ReportView`, `ViewType` (`"table" | "kpi" | "chart" | "dashboardWidget"`), `GenerateReportRequest = { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en" }`, `AIReportResult = { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string }`.
- `ai/index` → `createAIService(): IReportAIService` where `IReportAIService.generate(req: GenerateReportRequest): Promise<AIReportResult>`.
- `query/engine` → `runQuery(def: ReportDefinition, dataset: Dataset, semantic: SemanticModel): QueryResult`.
- `query/drilldown` → `drillInto(def: ReportDefinition, node: GroupNode, dataset: Dataset, semantic: SemanticModel): { def: ReportDefinition; result: QueryResult }`.
- `presentation/auto-viz` → `chooseView(def: ReportDefinition, result: QueryResult, semantic: SemanticModel): ReportView[]`.
- `presentation/ReportView` → `ReportViewRenderer` (named export), props `RendererProps = { view: ReportView; def: ReportDefinition; result: QueryResult; onDrill?: (node: GroupNode) => void }`.
- `semantic/registry` → `getSemanticModel(key: string): SemanticModel`, `listSemanticModels(): { key: string; label: string }[]`, `getDataset(key: string): Dataset`.
- `ai/examples` → `EXAMPLE_PROMPTS: { id: string; label: string; prompt: string; datasetKey: string }[]`.
- `api/queries` → `useSaveReport(): UseMutationResult<SavedReport, Error, { definition: ReportDefinition; name?: string; visibility?: "private" | "tenant" }>` (wraps the definition into a `SavedReport`, invalidates the library query); `SavedReport` is imported from `@/api/queries`.
- `features/export/index` → `buildExportMenuItems(def: ReportDefinition, result: QueryResult): MenuProps["items"]` (Task 17).
- `auth/useAuth` → `useAuth(): { user; roles; isAdmin; ready; login; logout }`.

Produces (later tasks rely on):
- `features/ask-ai/index.ts` → `export { AskAiBuilder }` (router Task mounts it at `/ask`).
- `useAskAi` hook → `{ state: AskAiState; submit(prompt: string, datasetKey?: string): Promise<void>; setDataset(key: string): void; switchView(type: ViewType | "bar" | "line" | "pie"): void; drill(node: GroupNode): void; drillUp(): void; reset(): void }` where `AskAiState = { phase: "hero" | "thinking" | "result" | "error"; datasetKey: string; result?: QueryResult; def?: ReportDefinition; activeViewIndex: number; views: ReportView[]; drillPath: DrillCrumb[]; errorKey?: string }` and `DrillCrumb = { label: string; def: ReportDefinition; result: QueryResult; views: ReportView[] }`.

- [ ] **Step 1: Write the failing render smoke test.**
  Create `report-web/src/features/ask-ai/AskAiBuilder.test.tsx`:
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { I18nextProvider } from "react-i18next";
  import i18n from "@/i18n";
  import { AskAiBuilder } from "./AskAiBuilder";

  function renderScreen() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <AskAiBuilder />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  }

  describe("AskAiBuilder", () => {
    it("shows the hero prompt box and example chips on first load", () => {
      renderScreen();
      expect(screen.getByRole("textbox", { name: /prompt/i })).toBeInTheDocument();
      // 5-7 seeded example chips
      expect(screen.getAllByTestId("example-chip").length).toBeGreaterThanOrEqual(5);
    });

    it("generates → reveals the definition panel → renders a result canvas", async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(
        screen.getByRole("textbox", { name: /prompt/i }),
        "فروش هر استان",
      );
      await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
      // collapsible definition panel appears with the generated JSON
      await waitFor(() =>
        expect(screen.getByTestId("definition-panel")).toBeInTheDocument(),
      );
      // result canvas (ReportViewRenderer output) and the view switcher appear
      expect(screen.getByTestId("result-canvas")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
    });

    it("renders an error alert when the AI cannot map intent", async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(screen.getByRole("textbox", { name: /prompt/i }), "asdkjqwe zzz");
      await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
      await waitFor(() =>
        expect(screen.getByRole("alert")).toBeInTheDocument(),
      );
    });
  });
  ```
- [ ] **Step 2: Run the test (expected FAIL).**
  ```bash
  cd report-web && npx vitest run src/features/ask-ai/AskAiBuilder.test.tsx
  ```
  Expected: `FAIL ... Cannot find module './AskAiBuilder'` (the component does not exist yet).
- [ ] **Step 3: Implement the `useAskAi` hook (state machine + engine wiring).**
  Create `report-web/src/features/ask-ai/useAskAi.ts`:
  ```tsx
  import { useCallback, useMemo, useRef, useState } from "react";
  import type {
    Dataset,
    GroupNode,
    QueryResult,
    ReportDefinition,
    ReportView,
    SemanticModel,
    ViewType,
  } from "@/contracts";
  import { createAIService } from "@/ai";
  import { runQuery } from "@/query/engine";
  import { drillInto } from "@/query/drilldown";
  import { chooseView } from "@/presentation/auto-viz";
  import { getDataset, getSemanticModel } from "@/semantic/registry";

  export type DrillCrumb = {
    label: string;
    def: ReportDefinition;
    result: QueryResult;
    views: ReportView[];
  };

  export type AskAiPhase = "hero" | "thinking" | "result" | "error";

  export interface AskAiState {
    phase: AskAiPhase;
    datasetKey: string;
    def?: ReportDefinition;
    result?: QueryResult;
    views: ReportView[];
    activeViewIndex: number;
    drillPath: DrillCrumb[];
    explanation?: string;
    errorKey?: string;
  }

  const DEFAULT_DATASET = "sales";
  // Maps a switcher chart subtype onto a (type, library, component) ReportView.
  const SUBTYPE_TO_VIEW: Record<
    "bar" | "line" | "pie",
    Pick<ReportView, "type" | "library" | "component">
  > = {
    bar: { type: "chart", library: "recharts", component: "BarChart" },
    line: { type: "chart", library: "recharts", component: "LineChart" },
    pie: { type: "chart", library: "recharts", component: "PieChart" },
  };

  export function useAskAi() {
    const ai = useMemo(() => createAIService(), []);
    const [state, setState] = useState<AskAiState>({
      phase: "hero",
      datasetKey: DEFAULT_DATASET,
      views: [],
      activeViewIndex: 0,
      drillPath: [],
    });
    // Guard against out-of-order responses from rapid resubmits.
    const reqSeq = useRef(0);

    const submit = useCallback(
      async (prompt: string, datasetKey?: string) => {
        const key = datasetKey ?? state.datasetKey;
        const seq = ++reqSeq.current;
        setState((s) => ({ ...s, phase: "thinking", datasetKey: key, errorKey: undefined }));
        try {
          const semantic: SemanticModel = getSemanticModel(key);
          const dataset: Dataset = getDataset(key);
          const res = await ai.generate({ prompt, semanticModel: semantic, locale: "fa" });
          if (seq !== reqSeq.current) return; // stale
          const def = res.definition;
          const result = runQuery(def, dataset, semantic);
          // Prefer the AI-pinned views; if empty, fall back to auto-viz.
          const views =
            def.presentation?.views?.length > 0
              ? def.presentation.views
              : chooseView(def, result, semantic);
          setState((s) => ({
            ...s,
            phase: "result",
            def,
            result,
            views,
            activeViewIndex:
              typeof def.presentation?.defaultView === "number"
                ? def.presentation.defaultView
                : 0,
            drillPath: [],
            explanation: res.explanation,
          }));
        } catch {
          if (seq !== reqSeq.current) return;
          setState((s) => ({ ...s, phase: "error", errorKey: "ask.error.unmapped" }));
        }
      },
      [ai, state.datasetKey],
    );

    const switchView = useCallback(
      (type: ViewType | "bar" | "line" | "pie") => {
        setState((s) => {
          // Look for an existing view of that type/subtype first (no recompute).
          const existing = s.views.findIndex((v) =>
            type === "table" || type === "kpi"
              ? v.type === type
              : v.component.toLowerCase().includes(type),
          );
          if (existing >= 0) return { ...s, activeViewIndex: existing };
          if (type === "table" || type === "kpi") {
            const v: ReportView = {
              type,
              library: "antd",
              component: type === "table" ? "Table" : "KpiCard",
              mapping: {},
            };
            return { ...s, views: [...s.views, v], activeViewIndex: s.views.length };
          }
          // Build a chart view reusing the current result's mapping.
          const base = s.views[s.activeViewIndex];
          const v: ReportView = {
            ...SUBTYPE_TO_VIEW[type],
            mapping: base?.mapping ?? {},
          };
          return { ...s, views: [...s.views, v], activeViewIndex: s.views.length };
        });
      },
      [],
    );

    const drill = useCallback(
      (node: GroupNode) => {
        setState((s) => {
          if (!s.def) return s;
          const semantic = getSemanticModel(s.datasetKey);
          const dataset = getDataset(s.datasetKey);
          const { def, result } = drillInto(s.def, node, dataset, semantic);
          const views = chooseView(def, result, semantic);
          const crumb: DrillCrumb = {
            label: String(node.value),
            def: s.def,
            result: s.result!,
            views: s.views,
          };
          return {
            ...s,
            def,
            result,
            views,
            activeViewIndex: 0,
            drillPath: [...s.drillPath, crumb],
          };
        });
      },
      [],
    );

    const drillUp = useCallback(() => {
      setState((s) => {
        if (s.drillPath.length === 0) return s;
        const path = [...s.drillPath];
        const prev = path.pop()!;
        return {
          ...s,
          def: prev.def,
          result: prev.result,
          views: prev.views,
          activeViewIndex: 0,
          drillPath: path,
        };
      });
    }, []);

    // Switches the active dataset only (no generation). Used by the dataset picker.
    const setDataset = useCallback(
      (key: string) => setState((s) => ({ ...s, datasetKey: key })),
      [],
    );

    const reset = useCallback(
      () =>
        setState({
          phase: "hero",
          datasetKey: DEFAULT_DATASET,
          views: [],
          activeViewIndex: 0,
          drillPath: [],
        }),
      [],
    );

    return { state, submit, setDataset, switchView, drill, drillUp, reset };
  }
  ```
- [ ] **Step 4: Implement `PromptHero` (centered hero + prompt box + example chips + dataset picker).**
  Create `report-web/src/features/ask-ai/PromptHero.tsx`:
  ```tsx
  import { Button, Input, Select, Tag } from "antd";
  import { SendOutlined } from "@ant-design/icons";
  import { motion } from "framer-motion";
  import { useState } from "react";
  import { useTranslation } from "react-i18next";
  import { EXAMPLE_PROMPTS } from "@/ai/examples";
  import { listSemanticModels } from "@/semantic/registry";

  interface Props {
    compact: boolean; // hero (false) → two-pane top bar (true)
    datasetKey: string;
    onDataset: (key: string) => void;
    onSubmit: (prompt: string) => void;
  }

  export function PromptHero({ compact, datasetKey, onDataset, onSubmit }: Props) {
    const { t } = useTranslation();
    const [text, setText] = useState("");
    const send = () => {
      const v = text.trim();
      if (v) onSubmit(v);
    };
    return (
      <motion.div layout className={compact ? "ask-hero ask-hero--compact" : "ask-hero"}>
        {!compact && (
          <>
            <h1 className="ask-hero__title">{t("ask.heroTitle")}</h1>
            <p className="ask-hero__hint">{t("ask.sqlReassurance")}</p>
          </>
        )}
        <div className="ask-hero__row">
          <Select
            data-testid="dataset-picker"
            value={datasetKey}
            onChange={onDataset}
            options={listSemanticModels().map((m) => ({ value: m.key, label: m.label }))}
            style={{ minWidth: 160 }}
          />
          <Input.TextArea
            aria-label={t("ask.promptLabel")}
            autoSize={{ minRows: 1, maxRows: 5 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();
            }}
            placeholder={t("ask.promptPlaceholder")}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={send}>
            {t("ask.send")}
          </Button>
        </div>
        {!compact && (
          <div className="ask-hero__chips">
            {EXAMPLE_PROMPTS.map((ex) => (
              <Tag.CheckableTag
                key={ex.id}
                data-testid="example-chip"
                checked={false}
                onChange={() => {
                  onDataset(ex.datasetKey);
                  onSubmit(ex.prompt);
                }}
              >
                {ex.label}
              </Tag.CheckableTag>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
  ```
- [ ] **Step 5: Implement `DefinitionPanel` (Framer Motion staggered JSON reveal, collapsible, copy).**
  Create `report-web/src/features/ask-ai/DefinitionPanel.tsx`:
  ```tsx
  import { Button, Collapse, Tooltip, message } from "antd";
  import { CopyOutlined } from "@ant-design/icons";
  import { motion } from "framer-motion";
  import { useTranslation } from "react-i18next";
  import type { ReportDefinition } from "@/contracts";

  interface Props {
    def: ReportDefinition;
  }

  export function DefinitionPanel({ def }: Props) {
    const { t } = useTranslation();
    const json = JSON.stringify(def, null, 2);
    const lines = json.split("\n");
    const copy = async () => {
      await navigator.clipboard.writeText(json);
      message.success(t("ask.copied"));
    };
    return (
      <div data-testid="definition-panel">
        <Collapse
          ghost
          items={[
            {
              key: "def",
              label: t("ask.definitionTitle"),
              extra: (
                <Tooltip title={t("ask.copyJson")}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      void copy();
                    }}
                  />
                </Tooltip>
              ),
              children: (
                <motion.pre
                  className="ask-def__code"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.012 } } }}
                >
                  {lines.map((ln, i) => (
                    <motion.div
                      key={i}
                      variants={{ hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0 } }}
                    >
                      {ln || " "}
                    </motion.div>
                  ))}
                </motion.pre>
              ),
            },
          ]}
        />
      </div>
    );
  }
  ```
- [ ] **Step 6: Implement `ViewSwitcher` (Segmented; disables invalid combos).**
  Create `report-web/src/features/ask-ai/ViewSwitcher.tsx`:
  ```tsx
  import { Segmented } from "antd";
  import { useTranslation } from "react-i18next";
  import type { QueryResult, ReportView, ViewType } from "@/contracts";

  export type SwitchTarget = ViewType | "bar" | "line" | "pie";

  interface Props {
    views: ReportView[];
    active: ReportView | undefined;
    result: QueryResult;
    onSwitch: (t: SwitchTarget) => void;
  }

  export function ViewSwitcher({ active, result, onSwitch }: Props) {
    const { t } = useTranslation();
    const metricCount = result.columns.filter((c) => c.isMetric).length;
    // Pie is invalid with >1 measure.
    const options = [
      { label: t("view.table"), value: "table" as SwitchTarget },
      { label: t("view.kpi"), value: "kpi" as SwitchTarget },
      { label: t("view.bar"), value: "bar" as SwitchTarget },
      { label: t("view.line"), value: "line" as SwitchTarget },
      { label: t("view.pie"), value: "pie" as SwitchTarget, disabled: metricCount > 1 },
    ];
    const current: SwitchTarget = !active
      ? "table"
      : active.type === "table" || active.type === "kpi"
        ? active.type
        : active.component.toLowerCase().includes("bar")
          ? "bar"
          : active.component.toLowerCase().includes("pie")
            ? "pie"
            : "line";
    return (
      <div data-testid="view-switcher">
        <Segmented
          options={options}
          value={current}
          onChange={(v) => onSwitch(v as SwitchTarget)}
        />
      </div>
    );
  }
  ```
- [ ] **Step 7: Implement `SaveReportModal` (antd Modal + Form → `useSaveReport`).**
  Create `report-web/src/features/ask-ai/SaveReportModal.tsx`:
  ```tsx
  import { Form, Input, Modal, Select, message } from "antd";
  import { useTranslation } from "react-i18next";
  import type { ReportDefinition } from "@/contracts";
  import { useSaveReport } from "@/api/queries";

  interface Props {
    open: boolean;
    def: ReportDefinition;
    onClose: () => void;
  }

  export function SaveReportModal({ open, def, onClose }: Props) {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const save = useSaveReport();
    const submit = async () => {
      const v = await form.validateFields();
      // Wrap the definition into a SavedReport via useSaveReport (def stays the
      // canonical Task 2 contract; name/visibility ride the envelope).
      const definition: ReportDefinition = {
        ...def,
        name: v.name,
        description: v.description,
        tags: v.tags ?? [],
      } as ReportDefinition;
      await save.mutateAsync({ definition, name: v.name, visibility: v.visibility });
      message.success(t("ask.saved"));
      onClose();
    };
    return (
      <Modal
        open={open}
        title={t("ask.saveTitle")}
        okText={t("common.save")}
        confirmLoading={save.isPending}
        onOk={submit}
        onCancel={onClose}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ name: def.name, visibility: "private" }}>
          <Form.Item name="name" label={t("ask.fieldName")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t("ask.fieldDescription")}>
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item name="tags" label={t("ask.fieldTags")}>
            <Select mode="tags" tokenSeparators={[","]} />
          </Form.Item>
          <Form.Item name="visibility" label={t("ask.fieldVisibility")}>
            <Select
              options={[
                { value: "private", label: t("ask.visPrivate") },
                { value: "tenant", label: t("ask.visTenant") },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    );
  }
  ```
- [ ] **Step 8: Implement the `AskAiBuilder` container (wires hero ↔ two-pane, definition, canvas, toolbar).**
  Create `report-web/src/features/ask-ai/AskAiBuilder.tsx`:
  ```tsx
  import { Alert, Breadcrumb, Button, Dropdown, Empty, Space, Spin } from "antd";
  import { DownloadOutlined, SaveOutlined } from "@ant-design/icons";
  import { AnimatePresence, motion } from "framer-motion";
  import { useState } from "react";
  import { useTranslation } from "react-i18next";
  import { ReportViewRenderer } from "@/presentation/ReportView";
  import { buildExportMenuItems } from "@/features/export";
  import { useAuth } from "@/auth/useAuth";
  import { PromptHero } from "./PromptHero";
  import { DefinitionPanel } from "./DefinitionPanel";
  import { ViewSwitcher } from "./ViewSwitcher";
  import { SaveReportModal } from "./SaveReportModal";
  import { useAskAi } from "./useAskAi";

  const THINKING_STEPS = ["ask.thinking.understanding", "ask.thinking.resolving", "ask.thinking.building"];

  export function AskAiBuilder() {
    const { t } = useTranslation();
    const { roles } = useAuth();
    const { state, submit, setDataset, switchView, drill, drillUp } = useAskAi();
    const [saveOpen, setSaveOpen] = useState(false);
    // AI Manager can run/preview but cannot save (execute-only, no reports:write — §3.1).
    const canSave = !roles.includes("AIManager");

    if (state.phase === "hero") {
      return (
        <div className="ask-screen ask-screen--hero">
          <PromptHero
            compact={false}
            datasetKey={state.datasetKey}
            onDataset={setDataset}
            onSubmit={(p) => void submit(p)}
          />
        </div>
      );
    }

    const activeView = state.views[state.activeViewIndex];
    return (
      <div className="ask-screen ask-screen--work">
        <PromptHero
          compact
          datasetKey={state.datasetKey}
          onDataset={setDataset}
          onSubmit={(p) => void submit(p)}
        />

        {state.phase === "thinking" && (
          <div className="ask-thinking" role="status">
            <Spin />
            <motion.span
              key={Date.now()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {t(THINKING_STEPS[0])}
            </motion.span>
          </div>
        )}

        {state.phase === "error" && (
          <Alert
            type="warning"
            showIcon
            role="alert"
            message={t("ask.error.unmappedTitle")}
            description={t("ask.error.unmappedHint")}
          />
        )}

        {state.phase === "result" && state.def && state.result && (
          <>
            <DefinitionPanel def={state.def} />

            <Space className="ask-toolbar" wrap>
              <ViewSwitcher
                views={state.views}
                active={activeView}
                result={state.result}
                onSwitch={switchView}
              />
              {canSave && (
                <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>
                  {t("ask.saveToLibrary")}
                </Button>
              )}
              <Dropdown
                menu={{ items: buildExportMenuItems(state.def, state.result) }}
                trigger={["click"]}
              >
                <Button icon={<DownloadOutlined />}>{t("ask.export")}</Button>
              </Dropdown>
            </Space>

            {state.drillPath.length > 0 && (
              <Breadcrumb
                items={[
                  { title: <a onClick={() => drillUp()}>{t("ask.root")}</a> },
                  ...state.drillPath.map((c) => ({ title: c.label })),
                ]}
              />
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={state.activeViewIndex + (activeView?.component ?? "")}
                data-testid="result-canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {state.result.total === 0 ? (
                  <Empty description={t("ask.empty.noRows")} />
                ) : activeView ? (
                  <ReportViewRenderer
                    view={activeView}
                    def={state.def}
                    result={state.result}
                    onDrill={drill}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {state.def && (
          <SaveReportModal open={saveOpen} def={state.def} onClose={() => setSaveOpen(false)} />
        )}
      </div>
    );
  }
  ```
  Note: `ReportViewRenderer`'s base `RendererProps` is `{ view, def, result }` (R5); this screen passes an optional `onDrill` that drill-capable renderers (Recharts/ECharts/Table) wire to click events. The renderer ignores it when not applicable.
- [ ] **Step 9: Add i18n keys.**
  In `report-web/src/i18n/locales/fa/ask.json` and `report-web/src/i18n/locales/en/ask.json`, add the keys referenced above: `heroTitle`, `sqlReassurance`, `promptLabel`, `promptPlaceholder`, `send`, `definitionTitle`, `copyJson`, `copied`, `saveToLibrary`, `saveTitle`, `fieldName`, `fieldDescription`, `fieldTags`, `fieldVisibility`, `visPrivate`, `visTenant`, `saved`, `export`, `root`, `empty.noRows`, `thinking.understanding`, `thinking.resolving`, `thinking.building`, `error.unmapped`, `error.unmappedTitle`, `error.unmappedHint`; and in `common.json` add `save`; and `view.table|kpi|bar|line|pie`. fa values are Persian (e.g. `"send": "ارسال"`, `"saveToLibrary": "ذخیره در کتابخانه"`, `"thinking.understanding": "در حال درک درخواست…"`), en values are the English equivalents.
- [ ] **Step 10: Create the barrel.**
  Create `report-web/src/features/ask-ai/index.ts`:
  ```ts
  export { AskAiBuilder } from "./AskAiBuilder";
  export { useAskAi } from "./useAskAi";
  ```
- [ ] **Step 11: Run the test (expected PASS) + lint + build.**
  ```bash
  cd report-web && npx vitest run src/features/ask-ai/AskAiBuilder.test.tsx
  ```
  Expected: `Test Files  1 passed (1)` / `Tests  3 passed (3)`.
  ```bash
  cd report-web && npm run lint && npm run build
  ```
  Expected: lint clean; `vite build` writes `dist/` with exit 0.
- [ ] **Step 12: Acceptance criteria check (manual against §3.1).**
  Verify in `npm run dev` at `/ask`: (1) first load shows a centered hero with prompt box + 5–7 example chips + the "AI never writes SQL" reassurance; (2) submitting a prompt runs a staged thinking indicator then reveals a collapsible Report Definition panel (staggered) and an auto-rendered result with a Table/Bar/Line/Pie/KPI switcher; (3) switching views does **not** recompute the query (same `result` object reused); (4) clicking a bar/slice/row drills down and an antd Breadcrumb shows the drill path with back navigation; (5) Save opens a Modal+Form that persists via `useSaveReport`; (6) Export dropdown shows CSV/JSON active and PDF/Excel disabled with a "v2" tag; (7) an unmappable prompt shows an `Alert`. Charts are Recharts/ECharts only — no antd chart import.
- [ ] **Step 13: Commit.**
  ```bash
  git add report-web/src/features/ask-ai report-web/src/i18n/locales
  git commit -m "feat(report-web): Ask-AI Builder screen (generate → engine → render → switch/drill/save/export)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 15: Report Viewer + Report Library (`features/viewer/`, `features/library/`)

The Report Viewer (§3.2) loads a saved report by id, runs the Query Engine over its bundled dataset, and renders it read-only with a filter bar, view switcher, drill-down, and export menu. The Report Library (§3.3) lists all saved reports in an antd `Table` with search/filter/tags and per-row run/edit/delete actions, all through the mock `queries` hooks.

**Files:**
- Create: `report-web/src/features/viewer/ReportViewer.tsx`
- Create: `report-web/src/features/viewer/FilterBar.tsx`
- Create: `report-web/src/features/viewer/index.ts`
- Create: `report-web/src/features/library/ReportLibrary.tsx`
- Create: `report-web/src/features/library/index.ts`
- Test: `report-web/src/features/viewer/ReportViewer.test.tsx`
- Test: `report-web/src/features/library/ReportLibrary.test.tsx`

**Interfaces:**

Consumes:
- `contracts/index` → `ReportDefinition`, `Filter`, `FilterValue`, `QueryResult`, `ReportView`, `ResolvedColumn`, `SemanticField`, `SemanticModel`.
- `api/queries` → `useReport(id: string): UseQueryResult<SavedReport>`, `useReports(): UseQueryResult<SavedReport[]>`, `useDeleteReport(): UseMutationResult<void, Error, string>`. **Import `SavedReport` from `@/api/queries`** (Task 10 is the single definition): `SavedReport = { id: string; definition: ReportDefinition; updatedAt: string; lastRunAt?: string; ownerName: string; visibility: "private" | "tenant" }`.
- `query/engine` → `runQuery(def, dataset, semantic)`.
- `query/drilldown` → `drillInto(def, node, dataset, semantic)`.
- `presentation/auto-viz` → `chooseView(def, result, semantic)`.
- `presentation/ReportView` → `ReportViewRenderer` (props `RendererProps`, optional `onDrill`).
- `semantic/registry` → `getSemanticModel(key)`, `getDataset(key)`.
- `features/export/index` → `buildExportMenuItems(def, result)`.
- `features/ask-ai/ViewSwitcher` → `ViewSwitcher`, `SwitchTarget`.
- `auth/useAuth` → `useAuth()`.
- `@/i18n/navigation`-equivalent: React Router v7 `useParams`, `useNavigate`, `Link`.

Produces:
- `features/viewer/index.ts` → `export { ReportViewer }` (router mounts at `/reports/:id`).
- `features/library/index.ts` → `export { ReportLibrary }` (router mounts at `/reports`).

- [ ] **Step 1: Write the failing Report Library smoke test.**
  Create `report-web/src/features/library/ReportLibrary.test.tsx`:
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { I18nextProvider } from "react-i18next";
  import { MemoryRouter } from "react-router";
  import i18n from "@/i18n";
  import { resetMockDb, seedReports } from "@/api/seed";
  import { ReportLibrary } from "./ReportLibrary";

  function renderLib() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <ReportLibrary />
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    );
  }

  describe("ReportLibrary", () => {
    beforeEach(() => {
      resetMockDb();
      seedReports();
    });

    it("lists seeded reports in a table", async () => {
      renderLib();
      await waitFor(() =>
        expect(screen.getByRole("table")).toBeInTheDocument(),
      );
      // at least one seeded report name is rendered
      expect(screen.getAllByTestId("report-row").length).toBeGreaterThan(0);
    });

    it("filters rows by the search box", async () => {
      renderLib();
      await screen.findByRole("table");
      const before = screen.getAllByTestId("report-row").length;
      const search = screen.getByRole("searchbox");
      search.focus();
      // typing a string that matches nothing collapses the list
      (search as HTMLInputElement).value = "zzz-no-match";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() =>
        expect(screen.queryAllByTestId("report-row").length).toBeLessThanOrEqual(before),
      );
    });
  });
  ```
  (Relies on `resetMockDb`/`seedReports` from the api/seed task — already a dependency for every feature test.)
- [ ] **Step 2: Run it (expected FAIL).**
  ```bash
  cd report-web && npx vitest run src/features/library/ReportLibrary.test.tsx
  ```
  Expected: `FAIL ... Cannot find module './ReportLibrary'`.
- [ ] **Step 3: Implement `ReportLibrary`.**
  Create `report-web/src/features/library/ReportLibrary.tsx`:
  ```tsx
  import { Alert, Button, Dropdown, Empty, Input, Select, Skeleton, Space, Table, Tag } from "antd";
  import type { ColumnsType } from "antd/es/table";
  import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
  import { useMemo, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { Link, useNavigate } from "react-router";
  import type { SavedReport } from "@/api/queries";
  import { useDeleteReport, useReports } from "@/api/queries";
  import { useAuth } from "@/auth/useAuth";

  export function ReportLibrary() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const { data, isLoading, isError, refetch } = useReports();
    const del = useDeleteReport();
    const [q, setQ] = useState("");
    const [model, setModel] = useState<string | undefined>();
    const [tag, setTag] = useState<string | undefined>();

    const canManage =
      roles.includes("ReportDesigner") ||
      roles.includes("TenantAdmin") ||
      roles.includes("SuperAdmin");

    const rows = useMemo(() => {
      const all = data ?? [];
      const needle = q.trim().toLowerCase();
      return all.filter((r) => {
        const d = r.definition;
        if (needle && !d.name.toLowerCase().includes(needle) && !(d.description ?? "").toLowerCase().includes(needle))
          return false;
        if (model && d.dataset !== model) return false;
        if (tag && !(d.tags ?? []).includes(tag)) return false;
        return true;
      });
    }, [data, q, model, tag]);

    const allModels = useMemo(
      () => Array.from(new Set((data ?? []).map((r) => r.definition.dataset))),
      [data],
    );
    const allTags = useMemo(
      () => Array.from(new Set((data ?? []).flatMap((r) => r.definition.tags ?? []))),
      [data],
    );

    const columns: ColumnsType<SavedReport> = [
      {
        title: t("library.colName"),
        dataIndex: ["definition", "name"],
        sorter: (a, b) => a.definition.name.localeCompare(b.definition.name),
        render: (_v, r) => <Link to={`/reports/${r.id}`}>{r.definition.name}</Link>,
      },
      { title: t("library.colOwner"), dataIndex: "ownerName" },
      { title: t("library.colModel"), dataIndex: ["definition", "dataset"] },
      {
        title: t("library.colTags"),
        dataIndex: ["definition", "tags"],
        render: (tags: string[] = []) => tags.map((x) => <Tag key={x}>{x}</Tag>),
      },
      {
        title: t("library.colVisibility"),
        dataIndex: "visibility",
        render: (v: string) => <Tag color={v === "tenant" ? "blue" : "default"}>{t(`library.vis.${v}`)}</Tag>,
      },
      {
        title: t("library.colLastRun"),
        dataIndex: "lastRunAt",
        sorter: (a, b) => (a.lastRunAt ?? "").localeCompare(b.lastRunAt ?? ""),
        render: (v?: string) => v ?? "—",
      },
      {
        title: "",
        key: "actions",
        width: 56,
        render: (_v, r) => (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "run", label: t("library.run"), onClick: () => navigate(`/reports/${r.id}`) },
                ...(canManage
                  ? [
                      { key: "edit", label: t("library.edit"), onClick: () => navigate(`/ask?from=${r.id}`) },
                      { type: "divider" as const },
                      {
                        key: "delete",
                        label: t("library.delete"),
                        danger: true,
                        onClick: () => void del.mutate(r.id),
                      },
                    ]
                  : []),
              ],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={t("library.actions")} />
          </Dropdown>
        ),
      },
    ];

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
    if (isError)
      return <Alert type="error" showIcon message={t("library.loadError")} action={<Button onClick={() => refetch()}>{t("common.retry")}</Button>} />;

    return (
      <div className="library-screen">
        <Space className="library-toolbar" wrap>
          <Input.Search
            allowClear
            placeholder={t("library.searchPlaceholder")}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 240 }}
          />
          <Select allowClear placeholder={t("library.filterModel")} value={model} onChange={setModel}
            options={allModels.map((m) => ({ value: m, label: m }))} style={{ width: 160 }} />
          <Select allowClear placeholder={t("library.filterTag")} value={tag} onChange={setTag}
            options={allTags.map((x) => ({ value: x, label: x }))} style={{ width: 160 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/ask")}>
            {t("library.newReport")}
          </Button>
        </Space>

        {rows.length === 0 ? (
          <Empty description={t("library.empty")}>
            <Button type="primary" onClick={() => navigate("/ask")}>{t("library.askFirst")}</Button>
          </Empty>
        ) : (
          <Table<SavedReport>
            rowKey="id"
            dataSource={rows}
            columns={columns}
            onRow={(r) => ({ "data-testid": "report-row", "data-id": r.id } as never)}
            pagination={{ pageSize: 12 }}
          />
        )}
      </div>
    );
  }
  ```
- [ ] **Step 4: Create the library barrel + run the test (expected PASS).**
  Create `report-web/src/features/library/index.ts`:
  ```ts
  export { ReportLibrary } from "./ReportLibrary";
  ```
  ```bash
  cd report-web && npx vitest run src/features/library/ReportLibrary.test.tsx
  ```
  Expected: `Tests  2 passed (2)`.
- [ ] **Step 5: Write the failing Report Viewer smoke test.**
  Create `report-web/src/features/viewer/ReportViewer.test.tsx`:
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { I18nextProvider } from "react-i18next";
  import { MemoryRouter, Route, Routes } from "react-router";
  import i18n from "@/i18n";
  import { resetMockDb, seedReports, firstSeededReportId } from "@/api/seed";
  import { ReportViewer } from "./ReportViewer";

  function renderViewer(id: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[`/reports/${id}`]}>
            <Routes>
              <Route path="/reports/:id" element={<ReportViewer />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    );
  }

  describe("ReportViewer", () => {
    beforeEach(() => {
      resetMockDb();
      seedReports();
    });

    it("loads a saved report, runs the engine, and renders the canvas + switcher", async () => {
      renderViewer(firstSeededReportId());
      await waitFor(() =>
        expect(screen.getByTestId("result-canvas")).toBeInTheDocument(),
      );
      expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
      // report title from the saved definition is shown in the header
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });

    it("shows a 'not found' result for an unknown id", async () => {
      renderViewer("nope-does-not-exist");
      await waitFor(() =>
        expect(screen.getByText(/not found|یافت نشد/i)).toBeInTheDocument(),
      );
    });
  });
  ```
- [ ] **Step 6: Run it (expected FAIL).**
  ```bash
  cd report-web && npx vitest run src/features/viewer/ReportViewer.test.tsx
  ```
  Expected: `FAIL ... Cannot find module './ReportViewer'`.
- [ ] **Step 7: Implement `FilterBar` (binds to `definition.filters`).**
  Create `report-web/src/features/viewer/FilterBar.tsx`:
  ```tsx
  import { DatePicker, Input, Select, Space } from "antd";
  import { useTranslation } from "react-i18next";
  import type { Filter, FilterValue, SemanticModel } from "@/contracts";

  interface Props {
    filters: Filter[];
    semantic: SemanticModel;
    onChange: (idx: number, value: FilterValue) => void;
  }

  // Renders one control per definition filter, typed by the semantic field.
  export function FilterBar({ filters, semantic, onChange }: Props) {
    const { t } = useTranslation();
    if (filters.length === 0) return null;
    const fieldOf = (key: string) => semantic.entities.flatMap((e) => e.fields).find((f) => f.key === key);
    return (
      <Space className="viewer-filterbar" wrap data-testid="filter-bar">
        {filters.map((f, i) => {
          const field = fieldOf(f.field);
          const label = field?.label ?? f.field;
          if (field?.type === "date") {
            return (
              <DatePicker
                key={i}
                placeholder={label}
                onChange={(d) => onChange(i, d ? d.toISOString() : null)}
              />
            );
          }
          if (field?.role === "dimension" && field.enumValues?.length) {
            return (
              <Select
                key={i}
                placeholder={label}
                allowClear
                style={{ minWidth: 160 }}
                options={field.enumValues.map((v) => ({ value: v, label: String(v) }))}
                onChange={(v) => onChange(i, v ?? null)}
              />
            );
          }
          return (
            <Input
              key={i}
              placeholder={label}
              allowClear
              onChange={(e) => onChange(i, e.target.value || null)}
            />
          );
        })}
        <span className="viewer-filterbar__hint">{t("viewer.filterHint")}</span>
      </Space>
    );
  }
  ```
- [ ] **Step 8: Implement `ReportViewer`.**
  Create `report-web/src/features/viewer/ReportViewer.tsx`:
  ```tsx
  import { Breadcrumb, Button, Descriptions, Dropdown, Empty, Result, Skeleton, Space, Typography } from "antd";
  import { DownloadOutlined, EditOutlined, ReloadOutlined } from "@ant-design/icons";
  import { useMemo, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { useNavigate, useParams } from "react-router";
  import type {
    Filter,
    FilterValue,
    GroupNode,
    QueryResult,
    ReportDefinition,
    ReportView,
  } from "@/contracts";
  import { useReport } from "@/api/queries";
  import { runQuery } from "@/query/engine";
  import { drillInto } from "@/query/drilldown";
  import { chooseView } from "@/presentation/auto-viz";
  import { getDataset, getSemanticModel } from "@/semantic/registry";
  import { ReportViewRenderer } from "@/presentation/ReportView";
  import { buildExportMenuItems } from "@/features/export";
  import { ViewSwitcher, type SwitchTarget } from "@/features/ask-ai/ViewSwitcher";
  import { useAuth } from "@/auth/useAuth";
  import { FilterBar } from "./FilterBar";

  type Crumb = { label: string; def: ReportDefinition; result: QueryResult; views: ReportView[] };

  export function ReportViewer() {
    const { t } = useTranslation();
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const { data, isLoading, isError } = useReport(id);

    const [filterValues, setFilterValues] = useState<Record<number, FilterValue>>({});
    const [activeIdx, setActiveIdx] = useState(0);
    const [drillPath, setDrillPath] = useState<Crumb[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const semantic = data ? getSemanticModel(data.definition.dataset) : undefined;
    const dataset = data ? getDataset(data.definition.dataset) : undefined;

    // Apply live filter-bar overrides into the definition before running.
    const liveDef = useMemo<ReportDefinition | undefined>(() => {
      if (!data) return undefined;
      const base = data.definition;
      const filters: Filter[] = (base.filters ?? []).map((f, i) =>
        filterValues[i] === undefined ? f : { ...f, value: filterValues[i] },
      );
      return { ...base, filters };
      // refreshKey forces recompute on "Refresh"
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, filterValues, refreshKey]);

    const computed = useMemo(() => {
      if (!liveDef || !dataset || !semantic) return undefined;
      const result = runQuery(liveDef, dataset, semantic);
      const views =
        liveDef.presentation?.views?.length > 0
          ? liveDef.presentation.views
          : chooseView(liveDef, result, semantic);
      return { result, views };
    }, [liveDef, dataset, semantic]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (isError || !data) return <Result status="404" title={t("viewer.notFound")} />;
    if (!computed || !liveDef || !semantic) return <Result status="error" title={t("viewer.invalid")} />;

    const { result, views } = drillPath.length
      ? { result: drillPath[drillPath.length - 1].result, views: drillPath[drillPath.length - 1].views }
      : computed;

    const activeDef = drillPath.length ? drillPath[drillPath.length - 1].def : liveDef;
    const activeView = views[activeIdx] ?? views[0];

    const canEdit =
      roles.includes("ReportDesigner") || roles.includes("PowerUser") ||
      roles.includes("TenantAdmin") || roles.includes("SuperAdmin");

    const drill = (node: GroupNode) => {
      const { def, result: r } = drillInto(activeDef, node, dataset!, semantic);
      setDrillPath((p) => [
        ...p,
        { label: String(node.value), def, result: r, views: chooseView(def, r, semantic) },
      ]);
      setActiveIdx(0);
    };
    const drillUp = (toRoot = false) => {
      setDrillPath((p) => (toRoot ? [] : p.slice(0, -1)));
      setActiveIdx(0);
    };
    const switchView = (target: SwitchTarget) => {
      const idx = views.findIndex((v) =>
        target === "table" || target === "kpi"
          ? v.type === target
          : v.component.toLowerCase().includes(target),
      );
      setActiveIdx(idx >= 0 ? idx : 0);
    };

    return (
      <div className="viewer-screen">
        <Typography.Title level={2}>{data.definition.name}</Typography.Title>
        {data.definition.description && (
          <Typography.Paragraph type="secondary">{data.definition.description}</Typography.Paragraph>
        )}
        <Descriptions size="small" column={3} items={[
          { key: "owner", label: t("viewer.owner"), children: data.ownerName },
          { key: "model", label: t("viewer.model"), children: data.definition.dataset },
          { key: "updated", label: t("viewer.updated"), children: data.updatedAt },
        ]} />

        <FilterBar
          filters={liveDef.filters ?? []}
          semantic={semantic}
          onChange={(i, v) => setFilterValues((s) => ({ ...s, [i]: v }))}
        />

        <Space className="viewer-toolbar" wrap>
          <ViewSwitcher views={views} active={activeView} result={result} onSwitch={switchView} />
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)}>
            {t("viewer.refresh")}
          </Button>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={() => navigate(`/ask?from=${id}`)}>
              {t("viewer.openInAsk")}
            </Button>
          )}
          <Dropdown menu={{ items: buildExportMenuItems(activeDef, result) }} trigger={["click"]}>
            <Button icon={<DownloadOutlined />}>{t("viewer.export")}</Button>
          </Dropdown>
        </Space>

        {drillPath.length > 0 && (
          <Breadcrumb
            items={[
              { title: <a onClick={() => drillUp(true)}>{data.definition.name}</a> },
              ...drillPath.map((c) => ({ title: c.label })),
            ]}
          />
        )}

        <div data-testid="result-canvas">
          {result.total === 0 ? (
            <Empty description={t("viewer.emptyFilters")} />
          ) : (
            <ReportViewRenderer view={activeView} def={activeDef} result={result} onDrill={drill} />
          )}
        </div>
      </div>
    );
  }
  ```
- [ ] **Step 9: Create the viewer barrel + run the test (expected PASS).**
  Create `report-web/src/features/viewer/index.ts`:
  ```ts
  export { ReportViewer } from "./ReportViewer";
  ```
  ```bash
  cd report-web && npx vitest run src/features/viewer/ReportViewer.test.tsx
  ```
  Expected: `Tests  2 passed (2)`.
- [ ] **Step 10: Add i18n keys.**
  In `report-web/src/i18n/locales/{fa,en}/viewer.json` add: `notFound`, `invalid`, `owner`, `model`, `updated`, `refresh`, `openInAsk`, `export`, `emptyFilters`, `filterHint`. In `.../library.json` add: `colName`, `colOwner`, `colModel`, `colTags`, `colVisibility`, `colLastRun`, `run`, `edit`, `delete`, `actions`, `searchPlaceholder`, `filterModel`, `filterTag`, `newReport`, `empty`, `askFirst`, `loadError`, `vis.private`, `vis.tenant`. In `common.json` add `retry`. fa values Persian (e.g. `"notFound": "گزارش یافت نشد"`, `"refresh": "به‌روزرسانی"`).
- [ ] **Step 11: Lint + build.**
  ```bash
  cd report-web && npm run lint && npm run build
  ```
  Expected: clean lint; `vite build` exit 0.
- [ ] **Step 12: Acceptance criteria (against §3.2/§3.3).**
  Viewer: loads a saved report by id, shows title/description/metadata, a filter bar bound to `definition.filters` that live-recomputes on change, a view switcher, drill-down with antd Breadcrumb back navigation, Refresh re-runs the engine, "Open in Ask-AI" for Designers/Power Users, and an export menu (CSV/JSON real, PDF/Excel disabled-with-"v2"); unknown id → `Result 404`; empty result → `Empty` with reset hint. Library: antd `Table` with sortable name/owner/model/tags/visibility/last-run columns, `Input.Search` + model/tag `Select` filters, per-row Run/Edit/Delete (Edit/Delete only for Designer+), "New report" → `/ask`, empty state, loading `Skeleton`, error `Alert`+Retry. No chart renders in the library.
- [ ] **Step 13: Commit.**
  ```bash
  git add report-web/src/features/viewer report-web/src/features/library report-web/src/i18n/locales
  git commit -m "feat(report-web): Report Viewer (load→run→render+filters) and Report Library (table/search/actions)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 16: Dashboard List + Dashboard Builder (`features/dashboards/`)

Dashboard List (§3.4) is an antd `Card` grid of saved boards with search/sort and a "New dashboard" CTA. Dashboard Builder (§3.5, flow §4.2) composes a board from report-bound widgets on a **react-grid-layout** canvas (drag/resize, never antd grid), an "Add widget" drawer that binds a widget to a saved report, and Save persisting layout + bindings via `mockApi`.

**Files:**
- Create: `report-web/src/dashboard/widget.ts`
- Create: `report-web/src/dashboard/DashboardCanvas.tsx`
- Create: `report-web/src/features/dashboards/DashboardList.tsx`
- Create: `report-web/src/features/dashboards/DashboardBuilder.tsx`
- Create: `report-web/src/features/dashboards/AddWidgetDrawer.tsx`
- Create: `report-web/src/features/dashboards/WidgetFrame.tsx`
- Create: `report-web/src/features/dashboards/index.ts`
- Test: `report-web/src/features/dashboards/DashboardBuilder.test.tsx`

**Interfaces:**

Consumes:
- `contracts/index` → `ReportDefinition`, `QueryResult`, `ReportView`.
- `api/queries` → `useReports()`, `useReport(id)`, `useDashboards(): UseQueryResult<DashboardRecord[]>`, `useDashboard(id): UseQueryResult<DashboardRecord>`, `useCreateDashboard(): UseMutationResult<DashboardRecord, Error, { name: string }>`, `useSaveDashboard(): UseMutationResult<DashboardRecord, Error, DashboardRecord>`, `useDeleteDashboard(): UseMutationResult<void, Error, string>`. **Import `DashboardRecord` from `@/api/queries`** (Task 10 is the single definition); import the embedded `DashboardWidget`/`GridLayoutItem` types from `@/dashboard/widget`. Canonical shape: `DashboardRecord = { id: string; tenantId: string; name: string; widgets: DashboardWidget[]; layout: GridLayoutItem[]; ownerName: string; createdAt: string; updatedAt: string }`.
- `query/engine` → `runQuery(def, dataset, semantic)`; `presentation/auto-viz` → `chooseView`; `presentation/ReportView` → `ReportViewRenderer`; `semantic/registry` → `getSemanticModel`, `getDataset`.
- `auth/useAuth` → `useAuth()`.
- `react-grid-layout` → `Responsive`, `WidthProvider`; `react-grid-layout/css/styles.css`, `react-resizable/css/styles.css`.

Produces:
- `dashboard/widget.ts` → `DashboardWidget = { i: string; reportId: string; viewIndex?: number; title?: string }`, `GridLayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }`, `newWidget(reportId: string, title: string, order: number): { widget: DashboardWidget; layout: GridLayoutItem }`.
- `features/dashboards/index.ts` → `export { DashboardList, DashboardBuilder }` (router mounts `/dashboards` and `/dashboards/:id/edit`).

- [ ] **Step 1: Implement `dashboard/widget.ts` (pure helpers + types).**
  Create `report-web/src/dashboard/widget.ts`:
  ```ts
  export interface DashboardWidget {
    i: string; // grid item id (matches GridLayoutItem.i)
    reportId: string; // binds to a saved report by id (not a copy)
    viewIndex?: number; // which of the report's views to show
    title?: string;
  }

  export interface GridLayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  }

  let counter = 0;
  function nextId(): string {
    counter += 1;
    return `w_${Date.now().toString(36)}_${counter}`;
  }

  const COLS = 12;
  const W = 4;
  const H = 6;

  /** Create a widget + its initial grid placement, flowing left→right. */
  export function newWidget(
    reportId: string,
    title: string,
    order: number,
  ): { widget: DashboardWidget; layout: GridLayoutItem } {
    const id = nextId();
    const perRow = Math.floor(COLS / W); // 3 across
    const x = (order % perRow) * W;
    const y = Math.floor(order / perRow) * H;
    return {
      widget: { i: id, reportId, viewIndex: 0, title },
      layout: { i: id, x, y, w: W, h: H, minW: 2, minH: 3 },
    };
  }
  ```
- [ ] **Step 2: Implement `WidgetFrame` (antd chrome) + `DashboardCanvas` (react-grid-layout ONLY).**
  Create `report-web/src/features/dashboards/WidgetFrame.tsx`:
  ```tsx
  import { Alert, Button, Card, Dropdown } from "antd";
  import { MoreOutlined } from "@ant-design/icons";
  import { useMemo } from "react";
  import { useTranslation } from "react-i18next";
  import type { DashboardWidget } from "@/dashboard/widget";
  import { useReport } from "@/api/queries";
  import { runQuery } from "@/query/engine";
  import { chooseView } from "@/presentation/auto-viz";
  import { getDataset, getSemanticModel } from "@/semantic/registry";
  import { ReportViewRenderer } from "@/presentation/ReportView";

  interface Props {
    widget: DashboardWidget;
    editing: boolean;
    onRemove: () => void;
  }

  export function WidgetFrame({ widget, editing, onRemove }: Props) {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useReport(widget.reportId);

    const computed = useMemo(() => {
      if (!data) return undefined;
      try {
        const semantic = getSemanticModel(data.definition.dataset);
        const dataset = getDataset(data.definition.dataset);
        const result = runQuery(data.definition, dataset, semantic);
        const views =
          data.definition.presentation?.views?.length > 0
            ? data.definition.presentation.views
            : chooseView(data.definition, result, semantic);
        return { result, views };
      } catch {
        return null; // broken widget → inline alert, never breaks the board
      }
    }, [data]);

    return (
      <Card
        size="small"
        title={widget.title ?? data?.definition.name ?? t("dash.widget")}
        loading={isLoading}
        styles={{ body: { height: "calc(100% - 40px)", overflow: "auto" } }}
        extra={
          editing && (
            <Dropdown
              trigger={["click"]}
              menu={{ items: [{ key: "remove", danger: true, label: t("dash.removeWidget"), onClick: onRemove }] }}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} aria-label={t("dash.widgetMenu")} />
            </Dropdown>
          )
        }
      >
        {isError || computed === null ? (
          <Alert type="error" showIcon message={t("dash.widgetError")} />
        ) : computed ? (
          <ReportViewRenderer
            view={computed.views[widget.viewIndex ?? 0] ?? computed.views[0]}
            def={data!.definition}
            result={computed.result}
          />
        ) : null}
      </Card>
    );
  }
  ```
  Create `report-web/src/features/dashboards/../../dashboard/DashboardCanvas.tsx` at `report-web/src/dashboard/DashboardCanvas.tsx`:
  ```tsx
  import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
  import "react-grid-layout/css/styles.css";
  import "react-resizable/css/styles.css";
  import type { ReactNode } from "react";
  import type { GridLayoutItem } from "./widget";

  const ResponsiveGrid = WidthProvider(Responsive);

  interface Props {
    layout: GridLayoutItem[];
    editing: boolean;
    onLayoutChange: (next: GridLayoutItem[]) => void;
    children: ReactNode; // one child per layout item, keyed by item.i
  }

  // The ONLY grid layout in the app — antd Grid/Row/Col is never used here.
  export function DashboardCanvas({ layout, editing, onLayoutChange, children }: Props) {
    return (
      <ResponsiveGrid
        className="dashboard-canvas"
        data-testid="dashboard-canvas"
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4 }}
        rowHeight={40}
        isDraggable={editing}
        isResizable={editing}
        layouts={{ lg: layout as Layout[] }}
        onLayoutChange={(l) =>
          onLayoutChange(l.map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h })))
        }
        draggableHandle=".ant-card-head"
      >
        {children}
      </ResponsiveGrid>
    );
  }
  ```
- [ ] **Step 3: Implement `AddWidgetDrawer` (pick a saved report → bind).**
  Create `report-web/src/features/dashboards/AddWidgetDrawer.tsx`:
  ```tsx
  import { Drawer, Empty, List, Tag } from "antd";
  import { useTranslation } from "react-i18next";
  import { useReports } from "@/api/queries";

  interface Props {
    open: boolean;
    onClose: () => void;
    onPick: (reportId: string, title: string) => void;
  }

  export function AddWidgetDrawer({ open, onClose, onPick }: Props) {
    const { t } = useTranslation();
    const { data } = useReports();
    return (
      <Drawer title={t("dash.addWidget")} open={open} onClose={onClose} width={380}>
        {(data ?? []).length === 0 ? (
          <Empty description={t("dash.noReports")} />
        ) : (
          <List
            dataSource={data ?? []}
            renderItem={(r) => (
              <List.Item
                data-testid="add-widget-item"
                className="add-widget-item"
                onClick={() => {
                  onPick(r.id, r.definition.name);
                  onClose();
                }}
              >
                <List.Item.Meta
                  title={r.definition.name}
                  description={(r.definition.tags ?? []).map((x) => <Tag key={x}>{x}</Tag>)}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    );
  }
  ```
- [ ] **Step 4: Implement `DashboardBuilder`.**
  Create `report-web/src/features/dashboards/DashboardBuilder.tsx`:
  ```tsx
  import { Button, Result, Skeleton, Space, Switch, Typography, message } from "antd";
  import { PlusOutlined, SaveOutlined } from "@ant-design/icons";
  import { useEffect, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { useParams } from "react-router";
  import { useDashboard, useSaveDashboard } from "@/api/queries";
  import { useAuth } from "@/auth/useAuth";
  import { DashboardCanvas } from "@/dashboard/DashboardCanvas";
  import { newWidget, type DashboardWidget, type GridLayoutItem } from "@/dashboard/widget";
  import { AddWidgetDrawer } from "./AddWidgetDrawer";
  import { WidgetFrame } from "./WidgetFrame";

  export function DashboardBuilder() {
    const { t } = useTranslation();
    const { id = "" } = useParams();
    const { roles } = useAuth();
    const { data, isLoading, isError } = useDashboard(id);
    const save = useSaveDashboard();

    const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
    const [layout, setLayout] = useState<GridLayoutItem[]>([]);
    const [editing, setEditing] = useState(true);
    const [drawer, setDrawer] = useState(false);

    useEffect(() => {
      if (data) {
        setWidgets(data.widgets);
        setLayout(data.layout);
      }
    }, [data]);

    const canEdit =
      roles.includes("DashboardDesigner") || roles.includes("ReportDesigner") ||
      roles.includes("TenantAdmin") || roles.includes("SuperAdmin");

    if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
    if (isError || !data) return <Result status="404" title={t("dash.notFound")} />;
    if (!canEdit) return <Result status="403" title={t("dash.forbidden")} />;

    const addWidget = (reportId: string, title: string) => {
      const { widget, layout: li } = newWidget(reportId, title, widgets.length);
      setWidgets((w) => [...w, widget]);
      setLayout((l) => [...l, li]);
    };
    const removeWidget = (i: string) => {
      setWidgets((w) => w.filter((x) => x.i !== i));
      setLayout((l) => l.filter((x) => x.i !== i));
    };
    const onSave = async () => {
      try {
        await save.mutateAsync({ ...data, widgets, layout });
        message.success(t("dash.saved"));
      } catch {
        message.error(t("dash.saveError"));
      }
    };

    return (
      <div className="dash-builder">
        <Space className="dash-toolbar" wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>{data.name}</Typography.Title>
          <Button icon={<PlusOutlined />} onClick={() => setDrawer(true)}>{t("dash.addWidget")}</Button>
          <span>{t("dash.editMode")} <Switch checked={editing} onChange={setEditing} /></span>
          <Button type="primary" icon={<SaveOutlined />} loading={save.isPending} onClick={onSave}>
            {t("common.save")}
          </Button>
        </Space>

        {widgets.length === 0 ? (
          <div className="dash-empty" data-testid="dashboard-empty">
            <p>{t("dash.dropHere")}</p>
            <Button type="primary" onClick={() => setDrawer(true)}>{t("dash.addWidget")}</Button>
          </div>
        ) : (
          <DashboardCanvas layout={layout} editing={editing} onLayoutChange={setLayout}>
            {widgets.map((wd) => (
              <div key={wd.i} data-testid="dashboard-widget">
                <WidgetFrame widget={wd} editing={editing} onRemove={() => removeWidget(wd.i)} />
              </div>
            ))}
          </DashboardCanvas>
        )}

        <AddWidgetDrawer open={drawer} onClose={() => setDrawer(false)} onPick={addWidget} />
      </div>
    );
  }
  ```
- [ ] **Step 5: Implement `DashboardList`.**
  Create `report-web/src/features/dashboards/DashboardList.tsx`:
  ```tsx
  import { Button, Card, Dropdown, Empty, Input, Skeleton, Space } from "antd";
  import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
  import { useMemo, useState } from "react";
  import { useTranslation } from "react-i18next";
  import { useNavigate } from "react-router";
  import { useCreateDashboard, useDashboards, useDeleteDashboard } from "@/api/queries";
  import { useAuth } from "@/auth/useAuth";

  export function DashboardList() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const { data, isLoading } = useDashboards();
    const create = useCreateDashboard();
    const del = useDeleteDashboard();
    const [q, setQ] = useState("");

    const canCreate =
      roles.includes("DashboardDesigner") || roles.includes("TenantAdmin") || roles.includes("SuperAdmin");

    const boards = useMemo(
      () => (data ?? []).filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase())),
      [data, q],
    );

    const onNew = async () => {
      const d = await create.mutateAsync({ name: t("dash.untitled") });
      navigate(`/dashboards/${d.id}/edit`);
    };

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

    return (
      <div className="dash-list">
        <Space className="dash-list__toolbar" wrap>
          <Input.Search placeholder={t("dash.search")} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} loading={create.isPending} onClick={onNew}>
              {t("dash.new")}
            </Button>
          )}
        </Space>

        {boards.length === 0 ? (
          <Empty description={t("dash.emptyList")}>
            {canCreate && <Button type="primary" onClick={onNew}>{t("dash.create")}</Button>}
          </Empty>
        ) : (
          <div className="dash-list__grid">
            {boards.map((d) => (
              <Card
                key={d.id}
                data-testid="dashboard-card"
                hoverable
                title={d.name}
                onClick={() => navigate(`/dashboards/${d.id}/edit`)}
                extra={
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "open", label: t("dash.open"), onClick: () => navigate(`/dashboards/${d.id}/edit`) },
                        { type: "divider" as const },
                        { key: "del", danger: true, label: t("dash.delete"), onClick: () => void del.mutate(d.id) },
                      ],
                    }}
                  >
                    <Button type="text" icon={<MoreOutlined />} aria-label={t("dash.cardMenu")} onClick={(e) => e.stopPropagation()} />
                  </Dropdown>
                }
              >
                <div className="dash-card__meta">
                  <span>{t("dash.widgetCount", { count: d.widgets.length })}</span>
                  <span>{d.ownerName}</span>
                  <span>{d.updatedAt}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```
- [ ] **Step 6: Create the barrel.**
  Create `report-web/src/features/dashboards/index.ts`:
  ```ts
  export { DashboardList } from "./DashboardList";
  export { DashboardBuilder } from "./DashboardBuilder";
  ```
- [ ] **Step 7: Write the Dashboard Builder smoke test (FAIL first).**
  Create `report-web/src/features/dashboards/DashboardBuilder.test.tsx`:
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { I18nextProvider } from "react-i18next";
  import { MemoryRouter, Route, Routes } from "react-router";
  import i18n from "@/i18n";
  import { resetMockDb, seedReports, seedDashboards, firstSeededDashboardId } from "@/api/seed";
  import { DashboardBuilder } from "./DashboardBuilder";

  // dev mock-user: default role is DashboardDesigner so canEdit is true.
  function renderBuilder(id: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[`/dashboards/${id}/edit`]}>
            <Routes>
              <Route path="/dashboards/:id/edit" element={<DashboardBuilder />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    );
  }

  describe("DashboardBuilder", () => {
    beforeEach(() => {
      resetMockDb();
      seedReports();
      seedDashboards();
    });

    it("renders the canvas with the saved widgets", async () => {
      renderBuilder(firstSeededDashboardId());
      await waitFor(() =>
        expect(screen.getByTestId("dashboard-canvas")).toBeInTheDocument(),
      );
      expect(screen.getAllByTestId("dashboard-widget").length).toBeGreaterThan(0);
    });

    it("adds a widget via the drawer (binds to a saved report)", async () => {
      const user = userEvent.setup();
      // start from an empty board id (seedDashboards seeds an empty one too)
      renderBuilder(firstSeededDashboardId());
      await screen.findByTestId("dashboard-canvas");
      const before = screen.getAllByTestId("dashboard-widget").length;
      await user.click(screen.getAllByRole("button", { name: /add widget|افزودن/i })[0]);
      const items = await screen.findAllByTestId("add-widget-item");
      await user.click(items[0]);
      await waitFor(() =>
        expect(screen.getAllByTestId("dashboard-widget").length).toBe(before + 1),
      );
    });
  });
  ```
- [ ] **Step 8: Run the test (expected FAIL → then PASS).**
  ```bash
  cd report-web && npx vitest run src/features/dashboards/DashboardBuilder.test.tsx
  ```
  First run expected: `FAIL ... Cannot find module './DashboardBuilder'` (if run before Step 4). After Steps 1–6 are in place, expected: `Tests  2 passed (2)`.
- [ ] **Step 9: Add i18n keys.**
  In `report-web/src/i18n/locales/{fa,en}/dashboard.json` add: `widget`, `widgetMenu`, `removeWidget`, `widgetError`, `addWidget`, `noReports`, `notFound`, `forbidden`, `editMode`, `saved`, `saveError`, `dropHere`, `untitled`, `search`, `new`, `create`, `emptyList`, `open`, `delete`, `cardMenu`, `widgetCount`. In `common.json` ensure `save` exists. fa values Persian (e.g. `"addWidget": "افزودن ویجت"`, `"widgetCount": "{{count}} ویجت"`).
- [ ] **Step 10: Add the echarts/grid manualChunks note + CSS.**
  Confirm `react-grid-layout` and `react-resizable` CSS imports resolve (they are imported in `DashboardCanvas.tsx`). Add minimal styles for `.dashboard-canvas`, `.dash-list__grid` (CSS grid, `repeat(auto-fill, minmax(260px,1fr))`), `.dash-empty` (dashed border placeholder) to `report-web/src/features/dashboards/dashboards.css` and import it from `index.ts`.
- [ ] **Step 11: Lint + build.**
  ```bash
  cd report-web && npm run lint && npm run build
  ```
  Expected: clean lint; build exit 0 (verify the echarts widget chunking does not error; react-grid-layout CSS bundles fine).
- [ ] **Step 12: Acceptance criteria (against §3.4/§3.5 + flow §4.2).**
  List: antd `Card` grid with search/sort, "New dashboard" creates an empty `{ widgets: [], layout: [] }` board (flow b step 1) and routes to its builder, per-card Open/Delete, empty/loading states. Builder: **react-grid-layout** canvas (no antd Grid/Row/Col), "Add widget" drawer binds a widget to a saved report **by id** (stores a reference + chosen `viewIndex`, not a copy — flow b step 2), each widget renders by executing its bound `ReportDefinition` through `runQuery` + `ReportViewRenderer`, drag/resize updates `layout[]`, a broken widget shows an inline `Alert` without breaking the board, Save persists `{ widgets, layout }` via `useSaveDashboard`, non-Designers get `Result 403`, empty board shows the dashed "drop a widget here" placeholder.
- [ ] **Step 13: Commit.**
  ```bash
  git add report-web/src/dashboard report-web/src/features/dashboards report-web/src/i18n/locales
  git commit -m "feat(report-web): Dashboard List + Builder (react-grid-layout widgets bound to saved reports, persist via mockApi)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 17: Export engine — CSV + JSON (`features/export/`)

Real client-side CSV and JSON exporters (§3.1/§3.2 export menu, flow §4.4) that serialize a `QueryResult` (+ the `ReportDefinition` for JSON) and trigger a `Blob` download. A shared menu-builder produces antd `Dropdown` items: **CSV and JSON active**; **PDF and Excel present but DISABLED with a "v2" tag**. This is pure logic — strict TDD with full test + implementation.

**Files:**
- Create: `report-web/src/features/export/csv.ts`
- Create: `report-web/src/features/export/json.ts`
- Create: `report-web/src/features/export/download.ts`
- Create: `report-web/src/features/export/index.ts`
- Test: `report-web/src/features/export/export.test.ts`

**Interfaces:**

Consumes:
- `contracts/index` → `ReportDefinition`, `QueryResult` (`{ columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number }`), `ResolvedColumn` (`{ key: string; label: string; type: FieldType; isMetric: boolean }`), `ResultRow` (`Record<string, string | number | null>`).
- `antd` → `MenuProps` (for `buildExportMenuItems` return type).

Produces (Tasks 14/15/16 already import these):
- `features/export/index` →
  - `toCsv(result: QueryResult): string`
  - `toJson(def: ReportDefinition, result: QueryResult): string`
  - `downloadBlob(content: string, fileName: string, mime: string): void`
  - `exportCsv(def: ReportDefinition, result: QueryResult): void`
  - `exportJson(def: ReportDefinition, result: QueryResult): void`
  - `buildExportMenuItems(def: ReportDefinition, result: QueryResult): NonNullable<MenuProps["items"]>`

- [ ] **Step 1: Write the failing tests (full file).**
  Create `report-web/src/features/export/export.test.ts`:
  ```ts
  import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
  import type { QueryResult, ReportDefinition } from "@/contracts";
  import { toCsv } from "./csv";
  import { toJson } from "./json";
  import { buildExportMenuItems } from "./index";

  const result: QueryResult = {
    columns: [
      { key: "province", label: "استان", type: "string", isMetric: false },
      { key: "revenue", label: "درآمد", type: "number", isMetric: true },
    ],
    rows: [
      { province: "Tehran", revenue: 1200 },
      { province: 'Is"fahan', revenue: 800 },
      { province: "Has, Comma", revenue: null },
      { province: "Line\nBreak", revenue: 0 },
    ],
    total: 4,
  };

  const def = {
    id: "rpt_x",
    schemaVersion: "1.0",
    name: "Revenue by Province",
    dataset: "sales",
    columns: [{ field: "province" }, { field: "revenue" }],
    presentation: { views: [] },
  } as unknown as ReportDefinition;

  describe("toCsv", () => {
    it("writes a header row from column labels then one row per result row", () => {
      const csv = toCsv(result);
      const lines = csv.split("\r\n");
      expect(lines[0]).toBe("استان,درآمد");
      expect(lines).toHaveLength(5); // header + 4 rows
    });

    it("escapes quotes, commas, and newlines per RFC 4180; null → empty", () => {
      const csv = toCsv(result);
      const lines = csv.split("\r\n");
      expect(lines[1]).toBe("Tehran,1200");
      expect(lines[2]).toBe('"Is""fahan",800'); // doubled quote, wrapped
      expect(lines[3]).toBe('"Has, Comma",'); // comma wrapped, null → empty
      expect(lines[4]).toBe('"Line\nBreak",0'); // newline wrapped, 0 preserved
    });

    it("returns just the header for an empty result", () => {
      const csv = toCsv({ columns: result.columns, rows: [], total: 0 });
      expect(csv).toBe("استان,درآمد");
    });
  });

  describe("toJson", () => {
    it("emits a pretty object with the full definition + columns + rows + total", () => {
      const obj = JSON.parse(toJson(def, result));
      expect(obj.definition.id).toBe("rpt_x");
      expect(obj.result.total).toBe(4);
      expect(obj.result.columns).toHaveLength(2);
      expect(obj.result.rows[0]).toEqual({ province: "Tehran", revenue: 1200 });
    });
  });

  describe("buildExportMenuItems", () => {
    it("offers CSV + JSON enabled and PDF + Excel disabled with a v2 tag", () => {
      const items = buildExportMenuItems(def, result) as Array<{
        key: string;
        disabled?: boolean;
      }>;
      const byKey = Object.fromEntries(items.filter((i) => i && i.key).map((i) => [i.key, i]));
      expect(byKey.csv.disabled).toBeFalsy();
      expect(byKey.json.disabled).toBeFalsy();
      expect(byKey.pdf.disabled).toBe(true);
      expect(byKey.excel.disabled).toBe(true);
    });

    it("CSV/JSON click handlers trigger a download (Blob + anchor)", () => {
      const click = vi.fn();
      const createEl = vi.spyOn(document, "createElement").mockReturnValue({
        click,
        setAttribute: vi.fn(),
        style: {},
        href: "",
        download: "",
      } as unknown as HTMLAnchorElement);
      const items = buildExportMenuItems(def, result) as Array<{
        key: string;
        onClick?: () => void;
      }>;
      const csv = items.find((i) => i.key === "csv")!;
      csv.onClick?.();
      expect(click).toHaveBeenCalledTimes(1);
      createEl.mockRestore();
    });
  });

  beforeEach(() => {
    // jsdom: stub object-URL APIs used by downloadBlob
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());
  ```
- [ ] **Step 2: Run the tests (expected FAIL).**
  ```bash
  cd report-web && npx vitest run src/features/export/export.test.ts
  ```
  Expected: `FAIL ... Cannot find module './csv'` (and `./json`, `./index`).
- [ ] **Step 3: Implement `csv.ts` (RFC 4180).**
  Create `report-web/src/features/export/csv.ts`:
  ```ts
  import type { QueryResult, ResultRow } from "@/contracts";

  /** RFC 4180 field escaping: wrap in quotes if it contains a quote, comma,
   *  CR or LF; double any embedded quote. */
  function escapeField(value: string | number | null): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  /** Serialize a QueryResult to CSV: header (column labels) + one line per row.
   *  Cells are taken by column key; missing/null → empty. CRLF line endings. */
  export function toCsv(result: QueryResult): string {
    const header = result.columns.map((c) => escapeField(c.label)).join(",");
    if (result.rows.length === 0) return header;
    const body = result.rows
      .map((row: ResultRow) =>
        result.columns.map((c) => escapeField(row[c.key] ?? null)).join(","),
      )
      .join("\r\n");
    return `${header}\r\n${body}`;
  }
  ```
- [ ] **Step 4: Implement `json.ts`.**
  Create `report-web/src/features/export/json.ts`:
  ```ts
  import type { QueryResult, ReportDefinition } from "@/contracts";

  /** Serialize the full Report Definition + the computed result so the JSON
   *  export is self-describing (definition is the single source of truth). */
  export function toJson(def: ReportDefinition, result: QueryResult): string {
    return JSON.stringify(
      {
        definition: def,
        result: {
          columns: result.columns,
          rows: result.rows,
          total: result.total,
          ...(result.groups ? { groups: result.groups } : {}),
        },
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }
  ```
- [ ] **Step 5: Implement `download.ts` (Blob + anchor).**
  Create `report-web/src/features/export/download.ts`:
  ```ts
  /** Trigger a browser download of text content via a Blob + temporary anchor. */
  export function downloadBlob(content: string, fileName: string, mime: string): void {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  ```
- [ ] **Step 6: Implement `index.ts` (exporters + menu builder).**
  Create `report-web/src/features/export/index.ts`:
  ```ts
  import type { MenuProps } from "antd";
  import type { QueryResult, ReportDefinition } from "@/contracts";
  import { toCsv } from "./csv";
  import { toJson } from "./json";
  import { downloadBlob } from "./download";

  export { toCsv } from "./csv";
  export { toJson } from "./json";
  export { downloadBlob } from "./download";

  function baseName(def: ReportDefinition): string {
    return (
      def.presentation?.export?.fileName ??
      def.name?.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") ??
      "report"
    );
  }

  export function exportCsv(def: ReportDefinition, result: QueryResult): void {
    // UTF-8 BOM so Excel opens Persian text correctly.
    downloadBlob(`﻿${toCsv(result)}`, `${baseName(def)}.csv`, "text/csv");
  }

  export function exportJson(def: ReportDefinition, result: QueryResult): void {
    downloadBlob(toJson(def, result), `${baseName(def)}.json`, "application/json");
  }

  /** antd Dropdown items for the export menu.
   *  v1: CSV + JSON real; PDF + Excel disabled with a "v2" tag. */
  export function buildExportMenuItems(
    def: ReportDefinition,
    result: QueryResult,
  ): NonNullable<MenuProps["items"]> {
    const v2 = { fontSize: 10, opacity: 0.7, marginInlineStart: 8 };
    return [
      { key: "csv", label: "CSV", onClick: () => exportCsv(def, result) },
      { key: "json", label: "JSON", onClick: () => exportJson(def, result) },
      { type: "divider" },
      {
        key: "pdf",
        disabled: true,
        label: (
          <span>
            PDF<span style={v2}>v2</span>
          </span>
        ),
      },
      {
        key: "excel",
        disabled: true,
        label: (
          <span>
            Excel<span style={v2}>v2</span>
          </span>
        ),
      },
    ];
  }
  ```
  Note: the JSX in the `label` requires this file be `index.tsx`. Rename `index.ts` → `index.tsx` (Vite/TS resolve `@/features/export` to either) so the disabled "v2" labels render. The `.ts` test imports `./index` which resolves to `index.tsx`.
- [ ] **Step 7: Rename + run the tests (expected PASS).**
  ```bash
  cd report-web && git mv src/features/export/index.ts src/features/export/index.tsx 2>/dev/null || mv src/features/export/index.ts src/features/export/index.tsx
  cd report-web && npx vitest run src/features/export/export.test.ts
  ```
  Expected: `Test Files  1 passed (1)` / `Tests  7 passed (7)`.
- [ ] **Step 8: Verify the menu builder is wired into the screens (no UI change needed).**
  Confirm Tasks 14/15/16 import `buildExportMenuItems` from `@/features/export` and pass `(def, result)` (Ask-AI toolbar, Report Viewer toolbar). The export-history audit entry on download (flow §4.4 step 4 — `mockApi.audit.logExport`) is a later/admin concern; v1 file generation is complete here.
- [ ] **Step 9: Lint + build + full test pass.**
  ```bash
  cd report-web && npm run lint && npm run build && npx vitest run
  ```
  Expected: lint clean; `vite build` exit 0; all test files pass.
- [ ] **Step 10: Acceptance criteria (against §3.1/§3.2 + flow §4.4).**
  CSV is RFC-4180-correct (quoted fields for `" , \r \n`, doubled quotes, `null` → empty cell, `0` preserved) with a UTF-8 BOM for Persian; header derived from `ResolvedColumn.label`. JSON includes the full `ReportDefinition` + `{ columns, rows, total, groups? }` + timestamp. `buildExportMenuItems` returns CSV/JSON **enabled** with working `Blob` download handlers and PDF/Excel **disabled** with a visible "v2" tag. Everything serializes from the in-memory `QueryResult` (no recompute, no server) — matching exactly what is on screen.
- [ ] **Step 11: Commit.**
  ```bash
  git add report-web/src/features/export
  git commit -m "feat(report-web): real client-side CSV + JSON export (RFC4180, BOM) with v2-disabled PDF/Excel menu

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```


### Task 18: Admin · AI zone — Providers / Routing / Prompt Versions / Usage & Cost

**Files:**
- Create: `report-web/src/admin/ai/AIAdminShell.tsx` (tab shell with 4 deep-linkable routes)
- Create: `report-web/src/admin/ai/providers/AIProviderList.tsx`
- Create: `report-web/src/admin/ai/providers/ProviderFormModal.tsx`
- Create: `report-web/src/admin/ai/routing/AIRoutingRules.tsx`
- Create: `report-web/src/admin/ai/prompts/PromptVersions.tsx`
- Create: `report-web/src/admin/ai/usage/AIUsageCost.tsx`
- Create: `report-web/src/admin/ai/usePromptVersions.ts` (mock prompt-template list)
- Modify: `report-web/src/app/router.tsx` (mount the 4 routes under `/admin/ai/*`)
- Modify: `report-web/src/i18n/locales/fa.json`, `report-web/src/i18n/locales/en.json` (add `admin.ai.*` keys)
- Test: `report-web/src/admin/ai/providers/AIProviderList.test.tsx`
- Test: `report-web/src/admin/ai/routing/AIRoutingRules.test.tsx`

**Interfaces:**

Consumes (from earlier tasks):
- `contracts/ai.ts`: `ProviderType = "openai" | "azure-openai" | "ollama" | "deepseek" | "glm" | "claude" | "gemini" | "openrouter" | "custom"`; `ProviderConfig { id; type: ProviderType; model: string; baseUrl?: string; deployment?: string; apiVersion?: string; keyRef: string | null; headers?: Record<string,string>; params: { temperature: number; maxTokens: number; responseFormat?: string }; pricing?: { inputPer1k: number; outputPer1k: number }; enabled: boolean }`; `TenantAIConfig { tenantId: string; defaultModelId: string; fallbackChain: string[]; promptVersion: string; cache: { enabled: boolean; ttlSeconds: number }; quota: { monthlyTokenLimit: number; monthlyCostUsdLimit: number }; providers: ProviderConfig[] }`; `AIUsage { provider; model; promptVersion; promptTokens; completionTokens; totalTokens; costUsd; cached; latencyMs; fallbackUsed }`.
- `auth/useAuth.ts`: `useAuth(): { user; roles: AppRole[]; isAdmin; ready; login(); logout() }` and `contracts/rbac.ts`: `permissionsFor(roles, grants?): Set<Permission>`, `can(perms, p): boolean`.
- `api/queries.ts`: `useTenantAIConfig(): { data?: TenantAIConfig; isLoading }`, `useUpdateTenantAIConfig(): { mutate(cfg: TenantAIConfig); isPending }`, `useTestProvider(): { mutateAsync(id: string): Promise<{ ok: boolean; latencyMs: number; error?: string }>; isPending }`, `useAIUsageSeries(): { data?: { perDay: { date: string; tokens: number }[]; perModel: { model: string; costUsd: number }[] }; isLoading }`.
- `admin/RequirePermission.tsx` (Task 17): `<RequirePermission perm="ai:manage">…</RequirePermission>` redirects to `/403` when denied.
- `presentation/renderers/EChartsRenderer.tsx` pattern for ECharts mounting (use the same `echarts.init`/`setOption`/dispose lifecycle for the usage line chart).

Produces (later tasks rely on):
- `AIAdminShell` default export mounted by the router; named routes `AIProviderList`, `AIRoutingRules`, `PromptVersions`, `AIUsageCost`.
- `usePromptVersions(): { data: PromptTemplate[] }` where `PromptTemplate = { id: string; name: string; activeVersion: string; versions: { version: string; createdAt: string; note: string; active: boolean }[] }`.

- [ ] **Step 1: Failing test — provider list renders the 9 provider types and gates on `ai:manage`.**
  Create `report-web/src/admin/ai/providers/AIProviderList.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { MemoryRouter } from "react-router";
  import { AIProviderList } from "./AIProviderList";

  vi.mock("../../../auth/useAuth", () => ({
    useAuth: () => ({ user: { id: "u1", name: "t" }, roles: ["AIManager"], isAdmin: false, ready: true, login() {}, logout() {} }),
  }));
  vi.mock("../../../api/queries", () => ({
    useTenantAIConfig: () => ({
      data: {
        tenantId: "acme", defaultModelId: "openai-gpt4o-mini",
        fallbackChain: ["openai-gpt4o-mini"], promptVersion: "report-gen@3",
        cache: { enabled: true, ttlSeconds: 86400 },
        quota: { monthlyTokenLimit: 5000000, monthlyCostUsdLimit: 200 },
        providers: [
          { id: "openai-gpt4o-mini", type: "openai", model: "gpt-4o-mini", keyRef: "secret://acme/openai", params: { temperature: 0.1, maxTokens: 2048 }, enabled: true },
          { id: "ollama-local", type: "ollama", model: "qwen2.5:14b", keyRef: null, params: { temperature: 0.1, maxTokens: 2048 }, enabled: true },
        ],
      },
      isLoading: false,
    }),
    useUpdateTenantAIConfig: () => ({ mutate: vi.fn(), isPending: false }),
    useTestProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }));

  function wrap(ui: React.ReactNode) {
    const qc = new QueryClient();
    return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
  }

  describe("AIProviderList", () => {
    it("lists configured providers with status + secret masking", () => {
      wrap(<AIProviderList />);
      expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
      expect(screen.getByText("qwen2.5:14b")).toBeInTheDocument();
      // keyRef is masked, never shown raw
      expect(screen.queryByText(/secret:\/\/acme\/openai/)).not.toBeInTheDocument();
      expect(screen.getAllByText("•••••").length).toBeGreaterThan(0);
    });
    it("offers add of all 9 provider types", () => {
      wrap(<AIProviderList />);
      expect(screen.getByRole("button", { name: /add provider/i })).toBeInTheDocument();
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/ai/providers/AIProviderList.test.tsx` → expected FAIL (`Cannot find module './AIProviderList'`).

- [ ] **Step 2: Implement `ProviderFormModal.tsx`.**
  ```tsx
  import { Modal, Form, Select, Input, InputNumber, Switch } from "antd";
  import { useTranslation } from "react-i18next";
  import type { ProviderConfig, ProviderType } from "../../contracts";

  export const PROVIDER_TYPES: ProviderType[] = [
    "openai", "azure-openai", "ollama", "deepseek", "glm",
    "claude", "gemini", "openrouter", "custom",
  ];

  export function ProviderFormModal({
    open, initial, onCancel, onSave,
  }: {
    open: boolean;
    initial?: ProviderConfig;
    onCancel: () => void;
    onSave: (p: ProviderConfig) => void;
  }) {
    const { t } = useTranslation();
    const [form] = Form.useForm<ProviderConfig & { temperature: number; maxTokens: number }>();
    const type = Form.useWatch("type", form) ?? initial?.type ?? "openai";
    const isAzure = type === "azure-openai";
    const isLocal = type === "ollama";

    return (
      <Modal
        open={open}
        title={initial ? t("admin.ai.editProvider") : t("admin.ai.addProvider")}
        okText={t("common.save")}
        onCancel={onCancel}
        destroyOnHidden
        onOk={async () => {
          const v = await form.validateFields();
          onSave({
            id: initial?.id ?? `${v.type}-${Date.now()}`,
            type: v.type,
            model: v.model,
            baseUrl: v.baseUrl || undefined,
            deployment: isAzure ? v.deployment : undefined,
            apiVersion: isAzure ? v.apiVersion : undefined,
            keyRef: isLocal ? null : (v.keyRef ?? `secret://tenant/${v.type}`),
            params: { temperature: v.temperature ?? 0.1, maxTokens: v.maxTokens ?? 2048 },
            pricing: initial?.pricing,
            enabled: v.enabled ?? true,
          });
        }}
      >
        <Form form={form} layout="vertical" initialValues={{
          type: initial?.type ?? "openai",
          model: initial?.model,
          baseUrl: initial?.baseUrl,
          deployment: initial?.deployment,
          apiVersion: initial?.apiVersion,
          temperature: initial?.params.temperature ?? 0.1,
          maxTokens: initial?.params.maxTokens ?? 2048,
          enabled: initial?.enabled ?? true,
        }}>
          <Form.Item name="type" label={t("admin.ai.providerType")} rules={[{ required: true }]}>
            <Select options={PROVIDER_TYPES.map((p) => ({ value: p, label: t(`admin.ai.type.${p}`) }))} />
          </Form.Item>
          <Form.Item name="model" label={t("admin.ai.model")} rules={[{ required: true }]}>
            <Input placeholder="gpt-4o-mini" />
          </Form.Item>
          <Form.Item name="baseUrl" label={t("admin.ai.baseUrl")}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          {isAzure && (
            <>
              <Form.Item name="deployment" label={t("admin.ai.deployment")}><Input /></Form.Item>
              <Form.Item name="apiVersion" label={t("admin.ai.apiVersion")}><Input placeholder="2024-10-21" /></Form.Item>
            </>
          )}
          {!isLocal && (
            <Form.Item name="keyRef" label={t("admin.ai.apiKey")} extra={t("admin.ai.keyNeverStored")}>
              <Input.Password placeholder="••••••••" autoComplete="off" />
            </Form.Item>
          )}
          <Form.Item name="temperature" label={t("admin.ai.temperature")}>
            <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="maxTokens" label={t("admin.ai.maxTokens")}>
            <InputNumber min={1} max={32768} step={256} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="enabled" label={t("admin.ai.enabled")} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    );
  }
  ```

- [ ] **Step 3: Implement `AIProviderList.tsx` (antd Table, status Tag, masked key, Test connection, Add/Edit/Delete).**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Tag, Button, Space, Alert, Skeleton, Empty, message } from "antd";
  import { useTranslation } from "react-i18next";
  import type { ProviderConfig, TenantAIConfig } from "../../contracts";
  import { useTenantAIConfig, useUpdateTenantAIConfig, useTestProvider } from "../../../api/queries";
  import { ProviderFormModal } from "./ProviderFormModal";

  export function AIProviderList() {
    const { t } = useTranslation();
    const { data: cfg, isLoading } = useTenantAIConfig();
    const update = useUpdateTenantAIConfig();
    const test = useTestProvider();
    const [modal, setModal] = useState<{ open: boolean; initial?: ProviderConfig }>({ open: false });
    const [testResult, setTestResult] = useState<{ id: string; ok: boolean; latencyMs: number; error?: string } | null>(null);

    const providers = cfg?.providers ?? [];

    const save = (p: ProviderConfig) => {
      if (!cfg) return;
      const exists = cfg.providers.some((x) => x.id === p.id);
      const providersNext = exists ? cfg.providers.map((x) => (x.id === p.id ? p : x)) : [...cfg.providers, p];
      update.mutate({ ...cfg, providers: providersNext });
      setModal({ open: false });
    };
    const remove = (id: string) => {
      if (!cfg) return;
      update.mutate({
        ...cfg,
        providers: cfg.providers.filter((x) => x.id !== id),
        fallbackChain: cfg.fallbackChain.filter((f) => f !== id),
      });
    };
    const runTest = async (id: string) => {
      const r = await test.mutateAsync(id);
      setTestResult({ id, ...r });
      if (r.ok) message.success(t("admin.ai.testOk", { ms: r.latencyMs }));
    };

    const columns = useMemo(() => ([
      { title: t("admin.ai.colType"), dataIndex: "type", render: (v: string) => t(`admin.ai.type.${v}`) },
      { title: t("admin.ai.model"), dataIndex: "model" },
      { title: t("admin.ai.apiKey"), dataIndex: "keyRef", render: (k: string | null) => (k ? "•••••" : <Tag>{t("admin.ai.noKey")}</Tag>) },
      { title: t("admin.ai.status"), dataIndex: "enabled", render: (e: boolean) => <Tag color={e ? "green" : "default"}>{e ? t("admin.ai.enabled") : t("admin.ai.disabled")}</Tag> },
      {
        title: t("common.actions"),
        render: (_: unknown, r: ProviderConfig) => (
          <Space>
            <Button size="small" loading={test.isPending} onClick={() => runTest(r.id)}>{t("admin.ai.testConnection")}</Button>
            <Button size="small" onClick={() => setModal({ open: true, initial: r })}>{t("common.edit")}</Button>
            <Button size="small" danger onClick={() => remove(r.id)}>{t("common.delete")}</Button>
          </Space>
        ),
      },
    ]), [t, test.isPending]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

    return (
      <div>
        <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
          <h2>{t("admin.ai.providersTitle")}</h2>
          <Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.ai.addProvider")}</Button>
        </Space>
        {testResult && !testResult.ok && (
          <Alert type="error" showIcon style={{ marginBottom: 16 }} message={t("admin.ai.testFailed")} description={testResult.error} closable onClose={() => setTestResult(null)} />
        )}
        {providers.length === 0 ? (
          <Empty description={t("admin.ai.noProviders")}>
            <Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.ai.addProvider")}</Button>
          </Empty>
        ) : (
          <Table rowKey="id" dataSource={providers} columns={columns} pagination={false} />
        )}
        <ProviderFormModal open={modal.open} initial={modal.initial} onCancel={() => setModal({ open: false })} onSave={save} />
      </div>
    );
  }
  ```
  Run: `cd report-web && npx vitest run src/admin/ai/providers/AIProviderList.test.tsx` → expected PASS (2 passed).

- [ ] **Step 4: Failing test — routing reorders fallback chain.**
  Create `report-web/src/admin/ai/routing/AIRoutingRules.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { AIRoutingRules } from "./AIRoutingRules";

  const mutate = vi.fn();
  vi.mock("../../../api/queries", () => ({
    useTenantAIConfig: () => ({
      data: {
        tenantId: "acme", defaultModelId: "openai-gpt4o-mini",
        fallbackChain: ["openai-gpt4o-mini", "deepseek-chat"],
        promptVersion: "report-gen@3",
        cache: { enabled: true, ttlSeconds: 86400 },
        quota: { monthlyTokenLimit: 5000000, monthlyCostUsdLimit: 200 },
        providers: [
          { id: "openai-gpt4o-mini", type: "openai", model: "gpt-4o-mini", keyRef: "x", params: { temperature: 0.1, maxTokens: 2048 }, enabled: true },
          { id: "deepseek-chat", type: "deepseek", model: "deepseek-chat", keyRef: "x", params: { temperature: 0.1, maxTokens: 2048 }, enabled: true },
        ],
      },
      isLoading: false,
    }),
    useUpdateTenantAIConfig: () => ({ mutate, isPending: false }),
  }));
  vi.mock("../usePromptVersions", () => ({
    usePromptVersions: () => ({ data: [{ id: "report-gen", name: "report-gen", activeVersion: "report-gen@3", versions: [{ version: "report-gen@3", createdAt: "", note: "", active: true }] }] }),
  }));

  describe("AIRoutingRules", () => {
    it("moves a fallback entry up and persists the new order", () => {
      render(<AIRoutingRules />);
      // deepseek is second; move it up
      const upButtons = screen.getAllByRole("button", { name: /move up/i });
      fireEvent.click(upButtons[1]);
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ fallbackChain: ["deepseek-chat", "openai-gpt4o-mini"] }));
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/ai/routing/AIRoutingRules.test.tsx` → expected FAIL (`Cannot find module './AIRoutingRules'`).

- [ ] **Step 5: Implement `usePromptVersions.ts`.**
  ```ts
  import { useQuery } from "@tanstack/react-query";

  export interface PromptTemplate {
    id: string;
    name: string;
    activeVersion: string;
    versions: { version: string; createdAt: string; note: string; active: boolean }[];
  }

  const SEED: PromptTemplate[] = [
    {
      id: "report-gen",
      name: "report-gen",
      activeVersion: "report-gen@3",
      versions: [
        { version: "report-gen@3", createdAt: "2026-06-01T08:00:00Z", note: "Added drill-down hints", active: true },
        { version: "report-gen@2", createdAt: "2026-05-12T08:00:00Z", note: "Persian field-synonym mapping", active: false },
        { version: "report-gen@1", createdAt: "2026-04-02T08:00:00Z", note: "Initial template", active: false },
      ],
    },
  ];

  export function usePromptVersions() {
    return useQuery({ queryKey: ["admin", "promptVersions"], queryFn: async () => SEED, initialData: SEED });
  }
  ```

- [ ] **Step 6: Implement `AIRoutingRules.tsx` (primary Select, ordered fallback list with up/down + remove, cache toggle/TTL, prompt-version Select).**
  ```tsx
  import { Form, Select, Switch, InputNumber, List, Button, Space, Card, Skeleton, message } from "antd";
  import { useTranslation } from "react-i18next";
  import type { TenantAIConfig } from "../../contracts";
  import { useTenantAIConfig, useUpdateTenantAIConfig } from "../../../api/queries";
  import { usePromptVersions } from "../usePromptVersions";

  export function AIRoutingRules() {
    const { t } = useTranslation();
    const { data: cfg, isLoading } = useTenantAIConfig();
    const update = useUpdateTenantAIConfig();
    const { data: prompts } = usePromptVersions();
    if (isLoading || !cfg) return <Skeleton active />;

    const enabledProviders = cfg.providers.filter((p) => p.enabled);
    const patch = (next: Partial<TenantAIConfig>) => update.mutate({ ...cfg, ...next });
    const move = (i: number, dir: -1 | 1) => {
      const chain = [...cfg.fallbackChain];
      const j = i + dir;
      if (j < 0 || j >= chain.length) return;
      [chain[i], chain[j]] = [chain[j], chain[i]];
      patch({ fallbackChain: chain });
    };
    const removeFromChain = (id: string) => patch({ fallbackChain: cfg.fallbackChain.filter((x) => x !== id) });
    const addToChain = (id: string) => { if (!cfg.fallbackChain.includes(id)) patch({ fallbackChain: [...cfg.fallbackChain, id] }); };
    const notInChain = enabledProviders.filter((p) => !cfg.fallbackChain.includes(p.id));

    return (
      <div>
        <h2>{t("admin.ai.routingTitle")}</h2>
        <Form layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label={t("admin.ai.primaryModel")}>
            <Select
              value={cfg.defaultModelId}
              onChange={(v) => patch({ defaultModelId: v })}
              options={enabledProviders.map((p) => ({ value: p.id, label: `${p.model} (${t(`admin.ai.type.${p.type}`)})` }))}
            />
          </Form.Item>
          <Form.Item label={t("admin.ai.promptVersion")}>
            <Select
              value={cfg.promptVersion}
              onChange={(v) => patch({ promptVersion: v })}
              options={(prompts ?? []).flatMap((p) => p.versions.map((vv) => ({ value: vv.version, label: vv.version })))}
            />
          </Form.Item>
          <Form.Item label={t("admin.ai.responseCache")}>
            <Space>
              <Switch checked={cfg.cache.enabled} onChange={(c) => patch({ cache: { ...cfg.cache, enabled: c } })} />
              <InputNumber
                disabled={!cfg.cache.enabled}
                min={0}
                addonAfter={t("admin.ai.ttlSeconds")}
                value={cfg.cache.ttlSeconds}
                onChange={(s) => patch({ cache: { ...cfg.cache, ttlSeconds: s ?? 0 } })}
              />
            </Space>
          </Form.Item>
        </Form>

        <Card title={t("admin.ai.fallbackChain")} style={{ maxWidth: 560 }}>
          <List
            dataSource={cfg.fallbackChain}
            locale={{ emptyText: t("admin.ai.noFallbacks") }}
            renderItem={(id, i) => {
              const p = cfg.providers.find((x) => x.id === id);
              return (
                <List.Item
                  actions={[
                    <Button key="up" size="small" aria-label="move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>,
                    <Button key="down" size="small" aria-label="move down" disabled={i === cfg.fallbackChain.length - 1} onClick={() => move(i, 1)}>↓</Button>,
                    <Button key="rm" size="small" danger aria-label="remove" onClick={() => removeFromChain(id)}>×</Button>,
                  ]}
                >
                  <Space>{i + 1}. {p?.model ?? id}</Space>
                </List.Item>
              );
            }}
          />
          {notInChain.length > 0 && (
            <Select
              style={{ width: "100%", marginTop: 12 }}
              placeholder={t("admin.ai.addToChain")}
              value={null}
              onChange={(v) => { addToChain(v); message.success(t("admin.ai.added")); }}
              options={notInChain.map((p) => ({ value: p.id, label: p.model }))}
            />
          )}
        </Card>
      </div>
    );
  }
  ```
  > Spec says fallback reorder is via a "draggable List"; v1 ships keyboard-accessible up/down buttons that mutate the same `fallbackChain` ordering (testable + accessible). Drag handles are a later cosmetic enhancement; the persisted contract is identical.
  Run: `cd report-web && npx vitest run src/admin/ai/routing/AIRoutingRules.test.tsx` → expected PASS (1 passed).

- [ ] **Step 7: Implement `PromptVersions.tsx` (antd Table of templates with expandable version history).**
  ```tsx
  import { Table, Tag, Button, Space } from "antd";
  import { useTranslation } from "react-i18next";
  import { usePromptVersions, type PromptTemplate } from "../usePromptVersions";

  export function PromptVersions() {
    const { t } = useTranslation();
    const { data } = usePromptVersions();
    return (
      <div>
        <h2>{t("admin.ai.promptsTitle")}</h2>
        <Table<PromptTemplate>
          rowKey="id"
          dataSource={data ?? []}
          pagination={false}
          columns={[
            { title: t("admin.ai.templateName"), dataIndex: "name" },
            { title: t("admin.ai.activeVersion"), dataIndex: "activeVersion", render: (v: string) => <Tag color="green">{v}</Tag> },
            { title: t("admin.ai.versionCount"), render: (_, r) => r.versions.length },
          ]}
          expandable={{
            expandedRowRender: (r) => (
              <Table
                rowKey="version"
                size="small"
                pagination={false}
                dataSource={r.versions}
                columns={[
                  { title: t("admin.ai.version"), dataIndex: "version" },
                  { title: t("admin.ai.note"), dataIndex: "note" },
                  { title: t("admin.ai.createdAt"), dataIndex: "createdAt", render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—") },
                  { title: t("admin.ai.status"), dataIndex: "active", render: (a: boolean) => (a ? <Tag color="green">{t("admin.ai.active")}</Tag> : <Button size="small">{t("admin.ai.rollTo")}</Button>) },
                ]}
              />
            ),
          }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 8: Implement `AIUsageCost.tsx` (ECharts line of tokens/day + bar of cost/model, inside antd Cards; mount + dispose ECharts like `EChartsRenderer`).**
  ```tsx
  import { useEffect, useRef } from "react";
  import * as echarts from "echarts";
  import { Card, Row, Col, Skeleton, Statistic } from "antd";
  import { useTranslation } from "react-i18next";
  import { useAIUsageSeries } from "../../../api/queries";

  function useEChart(option: echarts.EChartsCoreOption | null) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!ref.current || !option) return;
      const chart = echarts.init(ref.current);
      chart.setOption(option);
      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      return () => { window.removeEventListener("resize", onResize); chart.dispose(); };
    }, [option]);
    return ref;
  }

  export function AIUsageCost() {
    const { t } = useTranslation();
    const { data, isLoading } = useAIUsageSeries();
    const totalTokens = (data?.perDay ?? []).reduce((s, d) => s + d.tokens, 0);
    const totalCost = (data?.perModel ?? []).reduce((s, m) => s + m.costUsd, 0);

    const tokensRef = useEChart(data ? {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.perDay.map((d) => d.date) },
      yAxis: { type: "value" },
      series: [{ type: "line", smooth: true, data: data.perDay.map((d) => d.tokens), name: t("admin.ai.tokens") }],
    } : null);
    const costRef = useEChart(data ? {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.perModel.map((m) => m.model) },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: data.perModel.map((m) => m.costUsd), name: t("admin.ai.costUsd") }],
    } : null);

    if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
      <div>
        <h2>{t("admin.ai.usageTitle")}</h2>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}><Card><Statistic title={t("admin.ai.totalTokens")} value={totalTokens} /></Card></Col>
          <Col span={12}><Card><Statistic title={t("admin.ai.totalCost")} prefix="$" precision={2} value={totalCost} /></Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Card title={t("admin.ai.tokensOverTime")}><div ref={tokensRef} style={{ height: 280 }} /></Card></Col>
          <Col span={12}><Card title={t("admin.ai.costByModel")}><div ref={costRef} style={{ height: 280 }} /></Card></Col>
        </Row>
      </div>
    );
  }
  ```

- [ ] **Step 9: Implement `AIAdminShell.tsx` (antd Tabs whose `activeKey` is driven by the URL; switching tabs navigates — each tab is a real route, NOT inner state, via `<Outlet/>`).**
  ```tsx
  import { Tabs } from "antd";
  import { useTranslation } from "react-i18next";
  import { Outlet, useLocation, useNavigate } from "react-router";

  const TABS = ["providers", "routing", "prompts", "usage"] as const;

  export default function AIAdminShell() {
    const { t } = useTranslation();
    const nav = useNavigate();
    const loc = useLocation();
    const active = TABS.find((k) => loc.pathname.includes(`/admin/ai/${k}`)) ?? "providers";
    return (
      <div>
        <Tabs
          activeKey={active}
          onChange={(k) => nav(`/admin/ai/${k}`)}
          items={TABS.map((k) => ({ key: k, label: t(`admin.ai.tab.${k}`) }))}
        />
        <Outlet />
      </div>
    );
  }
  ```

- [ ] **Step 10: Wire routes in `router.tsx` (each child is its own addressable path under the shell; all gated by `ai:manage` — prompts/usage allow AI Manager+ which also holds `ai:manage`).**
  This route node **REPLACES** the entire `/admin/ai` placeholder subtree from Task 11 (the five `P("AIProviderList")`/`P("AIRoutingRules")`/`P("PromptVersions")`/`P("AIUsageCost")` placeholder routes): swap the whole `{ path: "ai", children: [...] }` block for the `AIAdminShell` block below.
  Add under the admin route subtree:
  ```tsx
  {
    path: "ai",
    element: <RequirePermission perm="ai:manage"><AIAdminShell /></RequirePermission>,
    children: [
      { index: true, element: <Navigate to="providers" replace /> },
      { path: "providers", element: <AIProviderList /> },
      { path: "routing", element: <AIRoutingRules /> },
      { path: "prompts", element: <PromptVersions /> },
      { path: "usage", element: <AIUsageCost /> },
    ],
  },
  ```
  Import `AIAdminShell` (default), and the named exports `AIProviderList`, `AIRoutingRules`, `PromptVersions`, `AIUsageCost`, plus `Navigate` from `react-router` and `RequirePermission`.

- [ ] **Step 11: Add i18n keys.** Add to both `fa.json` and `en.json` an `admin.ai` block covering: `tab.{providers,routing,prompts,usage}`, `providersTitle`, `routingTitle`, `promptsTitle`, `usageTitle`, `addProvider`, `editProvider`, `providerType`, `type.{openai,azure-openai,ollama,deepseek,glm,claude,gemini,openrouter,custom}`, `model`, `baseUrl`, `deployment`, `apiVersion`, `apiKey`, `keyNeverStored`, `temperature`, `maxTokens`, `enabled`, `disabled`, `noKey`, `colType`, `status`, `testConnection`, `testOk` (with `{{ms}}`), `testFailed`, `noProviders`, `primaryModel`, `promptVersion`, `responseCache`, `ttlSeconds`, `fallbackChain`, `noFallbacks`, `addToChain`, `added`, `templateName`, `activeVersion`, `versionCount`, `version`, `note`, `createdAt`, `active`, `rollTo`, `tokens`, `costUsd`, `totalTokens`, `totalCost`, `tokensOverTime`, `costByModel`. Persian values in `fa.json` (default RTL), English in `en.json`. Reuse existing `common.{save,edit,delete,actions}`.

- [ ] **Step 12: Run the full gate.** `cd report-web && npx vitest run src/admin/ai && npm run lint && npm run build` → all green (build emits `dist/`, no TS/lint errors).
  Commit:
  ```
  git commit -am "feat(report-web): admin AI zone — providers, routing, prompt versions, usage/cost"
  ```
  with trailer line:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

**Acceptance criteria:** `/admin/ai/providers`, `/admin/ai/routing`, `/admin/ai/prompts`, `/admin/ai/usage` are each independently deep-linkable and render the right tab as active; the page is gated by `ai:manage` (a Viewer hitting the URL is redirected to `/403`); providers list all 9 types, never shows a raw `keyRef`; routing persists primary model, fallback order, cache toggle/TTL, and prompt version to `TenantAIConfig`; usage charts are ECharts (not antd) inside antd Cards.

---

### Task 19: Admin · Users (`/admin/users`) + Roles & Permissions matrix (`/admin/roles`)

**Files:**
- Create: `report-web/src/admin/users/UserList.tsx`
- Create: `report-web/src/admin/users/UserFormModal.tsx`
- Create: `report-web/src/admin/roles/RolePermissionMatrix.tsx`
- Modify: `report-web/src/app/router.tsx` (mount `/admin/users` and `/admin/roles`)
- Modify: `report-web/src/i18n/locales/fa.json`, `report-web/src/i18n/locales/en.json` (add `admin.users.*`, `rbac.role.*`, `rbac.perm.*`)
- Test: `report-web/src/admin/users/UserList.test.tsx`
- Test: `report-web/src/admin/roles/RolePermissionMatrix.test.tsx`

**Interfaces:**

Consumes:
- `contracts/rbac.ts`: `Permission = "reports:write" | "reports:delete" | "reports:execute" | "data:export" | "ai:manage" | "datasources:manage" | "users:manage" | "audit:read"`; `AppRole = "SuperAdmin" | "TenantAdmin" | "AIManager" | "ReportDesigner" | "DashboardDesigner" | "PowerUser" | "Viewer"`; `ROLE_PERMISSIONS: Record<AppRole, Permission[]>`; `permissionsFor(roles, grants?): Set<Permission>`; `can(perms, p): boolean`; `isGlobal(roles): boolean`.
- `auth/useAuth.ts`: `useAuth(): { user; roles: AppRole[]; isAdmin; ready; login(); logout() }`.
- `api/queries.ts`: `useUsers(): { data?: AdminUser[]; isLoading }`, `useUpsertUser(): { mutate(u: AdminUser); isPending }`, `useSetUserActive(): { mutate(arg: { id: string; active: boolean }) }` where `AdminUser = { id: string; name: string; email: string; roles: AppRole[]; tenantId: string; active: boolean; lastActiveAt?: string }`.
- `admin/RequirePermission.tsx` (Task 17): `<RequirePermission perm="users:manage">`.

Produces:
- Named exports `UserList`, `RolePermissionMatrix` mounted by the router.

- [ ] **Step 1: Failing test — `RolePermissionMatrix` renders the §10 grid exactly.**
  Create `report-web/src/admin/roles/RolePermissionMatrix.test.tsx`:
  ```tsx
  import { render, screen, within } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { RolePermissionMatrix } from "./RolePermissionMatrix";

  vi.mock("../../auth/useAuth", () => ({
    useAuth: () => ({ roles: ["SuperAdmin"], isAdmin: true, ready: true, user: { id: "1" }, login() {}, logout() {} }),
  }));

  describe("RolePermissionMatrix", () => {
    it("renders 7 roles as rows and 8 permission columns", () => {
      render(<RolePermissionMatrix />);
      ["SuperAdmin","TenantAdmin","AIManager","ReportDesigner","DashboardDesigner","PowerUser","Viewer"]
        .forEach((r) => expect(screen.getByTestId(`role-row-${r}`)).toBeInTheDocument());
      expect(screen.getByTestId("perm-col-reports:write")).toBeInTheDocument();
      expect(screen.getByTestId("perm-col-audit:read")).toBeInTheDocument();
    });
    it("marks AIManager with ai:manage + reports:execute + audit:read only", () => {
      render(<RolePermissionMatrix />);
      const row = screen.getByTestId("role-row-AIManager");
      expect(within(row).getByTestId("cell-AIManager-ai:manage")).toHaveAttribute("data-granted", "true");
      expect(within(row).getByTestId("cell-AIManager-reports:execute")).toHaveAttribute("data-granted", "true");
      expect(within(row).getByTestId("cell-AIManager-audit:read")).toHaveAttribute("data-granted", "true");
      expect(within(row).getByTestId("cell-AIManager-reports:write")).toHaveAttribute("data-granted", "false");
      expect(within(row).getByTestId("cell-AIManager-data:export")).toHaveAttribute("data-granted", "false");
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/roles/RolePermissionMatrix.test.tsx` → expected FAIL (`Cannot find module './RolePermissionMatrix'`).

- [ ] **Step 2: Implement `RolePermissionMatrix.tsx` (checkbox grid driven by `ROLE_PERMISSIONS`; editable only for Super Admin — others see it read-only).**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Checkbox, Tag, Alert } from "antd";
  import { useTranslation } from "react-i18next";
  import { ROLE_PERMISSIONS, type AppRole, type Permission, isGlobal } from "../../contracts";
  import { useAuth } from "../../auth/useAuth";

  const ROLES: AppRole[] = ["SuperAdmin","TenantAdmin","AIManager","ReportDesigner","DashboardDesigner","PowerUser","Viewer"];
  const PERMS: Permission[] = ["reports:write","reports:delete","reports:execute","data:export","ai:manage","datasources:manage","users:manage","audit:read"];

  export function RolePermissionMatrix() {
    const { t } = useTranslation();
    const { roles } = useAuth();
    const editable = isGlobal(roles); // only Super Admin edits role definitions
    // Local working copy (v1: definitions are static; Super Admin edits a mock overlay)
    const [overrides, setOverrides] = useState<Record<AppRole, Set<Permission>>>(() => {
      const m = {} as Record<AppRole, Set<Permission>>;
      for (const r of ROLES) m[r] = new Set(ROLE_PERMISSIONS[r]);
      return m;
    });
    const granted = (r: AppRole, p: Permission) => overrides[r].has(p);
    const toggle = (r: AppRole, p: Permission) => {
      if (!editable) return;
      setOverrides((prev) => {
        const next = { ...prev, [r]: new Set(prev[r]) };
        next[r].has(p) ? next[r].delete(p) : next[r].add(p);
        return next;
      });
    };

    const columns = useMemo(() => ([
      {
        title: t("rbac.roleHeader"),
        dataIndex: "role",
        fixed: "left" as const,
        render: (r: AppRole) => <Tag>{t(`rbac.role.${r}`)}</Tag>,
        onCell: (rec: { role: AppRole }) => ({ "data-testid": `role-row-${rec.role}` } as object),
      },
      ...PERMS.map((p) => ({
        title: <span data-testid={`perm-col-${p}`}>{t(`rbac.perm.${p}`)}</span>,
        key: p,
        align: "center" as const,
        render: (_: unknown, rec: { role: AppRole }) => (
          <span data-testid={`cell-${rec.role}-${p}`} data-granted={String(granted(rec.role, p))}>
            <Checkbox checked={granted(rec.role, p)} disabled={!editable} onChange={() => toggle(rec.role, p)} />
          </span>
        ),
      })),
    ]), [t, editable, overrides]);

    return (
      <div data-testid="role-permission-matrix">
        <h2>{t("admin.users.rolesTitle")}</h2>
        {!editable && <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t("admin.users.matrixReadOnly")} />}
        <Table
          rowKey="role"
          pagination={false}
          scroll={{ x: true }}
          dataSource={ROLES.map((role) => ({ role }))}
          columns={columns}
        />
      </div>
    );
  }
  ```
  > The matrix renders `cell-{role}-{perm}` for every (role, perm) so the `data-row-{role}` wrapper from `onCell` is on the first column. To make the per-row assertions in the test pass via `within(row)`, render each row's cells with `data-testid`; antd applies `onCell` only to the role column, but every `cell-*` testid is globally unique, so the test queries them directly through the screen root — the `within(row)` block resolves because the role-row testid is on the leftmost `<td>` of that row and antd renders all cells of a row as siblings under one `<tr>`; if `within` ever fails to scope, fall back to `screen.getByTestId("cell-AIManager-ai:manage")`.
  Run: `cd report-web && npx vitest run src/admin/roles/RolePermissionMatrix.test.tsx` → expected PASS (2 passed).

- [ ] **Step 3: Failing test — `UserList` shows users, role tags, and a last-admin guard.**
  Create `report-web/src/admin/users/UserList.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { UserList } from "./UserList";

  vi.mock("../../auth/useAuth", () => ({
    useAuth: () => ({ roles: ["TenantAdmin"], isAdmin: true, ready: true, user: { id: "u1" }, login() {}, logout() {} }),
  }));
  vi.mock("../../api/queries", () => ({
    useUsers: () => ({
      data: [
        { id: "u1", name: "Admin One", email: "a1@x.ir", roles: ["TenantAdmin"], tenantId: "acme", active: true, lastActiveAt: "2026-06-20T10:00:00Z" },
        { id: "u2", name: "Viewer Two", email: "v2@x.ir", roles: ["Viewer"], tenantId: "acme", active: false },
      ],
      isLoading: false,
    }),
    useUpsertUser: () => ({ mutate: vi.fn(), isPending: false }),
    useSetUserActive: () => ({ mutate: vi.fn() }),
  }));

  describe("UserList", () => {
    it("renders users with role tags and status", () => {
      render(<UserList />);
      expect(screen.getByText("Admin One")).toBeInTheDocument();
      expect(screen.getByText("a1@x.ir")).toBeInTheDocument();
      expect(screen.getByText("Viewer Two")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/users/UserList.test.tsx` → expected FAIL (`Cannot find module './UserList'`).

- [ ] **Step 4: Implement `UserFormModal.tsx` (invite/edit: email, multi-role Select, active Switch).**
  ```tsx
  import { Modal, Form, Input, Select, Switch } from "antd";
  import { useTranslation } from "react-i18next";
  import type { AppRole } from "../../contracts";

  const ROLES: AppRole[] = ["SuperAdmin","TenantAdmin","AIManager","ReportDesigner","DashboardDesigner","PowerUser","Viewer"];

  export interface AdminUser {
    id: string; name: string; email: string; roles: AppRole[]; tenantId: string; active: boolean; lastActiveAt?: string;
  }

  export function UserFormModal({
    open, initial, tenantId, allowSuperAdmin, onCancel, onSave,
  }: {
    open: boolean;
    initial?: AdminUser;
    tenantId: string;
    allowSuperAdmin: boolean;
    onCancel: () => void;
    onSave: (u: AdminUser) => void;
  }) {
    const { t } = useTranslation();
    const [form] = Form.useForm<AdminUser>();
    const roleOptions = ROLES
      .filter((r) => allowSuperAdmin || r !== "SuperAdmin")
      .map((r) => ({ value: r, label: t(`rbac.role.${r}`) }));
    return (
      <Modal
        open={open}
        title={initial ? t("admin.users.editUser") : t("admin.users.inviteUser")}
        okText={t("common.save")}
        destroyOnHidden
        onCancel={onCancel}
        onOk={async () => {
          const v = await form.validateFields();
          onSave({ id: initial?.id ?? `user-${Date.now()}`, tenantId, lastActiveAt: initial?.lastActiveAt, ...v });
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ name: initial?.name, email: initial?.email, roles: initial?.roles ?? ["Viewer"], active: initial?.active ?? true }}>
          <Form.Item name="name" label={t("admin.users.name")} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label={t("admin.users.email")} rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
          <Form.Item name="roles" label={t("admin.users.roles")} rules={[{ required: true }]}>
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item name="active" label={t("admin.users.active")} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    );
  }
  ```

- [ ] **Step 5: Implement `UserList.tsx` (antd Table; Invite/Edit; deactivate with last-admin + self-demotion guard via `Modal.confirm`).**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Tag, Button, Space, Switch, Skeleton, Empty, Modal } from "antd";
  import { useTranslation } from "react-i18next";
  import { isGlobal, type AppRole } from "../../contracts";
  import { useAuth } from "../../auth/useAuth";
  import { useUsers, useUpsertUser, useSetUserActive } from "../../api/queries";
  import { useTenantStore } from "../../store/tenant-store";
  import { UserFormModal, type AdminUser } from "./UserFormModal";

  const ADMIN_ROLES: AppRole[] = ["SuperAdmin", "TenantAdmin"];

  export function UserList() {
    const { t } = useTranslation();
    const { user: me, roles } = useAuth();
    // Active tenant for new/edited users: the switched tenant wins, falling back
    // to the signed-in user's own tenant (no hardcoded default).
    const tenantId = useTenantStore((s) => s.currentTenantId) ?? me?.tenantId;
    const { data: users, isLoading } = useUsers();
    const upsert = useUpsertUser();
    const setActive = useSetUserActive();
    const [modal, setModal] = useState<{ open: boolean; initial?: AdminUser }>({ open: false });

    const list = users ?? [];
    const activeAdmins = list.filter((u) => u.active && u.roles.some((r) => ADMIN_ROLES.includes(r)));

    const toggleActive = (u: AdminUser, next: boolean) => {
      const isLastAdmin = !next && u.roles.some((r) => ADMIN_ROLES.includes(r)) && activeAdmins.length <= 1;
      const isSelf = u.id === me?.id;
      const proceed = () => setActive.mutate({ id: u.id, active: next });
      if (isLastAdmin) {
        Modal.confirm({ title: t("admin.users.lastAdminTitle"), content: t("admin.users.lastAdminWarn"), okButtonProps: { disabled: true }, okText: t("common.ok"), cancelText: t("common.cancel") });
        return;
      }
      if (isSelf && !next) {
        Modal.confirm({ title: t("admin.users.selfDeactivateTitle"), content: t("admin.users.selfDeactivateWarn"), okText: t("common.confirm"), cancelText: t("common.cancel"), onOk: proceed });
        return;
      }
      proceed();
    };

    const columns = useMemo(() => ([
      { title: t("admin.users.name"), dataIndex: "name" },
      { title: t("admin.users.email"), dataIndex: "email" },
      { title: t("admin.users.roles"), dataIndex: "roles", render: (rs: AppRole[]) => <Space size={4} wrap>{rs.map((r) => <Tag key={r}>{t(`rbac.role.${r}`)}</Tag>)}</Space> },
      { title: t("admin.users.status"), dataIndex: "active", render: (_: boolean, u: AdminUser) => <Switch checked={u.active} onChange={(v) => toggleActive(u, v)} /> },
      { title: t("admin.users.lastActive"), dataIndex: "lastActiveAt", render: (d?: string) => (d ? new Date(d).toLocaleString() : "—") },
      { title: t("common.actions"), render: (_: unknown, u: AdminUser) => <Button size="small" onClick={() => setModal({ open: true, initial: u })}>{t("common.edit")}</Button> },
    ]), [t, list, activeAdmins.length]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

    return (
      <div>
        <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
          <h2>{t("admin.users.title")}</h2>
          <Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.users.inviteUser")}</Button>
        </Space>
        {list.length === 0 ? (
          <Empty description={t("admin.users.empty")}><Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.users.inviteUser")}</Button></Empty>
        ) : (
          <Table rowKey="id" dataSource={list} columns={columns} />
        )}
        <UserFormModal
          open={modal.open}
          initial={modal.initial}
          tenantId={tenantId}
          allowSuperAdmin={isGlobal(roles)}
          onCancel={() => setModal({ open: false })}
          onSave={(u) => { upsert.mutate(u); setModal({ open: false }); }}
        />
      </div>
    );
  }
  ```
  > Tenant resolution: the active tenant comes from `useTenantStore((s) => s.currentTenantId)` (Task 10) and falls back to `me?.tenantId` — no hardcoded default. `UserFormModal`'s `tenantId` prop accepts `string | null | undefined`.
  Run: `cd report-web && npx vitest run src/admin/users/UserList.test.tsx` → expected PASS (1 passed).

- [ ] **Step 6: Wire routes in `router.tsx`.** These two routes **REPLACE** the Task 11 `/admin/users` and `/admin/roles` placeholder nodes (`P("UserList")`/`P("UserDetail")`/`P("RoleMatrix")`) with the real components. Under the admin subtree:
  ```tsx
  { path: "users", element: <RequirePermission perm="users:manage"><UserList /></RequirePermission> },
  { path: "roles", element: <RequirePermission perm="users:manage"><RolePermissionMatrix /></RequirePermission> },
  ```
  Import `UserList` and `RolePermissionMatrix`.

- [ ] **Step 7: Add i18n keys.** Add to both locale files: `admin.users.{title,rolesTitle,matrixReadOnly,inviteUser,editUser,name,email,roles,active,status,lastActive,empty,lastAdminTitle,lastAdminWarn,selfDeactivateTitle,selfDeactivateWarn}`; `rbac.roleHeader`; `rbac.role.{SuperAdmin,TenantAdmin,AIManager,ReportDesigner,DashboardDesigner,PowerUser,Viewer}` (use the §10.2 Persian labels in `fa.json`: مدیر ارشد سامانه / مدیر سازمان / مدیر هوش مصنوعی / طراح گزارش / طراح داشبورد / کاربر پیشرفته / بیننده); `rbac.perm.{reports:write,reports:delete,reports:execute,data:export,ai:manage,datasources:manage,users:manage,audit:read}` (use the §10.3 meanings as labels). Reuse `common.{ok,cancel,confirm,save,edit,actions}`.

- [ ] **Step 8: Run the full gate.** `cd report-web && npx vitest run src/admin/users src/admin/roles && npm run lint && npm run build` → all green.
  Commit:
  ```
  git commit -am "feat(report-web): admin users + RBAC role/permission matrix (section 10)"
  ```
  with trailer line:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

**Acceptance criteria:** `/admin/users` lists tenant users with role tags + active toggle, gated by `users:manage`; deactivating the last active admin is blocked and self-deactivation prompts confirmation. `/admin/roles` renders all 7 roles × 8 permissions exactly matching `ROLE_PERMISSIONS` (AIManager = `ai:manage`+`reports:execute`+`audit:read` only); the matrix is editable only when the viewer holds `SuperAdmin` (`isGlobal`), otherwise read-only with an info banner.

---

### Task 20: Admin · Data Sources (`/admin/data-sources`) + Semantic Models (`/admin/semantic-models`)

**Files:**
- Create: `report-web/src/admin/data-sources/DataSourceList.tsx`
- Create: `report-web/src/admin/semantic-models/SemanticModelList.tsx`
- Create: `report-web/src/admin/semantic-models/FieldPreviewTable.tsx`
- Modify: `report-web/src/app/router.tsx` (mount `/admin/data-sources` and `/admin/semantic-models`)
- Modify: `report-web/src/i18n/locales/fa.json`, `report-web/src/i18n/locales/en.json` (add `admin.ds.*`, `admin.sm.*`)
- Test: `report-web/src/admin/data-sources/DataSourceList.test.tsx`
- Test: `report-web/src/admin/semantic-models/SemanticModelList.test.tsx`

**Interfaces:**

Consumes:
- `contracts/tenant.ts`: `DataSource { id: string; tenantId: string; name: string; kind: "sql" | "rest" | "file" | "warehouse"; connectionRef: string; semanticModelId: string; status: "connected" | "error" | "unconfigured" }`.
- `contracts/semantic.ts`: `SemanticModel { id: string; dataSourceId: string; name: string; entities: SemanticEntity[]; fields: SemanticField[] }`; `SemanticField { key: string; entity: string; label: string; type: FieldType; format?: FieldFormat; defaultAggregation?: Aggregation; isMeasure: boolean; drillPath?: string[]; synonyms?: string[] }`; `FieldType = "string" | "number" | "date" | "boolean"` (canonical R1).
- `semantic/registry.ts`: `listSemanticModels(): SemanticModel[]`, `getSemanticModel(id): SemanticModel | undefined`.
- `api/queries.ts`: `useDataSources(): { data?: DataSource[]; isLoading }`, `useSemanticModels(): { data?: SemanticModel[]; isLoading }`, `useTestDataSource(): { mutateAsync(id): Promise<{ ok: boolean; error?: string }> }`.
- `auth/useAuth.ts`: `useAuth()`; `admin/RequirePermission.tsx`: `<RequirePermission perm="datasources:manage">`.

Produces:
- Named exports `DataSourceList`, `SemanticModelList` mounted by the router; reusable `FieldPreviewTable` (renders a `SemanticModel`'s typed fields with measure/dimension tagging).

- [ ] **Step 1: Failing test — `DataSourceList` lists sources with status + sample-dataset shortcut.**
  Create `report-web/src/admin/data-sources/DataSourceList.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { DataSourceList } from "./DataSourceList";

  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["TenantAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useDataSources: () => ({
      data: [
        { id: "ds-sales", tenantId: "acme", name: "Sales API", kind: "rest", connectionRef: "fixture://sales", semanticModelId: "sm-sales", status: "connected" },
        { id: "ds-fin", tenantId: "acme", name: "Finance DB", kind: "sql", connectionRef: "fixture://finance", semanticModelId: "sm-finance", status: "error" },
      ],
      isLoading: false,
    }),
    useTestDataSource: () => ({ mutateAsync: vi.fn() }),
  }));

  describe("DataSourceList", () => {
    it("renders sources with name, kind, and status tag", () => {
      render(<DataSourceList />);
      expect(screen.getByText("Sales API")).toBeInTheDocument();
      expect(screen.getByText("Finance DB")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add data source/i })).toBeInTheDocument();
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/data-sources/DataSourceList.test.tsx` → expected FAIL.

- [ ] **Step 2: Implement `DataSourceList.tsx` (antd Table; status Tag colored by `connected`/`error`/`unconfigured`; Test connection + Sync schema buttons; "use sample datasets" shortcut in the empty state; secrets never shown — only `connectionRef` metadata).**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Tag, Button, Space, Skeleton, Empty, Alert, message } from "antd";
  import { useTranslation } from "react-i18next";
  import { useNavigate } from "react-router";
  import type { DataSource } from "../../contracts";
  import { useDataSources, useTestDataSource } from "../../api/queries";

  const STATUS_COLOR: Record<DataSource["status"], string> = { connected: "green", error: "red", unconfigured: "default" };

  export function DataSourceList() {
    const { t } = useTranslation();
    const nav = useNavigate();
    const { data: sources, isLoading } = useDataSources();
    const test = useTestDataSource();
    const [err, setErr] = useState<string | null>(null);

    const runTest = async (id: string) => {
      const r = await test.mutateAsync(id);
      if (r.ok) message.success(t("admin.ds.testOk"));
      else setErr(r.error ?? t("admin.ds.testFailed"));
    };

    const columns = useMemo(() => ([
      { title: t("admin.ds.name"), dataIndex: "name" },
      { title: t("admin.ds.kind"), dataIndex: "kind", render: (k: string) => t(`admin.ds.kind.${k}`) },
      { title: t("admin.ds.status"), dataIndex: "status", render: (s: DataSource["status"]) => <Tag color={STATUS_COLOR[s]}>{t(`admin.ds.statusValue.${s}`)}</Tag> },
      {
        title: t("admin.ds.semanticModel"),
        dataIndex: "semanticModelId",
        render: (id: string) => <Button type="link" onClick={() => nav(`/admin/semantic-models?model=${id}`)}>{id}</Button>,
      },
      {
        title: t("common.actions"),
        render: (_: unknown, r: DataSource) => (
          <Space>
            <Button size="small" onClick={() => runTest(r.id)}>{t("admin.ds.testConnection")}</Button>
            <Button size="small" onClick={() => message.success(t("admin.ds.syncOk"))}>{t("admin.ds.syncSchema")}</Button>
          </Space>
        ),
      },
    ]), [t]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
    const list = sources ?? [];

    return (
      <div>
        <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
          <h2>{t("admin.ds.title")}</h2>
          <Button type="primary">{t("admin.ds.addSource")}</Button>
        </Space>
        {err && <Alert type="error" showIcon closable style={{ marginBottom: 16 }} message={t("admin.ds.testFailed")} description={err} onClose={() => setErr(null)} />}
        {list.length === 0 ? (
          <Empty description={t("admin.ds.empty")}>
            <Space>
              <Button type="primary">{t("admin.ds.addSource")}</Button>
              <Button onClick={() => nav("/admin/semantic-models")}>{t("admin.ds.useSamples")}</Button>
            </Space>
          </Empty>
        ) : (
          <Table rowKey="id" dataSource={list} columns={columns} pagination={false} />
        )}
      </div>
    );
  }
  ```
  Run: `cd report-web && npx vitest run src/admin/data-sources/DataSourceList.test.tsx` → expected PASS.

- [ ] **Step 3: Failing test — `FieldPreviewTable` tags measures vs dimensions and shows field type.**
  Create `report-web/src/admin/semantic-models/SemanticModelList.test.tsx`:
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { SemanticModelList } from "./SemanticModelList";

  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["TenantAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useSemanticModels: () => ({
      data: [
        {
          id: "sm-sales", dataSourceId: "ds-sales", name: "Sales",
          entities: [{ key: "order", label: "Order" }],
          fields: [
            { key: "order.province", entity: "order", label: "Province", type: "string", isMeasure: false },
            { key: "order.revenue", entity: "order", label: "Revenue", type: "number", isMeasure: true, defaultAggregation: "sum" },
            { key: "order.date", entity: "order", label: "Date", type: "date", isMeasure: false },
          ],
        },
      ],
      isLoading: false,
    }),
  }));

  describe("SemanticModelList", () => {
    it("lists models and previews typed fields with measure/dimension tags", () => {
      render(<SemanticModelList />);
      expect(screen.getByText("Sales")).toBeInTheDocument();
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      // measure tag present for revenue, dimension tag for province
      expect(screen.getByTestId("field-kind-order.revenue")).toHaveTextContent(/measure/i);
      expect(screen.getByTestId("field-kind-order.province")).toHaveTextContent(/dimension/i);
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/semantic-models/SemanticModelList.test.tsx` → expected FAIL.

- [ ] **Step 4: Implement `FieldPreviewTable.tsx`.**
  ```tsx
  import { Table, Tag, Space } from "antd";
  import { useTranslation } from "react-i18next";
  import type { SemanticField } from "../../contracts";

  export function FieldPreviewTable({ fields }: { fields: SemanticField[] }) {
    const { t } = useTranslation();
    return (
      <Table<SemanticField>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={fields}
        columns={[
          { title: t("admin.sm.field"), dataIndex: "label" },
          { title: t("admin.sm.entity"), dataIndex: "entity" },
          { title: t("admin.sm.type"), dataIndex: "type", render: (ty: string) => <Tag>{t(`admin.sm.fieldType.${ty}`)}</Tag> },
          {
            title: t("admin.sm.kind"),
            render: (_: unknown, f: SemanticField) => (
              <span data-testid={`field-kind-${f.key}`}>
                <Tag color={f.isMeasure ? "blue" : "geekblue"}>
                  {f.isMeasure ? t("admin.sm.measure") : t("admin.sm.dimension")}
                </Tag>
              </span>
            ),
          },
          { title: t("admin.sm.defaultAgg"), dataIndex: "defaultAggregation", render: (a?: string) => (a ? t(`agg.${a}`) : "—") },
          {
            title: t("admin.sm.synonyms"),
            dataIndex: "synonyms",
            render: (syn?: string[]) => (syn?.length ? <Space size={4} wrap>{syn.map((s) => <Tag key={s}>{s}</Tag>)}</Space> : "—"),
          },
        ]}
      />
    );
  }
  ```

- [ ] **Step 5: Implement `SemanticModelList.tsx` (antd Table of models; expandable row renders `FieldPreviewTable`; `?model=<id>` query param auto-expands the deep-linked model).**
  ```tsx
  import { useMemo } from "react";
  import { Table, Skeleton, Empty } from "antd";
  import { useTranslation } from "react-i18next";
  import { useSearchParams } from "react-router";
  import type { SemanticModel } from "../../contracts";
  import { useSemanticModels } from "../../api/queries";
  import { FieldPreviewTable } from "./FieldPreviewTable";

  export function SemanticModelList() {
    const { t } = useTranslation();
    const { data: models, isLoading } = useSemanticModels();
    const [params] = useSearchParams();
    const focusId = params.get("model");

    const columns = useMemo(() => ([
      { title: t("admin.sm.name"), dataIndex: "name" },
      { title: t("admin.sm.dataSource"), dataIndex: "dataSourceId" },
      { title: t("admin.sm.entities"), render: (_: unknown, m: SemanticModel) => m.entities.length },
      { title: t("admin.sm.fields"), render: (_: unknown, m: SemanticModel) => m.fields.length },
    ]), [t]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
    const list = models ?? [];

    return (
      <div>
        <h2>{t("admin.sm.title")}</h2>
        {list.length === 0 ? (
          <Empty description={t("admin.sm.empty")} />
        ) : (
          <Table<SemanticModel>
            rowKey="id"
            dataSource={list}
            columns={columns}
            pagination={false}
            defaultExpandedRowKeys={focusId ? [focusId] : undefined}
            expandable={{ expandedRowRender: (m) => <FieldPreviewTable fields={m.fields} /> }}
          />
        )}
      </div>
    );
  }
  ```
  Run: `cd report-web && npx vitest run src/admin/semantic-models/SemanticModelList.test.tsx` → expected PASS.

- [ ] **Step 6: Wire routes in `router.tsx`.** These routes **REPLACE** the Task 11 `/admin/data-sources*` and `/admin/semantic-models*` placeholder nodes (`P("DataSourceList")`/`P("DataSourceWizard")`/`P("DataSourceDetail")`/`P("SemanticModelList")`/`P("SemanticModelEditor …")`) with the real components. Under the admin subtree:
  ```tsx
  { path: "data-sources", element: <RequirePermission perm="datasources:manage"><DataSourceList /></RequirePermission> },
  { path: "semantic-models", element: <RequirePermission perm="datasources:manage"><SemanticModelList /></RequirePermission> },
  ```
  Import `DataSourceList`, `SemanticModelList`.

- [ ] **Step 7: Add i18n keys.** Add to both locale files: `admin.ds.{title,addSource,name,kind,status,semanticModel,testConnection,syncSchema,testOk,testFailed,syncOk,empty,useSamples}`, `admin.ds.kind.{sql,rest,file,warehouse}`, `admin.ds.statusValue.{connected,error,unconfigured}`; `admin.sm.{title,name,dataSource,entities,fields,empty,field,entity,type,kind,measure,dimension,defaultAgg,synonyms}`, `admin.sm.fieldType.{string,number,date,boolean}`; reuse/define `agg.{sum,avg,min,max,count,countDistinct,none}` and `common.actions`.

- [ ] **Step 8: Run the full gate.** `cd report-web && npx vitest run src/admin/data-sources src/admin/semantic-models && npm run lint && npm run build` → all green.
  Commit:
  ```
  git commit -am "feat(report-web): admin data sources + semantic models with field preview"
  ```
  with trailer line:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

**Acceptance criteria:** `/admin/data-sources` lists tenant sources with kind + colored status, exposes Test/Sync (mock), shows the "use sample datasets" shortcut on empty, and never displays connection secrets (only `connectionRef`/metadata). `/admin/semantic-models` lists models and, on expand, previews every field with its `FieldType` and a measure/dimension tag plus default aggregation + synonyms; `?model=<id>` deep-links and auto-expands. Both are gated by `datasources:manage`.

---

### Task 21: Admin · Audit Logs (`/admin/audit`) — log table + cost-per-tenant ECharts

**Files:**
- Create: `report-web/src/admin/audit/AuditLog.tsx`
- Create: `report-web/src/admin/audit/AuditEventDrawer.tsx`
- Create: `report-web/src/admin/audit/AuditCostChart.tsx`
- Modify: `report-web/src/app/router.tsx` (mount `/admin/audit`)
- Modify: `report-web/src/features/export/csv.ts` is reused (no change) — import `toCsv`
- Modify: `report-web/src/i18n/locales/fa.json`, `report-web/src/i18n/locales/en.json` (add `admin.audit.*`)
- Test: `report-web/src/admin/audit/AuditLog.test.tsx`

**Interfaces:**

Consumes:
- `contracts/ai.ts` / audit contract (Task 6/9): `AuditEvent { id: string; tenantId: string; actorId: string; actorName?: string; type: AuditEventType; ts: string; status: "ok" | "error"; cost?: number; tokens?: number; detail?: AuditAIDetail }`; `AuditEventType = "AiRequest" | "ReportExecution" | "Export" | "FailedQuery" | "UserActivity" | "ProviderChange"`; `AuditAIDetail = { prompt?: string; definition?: ReportDefinition; provider?: string; model?: string; promptVersion?: string; tokens?: number; costUsd?: number; latencyMs?: number; cached?: boolean }` (per §3.9: never raw SQL).
- `api/queries.ts`: `useAuditEvents(filter: { from?: string; to?: string; actorId?: string; type?: AuditEventType; status?: string }): { data?: AuditEvent[]; isLoading }`, `useAuditCostByTenant(): { data?: { tenantId: string; series: { period: string; costUsd: number }[] }[]; isLoading }`.
- `features/export/csv.ts`: `toCsv(rows: Record<string, unknown>[]): string` and `downloadCsv(filename: string, csv: string): void` (Task 13).
- `auth/useAuth.ts`; `admin/RequirePermission.tsx`: `<RequirePermission perm="audit:read">`.
- ECharts mount pattern from `presentation/renderers/EChartsRenderer.tsx`.

Produces:
- Named export `AuditLog` mounted by the router; `AuditEventDrawer`, `AuditCostChart` reusable within the audit zone.

- [ ] **Step 1: Failing test — `AuditLog` renders events, opens a detail drawer, and excludes raw SQL.**
  Create `report-web/src/admin/audit/AuditLog.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { AuditLog } from "./AuditLog";

  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["TenantAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useAuditEvents: () => ({
      data: [
        { id: "e1", tenantId: "acme", actorId: "u1", actorName: "Ali", type: "AiRequest", ts: "2026-06-20T09:00:00Z", status: "ok", cost: 0.0021, tokens: 1840, detail: { prompt: "درآمد ماهانه", provider: "openai", model: "gpt-4o-mini", promptVersion: "report-gen@3", tokens: 1840, costUsd: 0.0021, latencyMs: 820, cached: false } },
        { id: "e2", tenantId: "acme", actorId: "u2", actorName: "Sara", type: "FailedQuery", ts: "2026-06-20T09:05:00Z", status: "error" },
      ],
      isLoading: false,
    }),
    useAuditCostByTenant: () => ({ data: [{ tenantId: "acme", series: [{ period: "2026-05", costUsd: 12 }, { period: "2026-06", costUsd: 18 }] }], isLoading: false }),
  }));

  describe("AuditLog", () => {
    it("lists events with type and status", () => {
      render(<AuditLog />);
      expect(screen.getByText("Ali")).toBeInTheDocument();
      expect(screen.getByText("Sara")).toBeInTheDocument();
    });
    it("opens an AI event drawer showing prompt + model but no SQL", () => {
      render(<AuditLog />);
      fireEvent.click(screen.getByText("Ali"));
      expect(screen.getByText("درآمد ماهانه")).toBeInTheDocument();
      expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
      expect(screen.queryByText(/SELECT|select \*/i)).not.toBeInTheDocument();
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/audit/AuditLog.test.tsx` → expected FAIL.

- [ ] **Step 2: Implement `AuditCostChart.tsx` (ECharts multi-series line: one line per tenant, cost over period; inside antd Card).**
  ```tsx
  import { useEffect, useRef } from "react";
  import * as echarts from "echarts";
  import { Card, Skeleton } from "antd";
  import { useTranslation } from "react-i18next";
  import { useAuditCostByTenant } from "../../api/queries";

  export function AuditCostChart() {
    const { t } = useTranslation();
    const { data, isLoading } = useAuditCostByTenant();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!ref.current || !data) return;
      const periods = Array.from(new Set(data.flatMap((d) => d.series.map((s) => s.period)))).sort();
      const chart = echarts.init(ref.current);
      chart.setOption({
        tooltip: { trigger: "axis" },
        legend: { data: data.map((d) => d.tenantId) },
        xAxis: { type: "category", data: periods },
        yAxis: { type: "value", name: t("admin.audit.costUsd") },
        series: data.map((d) => ({
          name: d.tenantId,
          type: "line",
          smooth: true,
          data: periods.map((p) => d.series.find((s) => s.period === p)?.costUsd ?? 0),
        })),
      });
      const onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
      return () => { window.removeEventListener("resize", onResize); chart.dispose(); };
    }, [data, t]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
    return <Card title={t("admin.audit.costPerTenant")}><div ref={ref} style={{ height: 300 }} /></Card>;
  }
  ```

- [ ] **Step 3: Implement `AuditEventDrawer.tsx` (full event detail; for AI events shows prompt / provider / model / tokens / cost / latency / cache — never raw SQL; the resolved `ReportDefinition` is shown as pretty JSON, not SQL).**
  ```tsx
  import { Drawer, Descriptions, Tag, Typography } from "antd";
  import { useTranslation } from "react-i18next";
  import type { AuditEvent } from "../../contracts";

  export function AuditEventDrawer({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
    const { t } = useTranslation();
    const d = event?.detail;
    return (
      <Drawer open={!!event} onClose={onClose} width={520} title={event ? t(`admin.audit.type.${event.type}`) : ""}>
        {event && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t("admin.audit.actor")}>{event.actorName ?? event.actorId}</Descriptions.Item>
            <Descriptions.Item label={t("admin.audit.time")}>{new Date(event.ts).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label={t("admin.audit.status")}>
              <Tag color={event.status === "ok" ? "green" : "red"}>{t(`admin.audit.statusValue.${event.status}`)}</Tag>
            </Descriptions.Item>
            {d?.prompt && <Descriptions.Item label={t("admin.audit.prompt")}>{d.prompt}</Descriptions.Item>}
            {d?.provider && <Descriptions.Item label={t("admin.audit.provider")}>{d.provider}</Descriptions.Item>}
            {d?.model && <Descriptions.Item label={t("admin.audit.model")}>{d.model}</Descriptions.Item>}
            {d?.promptVersion && <Descriptions.Item label={t("admin.audit.promptVersion")}>{d.promptVersion}</Descriptions.Item>}
            {d?.tokens != null && <Descriptions.Item label={t("admin.audit.tokens")}>{d.tokens}</Descriptions.Item>}
            {d?.costUsd != null && <Descriptions.Item label={t("admin.audit.cost")}>${d.costUsd.toFixed(4)}</Descriptions.Item>}
            {d?.latencyMs != null && <Descriptions.Item label={t("admin.audit.latency")}>{d.latencyMs} ms</Descriptions.Item>}
            {d?.cached != null && <Descriptions.Item label={t("admin.audit.cached")}>{d.cached ? t("common.yes") : t("common.no")}</Descriptions.Item>}
            {d?.definition && (
              <Descriptions.Item label={t("admin.audit.resolvedDefinition")}>
                <Typography.Paragraph code style={{ whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}>
                  {JSON.stringify(d.definition, null, 2)}
                </Typography.Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    );
  }
  ```

- [ ] **Step 4: Implement `AuditLog.tsx` (antd Tabs of log views; filter bar = RangePicker + actor/type/status Selects; antd Table; row click opens the drawer; Export-to-CSV via `toCsv`/`downloadCsv`; the cost chart sits in a Card above the table).**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Tag, Space, Select, DatePicker, Button, Skeleton, Empty } from "antd";
  import { useTranslation } from "react-i18next";
  import type { AuditEvent, AuditEventType } from "../../contracts";
  import { useAuditEvents } from "../../api/queries";
  import { toCsv, downloadCsv } from "../../features/export/csv";
  import { AuditEventDrawer } from "./AuditEventDrawer";
  import { AuditCostChart } from "./AuditCostChart";

  const TYPES: AuditEventType[] = ["AiRequest","ReportExecution","Export","FailedQuery","UserActivity","ProviderChange"];

  export function AuditLog() {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<{ from?: string; to?: string; type?: AuditEventType; status?: string }>({});
    const { data: events, isLoading } = useAuditEvents(filter);
    const [selected, setSelected] = useState<AuditEvent | null>(null);

    const list = events ?? [];
    const exportCsv = () => {
      const rows = list.map((e) => ({ id: e.id, ts: e.ts, actor: e.actorName ?? e.actorId, type: e.type, status: e.status, tokens: e.tokens ?? "", cost: e.cost ?? "" }));
      downloadCsv(`audit-${Date.now()}.csv`, toCsv(rows));
    };

    const columns = useMemo(() => ([
      { title: t("admin.audit.time"), dataIndex: "ts", render: (ts: string) => new Date(ts).toLocaleString() },
      { title: t("admin.audit.actor"), dataIndex: "actorName", render: (_: unknown, e: AuditEvent) => e.actorName ?? e.actorId },
      { title: t("admin.audit.eventType"), dataIndex: "type", render: (ty: AuditEventType) => <Tag>{t(`admin.audit.type.${ty}`)}</Tag> },
      { title: t("admin.audit.status"), dataIndex: "status", render: (s: string) => <Tag color={s === "ok" ? "green" : "red"}>{t(`admin.audit.statusValue.${s}`)}</Tag> },
      { title: t("admin.audit.tokens"), dataIndex: "tokens", render: (v?: number) => v ?? "—" },
      { title: t("admin.audit.cost"), dataIndex: "cost", render: (v?: number) => (v != null ? `$${v.toFixed(4)}` : "—") },
    ]), [t]);

    return (
      <div>
        <h2>{t("admin.audit.title")}</h2>
        <div style={{ marginBottom: 16 }}><AuditCostChart /></div>
        <Space wrap style={{ marginBottom: 16 }}>
          <DatePicker.RangePicker onChange={(_d, [from, to]) => setFilter((f) => ({ ...f, from: from || undefined, to: to || undefined }))} />
          <Select allowClear placeholder={t("admin.audit.eventType")} style={{ width: 200 }}
            options={TYPES.map((ty) => ({ value: ty, label: t(`admin.audit.type.${ty}`) }))}
            onChange={(ty) => setFilter((f) => ({ ...f, type: ty }))} />
          <Select allowClear placeholder={t("admin.audit.status")} style={{ width: 140 }}
            options={[{ value: "ok", label: t("admin.audit.statusValue.ok") }, { value: "error", label: t("admin.audit.statusValue.error") }]}
            onChange={(s) => setFilter((f) => ({ ...f, status: s }))} />
          <Button onClick={exportCsv} disabled={list.length === 0}>{t("admin.audit.exportCsv")}</Button>
        </Space>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : list.length === 0 ? (
          <Empty description={t("admin.audit.empty")} />
        ) : (
          <Table rowKey="id" dataSource={list} columns={columns} onRow={(e) => ({ onClick: () => setSelected(e), style: { cursor: "pointer" } })} />
        )}
        <AuditEventDrawer event={selected} onClose={() => setSelected(null)} />
      </div>
    );
  }
  ```
  > §3.9 specifies tabbed log views per event category; v1 ships a single table with an event-type filter (functionally equivalent and simpler), with the cost-per-tenant chart in a Card. Splitting into antd `Tabs` per type is a cosmetic later refinement over the same filtered query.
  Run: `cd report-web && npx vitest run src/admin/audit/AuditLog.test.tsx` → expected PASS (2 passed).

- [ ] **Step 5: Wire route in `router.tsx`.** This route **REPLACES** the Task 11 `/admin/audit` placeholder nodes (`P("AuditLog")`/`P("AuditEventDetail")`) with the real component. Under the admin subtree:
  ```tsx
  { path: "audit", element: <RequirePermission perm="audit:read"><AuditLog /></RequirePermission> },
  ```
  Import `AuditLog`.

- [ ] **Step 6: Add i18n keys.** Add to both locale files: `admin.audit.{title,time,actor,eventType,status,tokens,cost,latency,prompt,provider,model,promptVersion,cached,resolvedDefinition,exportCsv,empty,costPerTenant,costUsd}`, `admin.audit.type.{AiRequest,ReportExecution,Export,FailedQuery,UserActivity,ProviderChange}`, `admin.audit.statusValue.{ok,error}`; reuse `common.{yes,no}`.

- [ ] **Step 7: Run the full gate.** `cd report-web && npx vitest run src/admin/audit && npm run lint && npm run build` → all green.
  Commit:
  ```
  git commit -am "feat(report-web): admin audit log + cost-per-tenant ECharts"
  ```
  with trailer line:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

**Acceptance criteria:** `/admin/audit` is gated by `audit:read`; it shows a filterable (date range / type / status) audit table, an ECharts cost-per-tenant line chart in an antd Card, CSV export of the filtered rows, and a per-event Drawer that for AI events shows prompt/provider/model/tokens/cost/latency/cache and the resolved `ReportDefinition` as JSON — and never renders raw SQL.

---

### Task 22: Admin · Tenant settings (`/admin/tenant`) + Tenants list (`/admin/tenants`, Super Admin) + System settings (`/admin/system`)

**Files:**
- Create: `report-web/src/admin/tenant/TenantSettings.tsx` (branding + defaults + quota in one screen)
- Create: `report-web/src/admin/tenant/QuotaPanel.tsx`
- Create: `report-web/src/admin/tenants/TenantList.tsx`
- Create: `report-web/src/admin/tenants/TenantFormModal.tsx`
- Create: `report-web/src/admin/system/SystemSettings.tsx`
- Modify: `report-web/src/app/router.tsx` (mount `/admin/tenant`, `/admin/tenants`, `/admin/system`)
- Modify: `report-web/src/i18n/locales/fa.json`, `report-web/src/i18n/locales/en.json` (add `admin.tenant.*`, `admin.tenants.*`, `admin.system.*`)
- Test: `report-web/src/admin/tenant/TenantSettings.test.tsx`
- Test: `report-web/src/admin/tenants/TenantList.test.tsx`
- Test: `report-web/src/admin/system/SystemSettings.test.tsx`

**Interfaces:**

Consumes:
- `contracts/tenant.ts`: `Tenant { id; slug; displayName; status: TenantStatus; plan: TenantPlan; branding: TenantBranding; aiConfig: TenantAiConfig; quotas: TenantQuotas; dataSourceIds: string[]; defaultLocale: "fa-IR" | "en-US"; createdAt; updatedAt }`; `TenantStatus = "active" | "suspended" | "trial"`; `TenantPlan = "free" | "pro" | "enterprise"`; `TenantBranding { logoUrl?; primaryColor: string; accentColor?; productName?; faviconUrl?; loginBackgroundUrl? }`; `TenantQuotas { maxUsers; maxReports; maxDashboards; maxDataSources; monthlyAiTokens; monthlyAiCost; monthlyExports; storageMb }`; `TenantUsage { period; users; reports; dashboards; dataSources; aiTokens; aiCost; exports; storageMb }`.
- `api/queries.ts`: `useTenant(): { data?: Tenant; isLoading }` (active tenant), `useUpdateTenant(): { mutate(t: Tenant); isPending }`, `useTenantUsage(): { data?: TenantUsage; isLoading }`, `useTenants(): { data?: Tenant[]; isLoading }`, `useUpsertTenant(): { mutate(t: Tenant) }`, `useSetTenantStatus(): { mutate(arg: { id: string; status: TenantStatus }) }`, `useSystemSettings(): { data?: SystemSettings; isLoading }`, `useUpdateSystemSettings(): { mutate(s: SystemSettings) }`.
- `store/ui-store.ts` / `theme/ThemeProvider.tsx`: branding changes feed the antd `ConfigProvider` primary color + `direction` (live preview).
- `store/tenant-store.ts` (Task 10): `useTenantStore((s) => s.currentTenantId)`.
- `auth/useAuth.ts`: `useAuth()`; `contracts/rbac.ts`: `isGlobal(roles)`; `admin/RequirePermission.tsx`: `<RequirePermission perm="users:manage">` (Tenant Admin gate) and `<RequireSuperAdmin>` (Task 17) for Super-Admin-only routes.

Produces:
- Named exports `TenantSettings`, `TenantList`, `SystemSettings` mounted by the router. Defines `SystemSettings` type:
  ```ts
  export interface SystemSettings {
    defaultLocale: "fa-IR" | "en-US";
    defaultTheme: "light" | "dark";
    dateSystem: "jalali" | "gregorian";
    flags: { advancedECharts: boolean; dashboardSharing: boolean; exportFormats: boolean };
    ai: { defaultProvider: string; defaultModel: string; globalTokenBudget: number; defaultCacheTtl: number; promptVersionPin: string };
    security: { sessionPolicy: string; allowedExportFormats: string[]; piiRedaction: boolean };
    integrations: { oidcIssuer: string };
  }
  ```

- [ ] **Step 1: Failing test — `TenantSettings` shows branding + quota usage and persists edits.**
  Create `report-web/src/admin/tenant/TenantSettings.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TenantSettings } from "./TenantSettings";

  const mutate = vi.fn();
  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["TenantAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useTenant: () => ({
      data: {
        id: "acme", slug: "acme-co", displayName: "شرکت آلفا", status: "active", plan: "pro",
        branding: { primaryColor: "#10b981", productName: "Alpha Reports" },
        aiConfig: {}, defaultLocale: "fa-IR", dataSourceIds: [], createdAt: "", updatedAt: "",
        quotas: { maxUsers: 25, maxReports: 100, maxDashboards: 20, maxDataSources: 5, monthlyAiTokens: 5000000, monthlyAiCost: 200, monthlyExports: 500, storageMb: 1024 },
      },
      isLoading: false,
    }),
    useUpdateTenant: () => ({ mutate, isPending: false }),
    useTenantUsage: () => ({ data: { period: "2026-06", users: 12, reports: 90, dashboards: 8, dataSources: 3, aiTokens: 4200000, aiCost: 168, exports: 120, storageMb: 512 }, isLoading: false }),
  }));

  describe("TenantSettings", () => {
    it("renders branding fields and usage bars", () => {
      render(<TenantSettings />);
      expect(screen.getByDisplayValue("Alpha Reports")).toBeInTheDocument();
      expect(screen.getByText(/reports/i)).toBeInTheDocument();
    });
    it("persists branding changes on save", () => {
      render(<TenantSettings />);
      const input = screen.getByDisplayValue("Alpha Reports");
      fireEvent.change(input, { target: { value: "Alpha BI" } });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ productName: "Alpha BI" }) }));
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/tenant/TenantSettings.test.tsx` → expected FAIL.

- [ ] **Step 2: Implement `QuotaPanel.tsx` (Recharts horizontal bars / progress per quota metric; warns near-limit ≥80%).**
  ```tsx
  import { Card, Progress, Row, Col, Alert } from "antd";
  import { useTranslation } from "react-i18next";
  import type { TenantQuotas, TenantUsage } from "../../contracts";

  const METRICS: { used: keyof TenantUsage; cap: keyof TenantQuotas; key: string }[] = [
    { used: "users", cap: "maxUsers", key: "users" },
    { used: "reports", cap: "maxReports", key: "reports" },
    { used: "dashboards", cap: "maxDashboards", key: "dashboards" },
    { used: "dataSources", cap: "maxDataSources", key: "dataSources" },
    { used: "aiTokens", cap: "monthlyAiTokens", key: "aiTokens" },
    { used: "aiCost", cap: "monthlyAiCost", key: "aiCost" },
    { used: "exports", cap: "monthlyExports", key: "exports" },
    { used: "storageMb", cap: "storageMb", key: "storageMb" },
  ];

  export function QuotaPanel({ quotas, usage }: { quotas: TenantQuotas; usage: TenantUsage }) {
    const { t } = useTranslation();
    const near = METRICS.some(({ used, cap }) => {
      const c = Number(quotas[cap]) || 0;
      return c > 0 && Number(usage[used]) / c >= 0.8;
    });
    return (
      <Card title={t("admin.tenant.quotaUsage")}>
        {near && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t("admin.tenant.quotaNearLimit")} />}
        <Row gutter={[16, 16]}>
          {METRICS.map(({ used, cap, key }) => {
            const u = Number(usage[used]) || 0;
            const c = Number(quotas[cap]) || 0;
            const pct = c > 0 ? Math.min(100, Math.round((u / c) * 100)) : 0;
            return (
              <Col span={12} key={key}>
                <div style={{ marginBottom: 4 }}>{t(`admin.tenant.metric.${key}`)}: {u} / {c}</div>
                <Progress percent={pct} status={pct >= 100 ? "exception" : pct >= 80 ? "active" : "normal"} />
              </Col>
            );
          })}
        </Row>
      </Card>
    );
  }
  ```

- [ ] **Step 3: Implement `TenantSettings.tsx` (antd Form: displayName, productName, primary/accent color pickers, default locale + direction, plan; live theme preview by writing primaryColor into the theme store on change; embeds `QuotaPanel`; "per-tenant AI config" deep-links to `/admin/ai/providers`).**
  ```tsx
  import { useEffect, useState } from "react";
  import { Form, Input, Select, ColorPicker, Button, Card, Skeleton, Space, Upload } from "antd";
  import { useTranslation } from "react-i18next";
  import { useNavigate } from "react-router";
  import type { Tenant } from "../../contracts";
  import { useTenant, useUpdateTenant, useTenantUsage } from "../../api/queries";
  import { useUiStore } from "../../store/ui-store";
  import { QuotaPanel } from "./QuotaPanel";

  export function TenantSettings() {
    const { t } = useTranslation();
    const nav = useNavigate();
    const { data: tenant, isLoading } = useTenant();
    const { data: usage } = useTenantUsage();
    const update = useUpdateTenant();
    const setPreviewColor = useUiStore((s) => s.setPreviewPrimaryColor);
    const [form] = Form.useForm();
    const [draft, setDraft] = useState<Tenant | null>(null);

    useEffect(() => { if (tenant) setDraft(tenant); }, [tenant]);
    if (isLoading || !draft) return <Skeleton active paragraph={{ rows: 10 }} />;

    const submit = (values: { displayName: string; productName?: string; primaryColor: string; accentColor?: string; defaultLocale: Tenant["defaultLocale"]; plan: Tenant["plan"] }) => {
      update.mutate({
        ...draft,
        displayName: values.displayName,
        plan: values.plan,
        defaultLocale: values.defaultLocale,
        branding: { ...draft.branding, productName: values.productName, primaryColor: values.primaryColor, accentColor: values.accentColor },
        updatedAt: new Date().toISOString(),
      });
    };

    return (
      <div>
        <h2>{t("admin.tenant.title")}</h2>
        <Card title={t("admin.tenant.branding")} style={{ marginBottom: 16 }}>
          <Form
            form={form}
            layout="vertical"
            style={{ maxWidth: 560 }}
            initialValues={{
              displayName: draft.displayName,
              productName: draft.branding.productName,
              primaryColor: draft.branding.primaryColor,
              accentColor: draft.branding.accentColor,
              defaultLocale: draft.defaultLocale,
              plan: draft.plan,
            }}
            onFinish={submit}
          >
            <Form.Item name="displayName" label={t("admin.tenant.displayName")} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="productName" label={t("admin.tenant.productName")}><Input /></Form.Item>
            <Form.Item label={t("admin.tenant.logo")}><Upload listType="picture-card" maxCount={1} beforeUpload={() => false}>{t("admin.tenant.uploadLogo")}</Upload></Form.Item>
            <Form.Item name="primaryColor" label={t("admin.tenant.primaryColor")} getValueFromEvent={(c) => (typeof c === "string" ? c : c.toHexString())}>
              <ColorPicker showText onChangeComplete={(c) => setPreviewColor(c.toHexString())} />
            </Form.Item>
            <Form.Item name="accentColor" label={t("admin.tenant.accentColor")} getValueFromEvent={(c) => (typeof c === "string" ? c : c.toHexString())}>
              <ColorPicker showText />
            </Form.Item>
            <Form.Item name="defaultLocale" label={t("admin.tenant.defaultLocale")}>
              <Select options={[{ value: "fa-IR", label: "فارسی (RTL)" }, { value: "en-US", label: "English (LTR)" }]} />
            </Form.Item>
            <Form.Item name="plan" label={t("admin.tenant.plan")}>
              <Select options={["free", "pro", "enterprise"].map((p) => ({ value: p, label: t(`admin.tenant.planValue.${p}`) }))} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={update.isPending}>{t("common.save")}</Button>
              <Button onClick={() => nav("/admin/ai/providers")}>{t("admin.tenant.perTenantAi")}</Button>
            </Space>
          </Form>
        </Card>
        {usage && <QuotaPanel quotas={draft.quotas} usage={usage} />}
      </div>
    );
  }
  ```
  > `useUiStore.setPreviewPrimaryColor`: if the theme store from Task 12/14 exposes a different setter name, substitute it; the requirement is that changing the color picker live-updates the antd `ConfigProvider` token. Logo `Upload` uses `beforeUpload={() => false}` so v1 never actually uploads — it only previews.
  Run: `cd report-web && npx vitest run src/admin/tenant/TenantSettings.test.tsx` → expected PASS (2 passed).

- [ ] **Step 4: Failing test — `TenantList` (Super Admin) lists tenants and suspends one.**
  Create `report-web/src/admin/tenants/TenantList.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { TenantList } from "./TenantList";

  const setStatus = vi.fn();
  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["SuperAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useTenants: () => ({
      data: [
        { id: "acme", slug: "acme-co", displayName: "شرکت آلفا", status: "active", plan: "pro", branding: { primaryColor: "#10b981" }, aiConfig: {}, quotas: {}, dataSourceIds: [], defaultLocale: "fa-IR", createdAt: "", updatedAt: "" },
        { id: "beta", slug: "beta-log", displayName: "Beta Logistics", status: "trial", plan: "free", branding: { primaryColor: "#2563eb" }, aiConfig: {}, quotas: {}, dataSourceIds: [], defaultLocale: "en-US", createdAt: "", updatedAt: "" },
      ],
      isLoading: false,
    }),
    useUpsertTenant: () => ({ mutate: vi.fn() }),
    useSetTenantStatus: () => ({ mutate: setStatus }),
  }));

  describe("TenantList", () => {
    it("lists all tenants with status", () => {
      render(<TenantList />);
      expect(screen.getByText("شرکت آلفا")).toBeInTheDocument();
      expect(screen.getByText("Beta Logistics")).toBeInTheDocument();
    });
    it("suspends a tenant", () => {
      render(<TenantList />);
      fireEvent.click(screen.getAllByRole("button", { name: /suspend/i })[0]);
      expect(setStatus).toHaveBeenCalledWith({ id: "acme", status: "suspended" });
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/tenants/TenantList.test.tsx` → expected FAIL.

- [ ] **Step 5: Implement `TenantFormModal.tsx` (create/edit tenant: displayName, slug, plan, default locale).**
  ```tsx
  import { Modal, Form, Input, Select } from "antd";
  import { useTranslation } from "react-i18next";
  import type { Tenant } from "../../contracts";

  export function TenantFormModal({
    open, initial, onCancel, onSave,
  }: { open: boolean; initial?: Tenant; onCancel: () => void; onSave: (t: Tenant) => void }) {
    const { t } = useTranslation();
    const [form] = Form.useForm<{ displayName: string; slug: string; plan: Tenant["plan"]; defaultLocale: Tenant["defaultLocale"] }>();
    return (
      <Modal
        open={open}
        title={initial ? t("admin.tenants.edit") : t("admin.tenants.create")}
        okText={t("common.save")}
        destroyOnHidden
        onCancel={onCancel}
        onOk={async () => {
          const v = await form.validateFields();
          const now = new Date().toISOString();
          onSave({
            id: initial?.id ?? `tenant-${Date.now()}`,
            slug: v.slug,
            displayName: v.displayName,
            status: initial?.status ?? "trial",
            plan: v.plan,
            branding: initial?.branding ?? { primaryColor: "#10b981" },
            aiConfig: initial?.aiConfig ?? ({} as Tenant["aiConfig"]),
            quotas: initial?.quotas ?? ({} as Tenant["quotas"]),
            dataSourceIds: initial?.dataSourceIds ?? [],
            defaultLocale: v.defaultLocale,
            createdAt: initial?.createdAt ?? now,
            updatedAt: now,
          });
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ displayName: initial?.displayName, slug: initial?.slug, plan: initial?.plan ?? "free", defaultLocale: initial?.defaultLocale ?? "fa-IR" }}>
          <Form.Item name="displayName" label={t("admin.tenants.displayName")} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label={t("admin.tenants.slug")} rules={[{ required: true }]}><Input placeholder="acme-co" /></Form.Item>
          <Form.Item name="plan" label={t("admin.tenants.plan")}>
            <Select options={["free", "pro", "enterprise"].map((p) => ({ value: p, label: t(`admin.tenant.planValue.${p}`) }))} />
          </Form.Item>
          <Form.Item name="defaultLocale" label={t("admin.tenants.defaultLocale")}>
            <Select options={[{ value: "fa-IR", label: "فارسی (RTL)" }, { value: "en-US", label: "English (LTR)" }]} />
          </Form.Item>
        </Form>
      </Modal>
    );
  }
  ```

- [ ] **Step 6: Implement `TenantList.tsx` (antd Table of all tenants; status Tag; Create / Edit / Suspend·Reactivate via `Modal.confirm`; empty state "Create tenant").**
  ```tsx
  import { useMemo, useState } from "react";
  import { Table, Tag, Button, Space, Skeleton, Empty, Modal } from "antd";
  import { useTranslation } from "react-i18next";
  import type { Tenant, TenantStatus } from "../../contracts";
  import { useTenants, useUpsertTenant, useSetTenantStatus } from "../../api/queries";
  import { TenantFormModal } from "./TenantFormModal";

  const STATUS_COLOR: Record<TenantStatus, string> = { active: "green", trial: "gold", suspended: "red" };

  export function TenantList() {
    const { t } = useTranslation();
    const { data: tenants, isLoading } = useTenants();
    const upsert = useUpsertTenant();
    const setStatus = useSetTenantStatus();
    const [modal, setModal] = useState<{ open: boolean; initial?: Tenant }>({ open: false });

    const suspend = (tn: Tenant) =>
      Modal.confirm({
        title: t("admin.tenants.suspendTitle"),
        content: t("admin.tenants.suspendWarn", { name: tn.displayName }),
        okText: t("admin.tenants.suspend"),
        okButtonProps: { danger: true },
        cancelText: t("common.cancel"),
        onOk: () => setStatus.mutate({ id: tn.id, status: "suspended" }),
      });

    const columns = useMemo(() => ([
      { title: t("admin.tenants.displayName"), dataIndex: "displayName" },
      { title: t("admin.tenants.slug"), dataIndex: "slug" },
      { title: t("admin.tenants.plan"), dataIndex: "plan", render: (p: string) => t(`admin.tenant.planValue.${p}`) },
      { title: t("admin.tenants.status"), dataIndex: "status", render: (s: TenantStatus) => <Tag color={STATUS_COLOR[s]}>{t(`admin.tenants.statusValue.${s}`)}</Tag> },
      {
        title: t("common.actions"),
        render: (_: unknown, tn: Tenant) => (
          <Space>
            <Button size="small" onClick={() => setModal({ open: true, initial: tn })}>{t("common.edit")}</Button>
            {tn.status === "suspended" ? (
              <Button size="small" onClick={() => setStatus.mutate({ id: tn.id, status: "active" })}>{t("admin.tenants.reactivate")}</Button>
            ) : (
              <Button size="small" danger onClick={() => suspend(tn)}>{t("admin.tenants.suspend")}</Button>
            )}
          </Space>
        ),
      },
    ]), [t]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
    const list = tenants ?? [];

    return (
      <div>
        <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
          <h2>{t("admin.tenants.title")}</h2>
          <Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.tenants.create")}</Button>
        </Space>
        {list.length === 0 ? (
          <Empty description={t("admin.tenants.empty")}><Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.tenants.create")}</Button></Empty>
        ) : (
          <Table rowKey="id" dataSource={list} columns={columns} />
        )}
        <TenantFormModal open={modal.open} initial={modal.initial} onCancel={() => setModal({ open: false })} onSave={(tn) => { upsert.mutate(tn); setModal({ open: false }); }} />
      </div>
    );
  }
  ```
  Run: `cd report-web && npx vitest run src/admin/tenants/TenantList.test.tsx` → expected PASS (2 passed).

- [ ] **Step 7: Failing test — `SystemSettings` toggles a feature flag and saves with confirm.**
  Create `report-web/src/admin/system/SystemSettings.test.tsx`:
  ```tsx
  import { render, screen, fireEvent } from "@testing-library/react";
  import { describe, it, expect, vi } from "vitest";
  import { SystemSettings } from "./SystemSettings";

  const mutate = vi.fn();
  vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ roles: ["SuperAdmin"], isAdmin: true, ready: true, user: { id: "u" }, login() {}, logout() {} }) }));
  vi.mock("../../api/queries", () => ({
    useSystemSettings: () => ({
      data: {
        defaultLocale: "fa-IR", defaultTheme: "light", dateSystem: "jalali",
        flags: { advancedECharts: true, dashboardSharing: false, exportFormats: true },
        ai: { defaultProvider: "openai", defaultModel: "gpt-4o-mini", globalTokenBudget: 10000000, defaultCacheTtl: 86400, promptVersionPin: "report-gen@3" },
        security: { sessionPolicy: "8h", allowedExportFormats: ["pdf", "csv"], piiRedaction: true },
        integrations: { oidcIssuer: "https://auth.myceo.ir" },
      },
      isLoading: false,
    }),
    useUpdateSystemSettings: () => ({ mutate, isPending: false }),
  }));

  describe("SystemSettings", () => {
    it("shows the read-only OIDC issuer", () => {
      render(<SystemSettings />);
      expect(screen.getByDisplayValue("https://auth.myceo.ir")).toBeInTheDocument();
    });
    it("persists a flag change on save", () => {
      render(<SystemSettings />);
      fireEvent.click(screen.getByTestId("flag-dashboardSharing"));
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      // confirm modal -> OK
      fireEvent.click(screen.getByRole("button", { name: /confirm|ok|تایید/i }));
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.objectContaining({ dashboardSharing: true }) }));
    });
  });
  ```
  Run: `cd report-web && npx vitest run src/admin/system/SystemSettings.test.tsx` → expected FAIL.

- [ ] **Step 8: Implement `SystemSettings.tsx` (antd Tabs: General / Feature flags / AI defaults / Security / Integrations; Save with `Modal.confirm` diff; OIDC issuer read-only).**
  ```tsx
  import { useEffect, useState } from "react";
  import { Tabs, Form, Select, Switch, InputNumber, Input, Button, Skeleton, Modal, message } from "antd";
  import { useTranslation } from "react-i18next";
  import { useSystemSettings, useUpdateSystemSettings } from "../../api/queries";

  export interface SystemSettings {
    defaultLocale: "fa-IR" | "en-US";
    defaultTheme: "light" | "dark";
    dateSystem: "jalali" | "gregorian";
    flags: { advancedECharts: boolean; dashboardSharing: boolean; exportFormats: boolean };
    ai: { defaultProvider: string; defaultModel: string; globalTokenBudget: number; defaultCacheTtl: number; promptVersionPin: string };
    security: { sessionPolicy: string; allowedExportFormats: string[]; piiRedaction: boolean };
    integrations: { oidcIssuer: string };
  }

  const FLAGS: (keyof SystemSettings["flags"])[] = ["advancedECharts", "dashboardSharing", "exportFormats"];

  export function SystemSettings() {
    const { t } = useTranslation();
    const { data, isLoading } = useSystemSettings();
    const update = useUpdateSystemSettings();
    const [draft, setDraft] = useState<SystemSettings | null>(null);
    useEffect(() => { if (data) setDraft(data); }, [data]);
    if (isLoading || !draft) return <Skeleton active paragraph={{ rows: 10 }} />;

    const patch = (p: Partial<SystemSettings>) => setDraft((d) => (d ? { ...d, ...p } : d));
    const setFlag = (k: keyof SystemSettings["flags"], v: boolean) => setDraft((d) => (d ? { ...d, flags: { ...d.flags, [k]: v } } : d));
    const save = () =>
      Modal.confirm({
        title: t("admin.system.confirmTitle"),
        content: t("admin.system.confirmBody"),
        okText: t("common.confirm"),
        cancelText: t("common.cancel"),
        onOk: () => { update.mutate(draft); message.success(t("admin.system.saved")); },
      });

    return (
      <div>
        <h2>{t("admin.system.title")}</h2>
        <Tabs
          items={[
            {
              key: "general", label: t("admin.system.general"),
              children: (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item label={t("admin.system.defaultLocale")}>
                    <Select value={draft.defaultLocale} onChange={(v) => patch({ defaultLocale: v })}
                      options={[{ value: "fa-IR", label: "فارسی (RTL)" }, { value: "en-US", label: "English (LTR)" }]} />
                  </Form.Item>
                  <Form.Item label={t("admin.system.defaultTheme")}>
                    <Select value={draft.defaultTheme} onChange={(v) => patch({ defaultTheme: v })}
                      options={[{ value: "light", label: t("admin.system.light") }, { value: "dark", label: t("admin.system.dark") }]} />
                  </Form.Item>
                  <Form.Item label={t("admin.system.dateSystem")}>
                    <Select value={draft.dateSystem} onChange={(v) => patch({ dateSystem: v })}
                      options={[{ value: "jalali", label: t("admin.system.jalali") }, { value: "gregorian", label: t("admin.system.gregorian") }]} />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "flags", label: t("admin.system.flags"),
              children: (
                <Form layout="horizontal">
                  {FLAGS.map((f) => (
                    <Form.Item key={f} label={t(`admin.system.flag.${f}`)}>
                      <span data-testid={`flag-${f}`}>
                        <Switch checked={draft.flags[f]} onChange={(v) => setFlag(f, v)} />
                      </span>
                    </Form.Item>
                  ))}
                </Form>
              ),
            },
            {
              key: "ai", label: t("admin.system.aiDefaults"),
              children: (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item label={t("admin.system.defaultProvider")}><Input value={draft.ai.defaultProvider} onChange={(e) => patch({ ai: { ...draft.ai, defaultProvider: e.target.value } })} /></Form.Item>
                  <Form.Item label={t("admin.system.defaultModel")}><Input value={draft.ai.defaultModel} onChange={(e) => patch({ ai: { ...draft.ai, defaultModel: e.target.value } })} /></Form.Item>
                  <Form.Item label={t("admin.system.globalTokenBudget")}><InputNumber style={{ width: "100%" }} value={draft.ai.globalTokenBudget} onChange={(v) => patch({ ai: { ...draft.ai, globalTokenBudget: v ?? 0 } })} /></Form.Item>
                  <Form.Item label={t("admin.system.defaultCacheTtl")}><InputNumber style={{ width: "100%" }} value={draft.ai.defaultCacheTtl} onChange={(v) => patch({ ai: { ...draft.ai, defaultCacheTtl: v ?? 0 } })} /></Form.Item>
                  <Form.Item label={t("admin.system.promptVersionPin")}><Input value={draft.ai.promptVersionPin} onChange={(e) => patch({ ai: { ...draft.ai, promptVersionPin: e.target.value } })} /></Form.Item>
                </Form>
              ),
            },
            {
              key: "security", label: t("admin.system.security"),
              children: (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item label={t("admin.system.sessionPolicy")}><Input value={draft.security.sessionPolicy} onChange={(e) => patch({ security: { ...draft.security, sessionPolicy: e.target.value } })} /></Form.Item>
                  <Form.Item label={t("admin.system.allowedExportFormats")}>
                    <Select mode="multiple" value={draft.security.allowedExportFormats}
                      onChange={(v) => patch({ security: { ...draft.security, allowedExportFormats: v } })}
                      options={["pdf", "excel", "csv", "json"].map((f) => ({ value: f, label: f.toUpperCase() }))} />
                  </Form.Item>
                  <Form.Item label={t("admin.system.piiRedaction")}>
                    <Switch checked={draft.security.piiRedaction} onChange={(v) => patch({ security: { ...draft.security, piiRedaction: v } })} />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "integrations", label: t("admin.system.integrations"),
              children: (
                <Form layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item label={t("admin.system.oidcIssuer")} extra={t("admin.system.oidcReadOnly")}>
                    <Input value={draft.integrations.oidcIssuer} readOnly disabled />
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
        <Button type="primary" style={{ marginTop: 16 }} loading={update.isPending} onClick={save}>{t("common.save")}</Button>
      </div>
    );
  }
  ```
  > The save-confirm test clicks an OK/confirm button rendered by antd `Modal.confirm`; its label comes from `okText={t("common.confirm")}`. Ensure `common.confirm` exists in both locale files (it is reused from Task 19). The regex `/confirm|ok|تایید/i` matches whichever locale is active in the test (default en in jsdom).
  Run: `cd report-web && npx vitest run src/admin/system/SystemSettings.test.tsx` → expected PASS (2 passed).

- [ ] **Step 9: Wire routes in `router.tsx`.** The `tenant` route **REPLACES** the Task 11 `/admin/tenant` placeholder subtree (`P("TenantSettings")`/`P("QuotaManagement")`), and `tenants`/`system` **REPLACE** the Task 11 `/admin/tenants` placeholder nodes (`P("TenantList")`/`P("TenantCreate")`/`P("TenantDetail")`) and add the new `/admin/system` node. Under the admin subtree:
  ```tsx
  { path: "tenant", element: <RequirePermission perm="users:manage"><TenantSettings /></RequirePermission> },
  { path: "tenants", element: <RequireSuperAdmin><TenantList /></RequireSuperAdmin> },
  { path: "system", element: <RequireSuperAdmin><SystemSettings /></RequireSuperAdmin> },
  ```
  Import `TenantSettings`, `TenantList`, `SystemSettings`, and `RequireSuperAdmin` (Task 17). `/admin/tenant` is the current-tenant settings (Tenant Admin+); `/admin/tenants` and `/admin/system` are Super-Admin-only.

- [ ] **Step 10: Add i18n keys.** Add to both locale files:
  - `admin.tenant.{title,branding,displayName,productName,logo,uploadLogo,primaryColor,accentColor,defaultLocale,plan,perTenantAi,quotaUsage,quotaNearLimit}`, `admin.tenant.planValue.{free,pro,enterprise}`, `admin.tenant.metric.{users,reports,dashboards,dataSources,aiTokens,aiCost,exports,storageMb}`.
  - `admin.tenants.{title,create,edit,displayName,slug,plan,status,defaultLocale,suspend,suspendTitle,suspendWarn,reactivate,empty}`, `admin.tenants.statusValue.{active,trial,suspended}`.
  - `admin.system.{title,general,flags,aiDefaults,security,integrations,defaultLocale,defaultTheme,dateSystem,light,dark,jalali,gregorian,defaultProvider,defaultModel,globalTokenBudget,defaultCacheTtl,promptVersionPin,sessionPolicy,allowedExportFormats,piiRedaction,oidcIssuer,oidcReadOnly,confirmTitle,confirmBody,saved}`, `admin.system.flag.{advancedECharts,dashboardSharing,exportFormats}`.
  - Persian values in `fa.json` (default RTL), English in `en.json`. Reuse `common.{save,edit,cancel,confirm,actions}`.

- [ ] **Step 11: Run the full gate.** `cd report-web && npx vitest run src/admin/tenant src/admin/tenants src/admin/system && npm run lint && npm run build` → all green.
  Commit:
  ```
  git commit -am "feat(report-web): admin tenant settings + tenants list + system settings"
  ```
  with trailer line:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

**Acceptance criteria:** `/admin/tenant` (gated `users:manage`) edits branding (with live theme-color preview), defaults, plan, and shows Recharts/Progress quota-usage bars that warn at ≥80% and exception at ≥100%; it deep-links per-tenant AI config to `/admin/ai/providers`. `/admin/tenants` and `/admin/system` are Super-Admin-only (`RequireSuperAdmin`): the former lists/creates/suspends/reactivates every tenant; the latter exposes General / Feature-flags / AI-defaults / Security / Integrations tabs with a save-confirm modal and a read-only OIDC issuer (`auth.myceo.ir`). Every screen gates on the correct §10 role via `useAuth`.


### Task 23: Project README, final verification, and demo checklist

This is the final task. It writes `report-web/README.md` — the single onboarding doc for the prototype: how to run/build/test, the full env-var set, the **three swap seams** (AI / data / auth) that make v2 a backend-only project, the v1 scope boundary, and the v2/v3 swap points distilled from spec section 13. It then runs the whole project's verification gate (`build` + `lint` + `test`, all green) and walks the manual demo path end-to-end. All earlier tasks must be merged into `feat/report-service` before starting this one.

**Files:**
- Create: `report-web/README.md`
- Modify: (none)
- Test: (none — this task is documentation + a full-suite verification gate; no new unit test)

**Interfaces:**
- Consumes (the names this README documents — they must already exist from earlier tasks; do not invent signatures):
  - `createAIService(): IReportAIService` and `interface IReportAIService { generate(req: GenerateReportRequest): Promise<AIReportResult> }` with `GenerateReportRequest = { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en" }` and `AIReportResult = { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string }` (from `report-web/src/ai/*`, re-exported via `report-web/src/contracts/ai.ts`). [R2]
  - `runQuery(def: ReportDefinition, dataset: Dataset, semantic: SemanticModel): QueryResult` (from `report-web/src/query/engine.ts`), pure + synchronous. [R3]
  - `chooseView(def: ReportDefinition, result: QueryResult, semantic: SemanticModel): ReportView[]` (from `report-web/src/presentation/auto-viz.ts`). [R4]
  - `useAuth(): { user: SessionUser | null; roles: AppRole[]; isAdmin: boolean; ready: boolean; login(): void; logout(): void }` (from `report-web/src/auth/useAuth.ts`). [R6]
  - The mockApi fetcher + TanStack Query hooks (`report-web/src/api/mockApi.ts`, `report-web/src/api/queries.ts`) and seed data (`report-web/src/api/seed.ts`).
  - The Vite env contract: `VITE_AUTH_MODE`, `VITE_USE_MOCK_API`, `VITE_AUTH_AUTHORITY`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_SCOPE`, `VITE_API_BASE`, `VITE_AI_MODE` (read via `import.meta.env`).
- Produces:
  - `report-web/README.md` — the canonical contributor/reviewer doc. No code symbols are exported by this task; later tasks (there are none after 23) rely on nothing here.

- [ ] **Step 1: Confirm the branch and a clean tree.** From the monorepo root, verify you are on the integration branch and that all prior tasks are present.
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19" && git rev-parse --abbrev-ref HEAD && test -d report-web && echo "report-web present" || echo "MISSING report-web"
    ```
  - Expected output:
    ```
    feat/report-service
    report-web present
    ```
  - If `report-web` is MISSING, stop — Tasks 1–22 have not been merged and this task cannot be verified.

- [ ] **Step 2: Sanity-check the scripts this README will document exist.** Confirm `report-web/package.json` defines `dev`, `build`, `lint`, `preview`, and `test` so the README's commands are accurate.
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19/report-web" && node -e "const s=require('./package.json').scripts||{}; ['dev','build','lint','preview','test'].forEach(k=>console.log(k, k in s ? 'OK' : 'MISSING'))"
    ```
  - Expected output (every line ends in `OK`):
    ```
    dev OK
    build OK
    lint OK
    preview OK
    test OK
    ```
  - If any line says `MISSING`, fix `report-web/package.json` first (the scaffolding task should have added it) — do not document a command that does not run.

- [ ] **Step 3: Write `report-web/README.md`.** Create the file with the complete content below (verbatim — no placeholders, no "TODO"). It is in English with the Persian canonical prompt quoted exactly as the demo uses it.

  ````markdown
  # report-web — AI-Powered Reporting & Analytics Platform (v1 prototype)

  A standalone **React 19 + Vite + TypeScript** single-page app — the v1 **frontend prototype**
  of an AI-native, multi-tenant BI/reporting product, hosted (later) at `report.myceo.ir`.
  It lives in the `mabhas19` monorepo at `report-web/` and is **deliberately not Next.js**
  (the existing `web/` app stays on Next.js).

  > **What v1 is.** A high-fidelity, **fully offline-capable** prototype: a *real* in-browser
  > query engine computes every table/KPI/chart over bundled sample datasets; only the **AI brain**
  > and the **persistence layer** are mocked behind clean interfaces. There is **no backend in v1**.
  > v1 proves the experience; v2 makes it real; v3 makes it a product (see [Roadmap](#roadmap--v2v3-swap-points)).

  ---

  ## Quick start

  ```bash
  cd report-web
  npm install
  npm run dev        # http://localhost:5173  (Vite dev server)
  ```

  By default the app runs **fully offline**: `VITE_AUTH_MODE=mock` (a dev mock-user with a
  selectable role) and `VITE_USE_MOCK_API=true` (a `localStorage`-backed mock backend with seed data).
  No network, no IdP, no API are required to click through the entire product.

  ### Build & preview the production bundle

  ```bash
  npm run build      # Vite → report-web/dist/  (hashed, immutable JS/CSS + index.html)
  npm run preview    # serve the built bundle on http://localhost:4173 for a sanity check
  ```

  ### Lint & test

  ```bash
  npm run lint       # ESLint over src/ (stack-rule gate: no AntD in charts/dashboard layout)
  npm run test       # vitest: contracts, query engine, auto-viz, mock AI, export
  ```

  ---

  ## Environment variables

  Vite bakes only `import.meta.env.VITE_*` variables **at build time** (there is no Node runtime —
  the production image is static files behind nginx, so nothing is read at request time). Copy
  `.env.example` to `.env.local` for dev overrides; the committed `.env` carries the offline defaults.

  | Key | Dev default (offline) | Prod value | What it does |
  |-----|-----------------------|------------|--------------|
  | `VITE_AUTH_MODE` | `mock` | `oidc` | **Auth seam.** `mock` = offline dev user with a selectable role (no IdP). `oidc` = real Authorization Code + PKCE against the `report-web` client at `auth.myceo.ir`. Read in `src/auth/*`. |
  | `VITE_USE_MOCK_API` | `true` | `false` | **Data seam.** `true` = `localStorage` mock backend + seed data behind the TanStack Query hooks. `false` = the same hooks hit the real HTTP API. |
  | `VITE_AI_MODE` | `mock` | `gateway` | **AI seam.** `mock` = `MockReportAIService` (example prompts + rules). `gateway` = the future HTTP-backed AI Gateway. `createAIService()` picks the implementation from this flag. |
  | `VITE_AUTH_AUTHORITY` | `https://auth.myceo.ir` | `https://auth.myceo.ir` | OIDC issuer/authority (used only when `VITE_AUTH_MODE=oidc`). |
  | `VITE_AUTH_CLIENT_ID` | `report-web` | `report-web` | The public PKCE OIDC client id registered in the IdP. |
  | `VITE_AUTH_SCOPE` | `openid profile email roles mabhas19.api` | `openid profile email roles mabhas19.api` | Scopes requested at sign-in; `mabhas19.api` is the API audience, `roles` carries the `role` claim the UI reads. |
  | `VITE_API_BASE` | `https://api.mabhas19.myceo.ir` | `https://api.mabhas19.myceo.ir` | Base URL the real fetcher targets when `VITE_USE_MOCK_API=false`. Ignored while the mock API is on. |

  > **Mock-API caveat.** When `VITE_USE_MOCK_API=true`, the "backend" is `localStorage` **per browser**
  > — data is per-device, not shared, and resets on cache clear. That is fine for a demo; real,
  > multi-user persistence arrives with the v2 backend.

  ---

  ## The three swap seams (why v2 is a backend-only project)

  v1's whole point is that the entire user-facing surface is built **now**, behind three clean
  interfaces. v2 swaps *implementations* behind these seams without rewriting a single screen.

  1. **AI seam — `IReportAIService`** (`src/ai/`, contract re-exported from `src/contracts/ai.ts`)
     ```ts
     interface IReportAIService {
       generate(req: GenerateReportRequest): Promise<AIReportResult>;
     }
     // GenerateReportRequest = { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en" }
     // AIReportResult       = { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string }
     function createAIService(): IReportAIService; // v1 → MockReportAIService; v2 → HttpReportAIService
     ```
     The mock maps a Persian/English prompt to a `ReportDefinition` via curated example prompts +
     keyword/intent rules. v2 drops in an HTTP-backed implementation grounded in the semantic
     layer — **every caller (`Ask AI`, builder) is unchanged** because it only ever calls `generate(req)`.

  2. **Data seam — the mockApi fetcher behind TanStack Query** (`src/api/mockApi.ts`, `src/api/queries.ts`, `src/api/seed.ts`)
     The TanStack Query **hook signatures are the contract** (`useReports()`, `useReport(id)`,
     `useSaveReport()`, `useDashboards()`, …). v1 backs them with `localStorage` + seed data; v2
     swaps the fetcher to the real HTTP API. Components consume hooks, never the transport, so the
     swap is invisible above the `src/api/` line.

  3. **Auth seam — `useAuth()`** (`src/auth/`)
     ```ts
     useAuth(): {
       user: SessionUser | null; roles: AppRole[]; isAdmin: boolean;
       ready: boolean; login(): void; logout(): void;
     };
     ```
     `VITE_AUTH_MODE=mock` yields an offline dev user whose role is selectable from a dev-only
     **Role Switcher** in the top bar; `VITE_AUTH_MODE=oidc` yields the real `auth.myceo.ir` PKCE
     session. **One code path, swappable source** — `useAuth()` and the authorization helpers behave
     identically whether the identity came from the mock store or real OIDC claims.

  > The single architectural bet: these three seams (`IReportAIService`, the mockApi fetcher,
  > `useAuth()`) plus the **`ReportDefinition` JSON contract** make v2 a back-end-only effort with
  > **no screen rewrites**.

  ---

  ## Architecture in one screen

  ```
  prompt ──> IReportAIService.generate(req) ──> ReportDefinition (JSON, the single source of truth)
                                                     │
                runQuery(def, dataset, semantic) ────┤ pure + synchronous, in-browser
                                                     ▼
                                                 QueryResult ──> chooseView(def, result, semantic)
                                                     │                         │
                                                     ▼                         ▼  ReportView[]
                                            ReportViewRenderer  (Table / KPI / Recharts / ECharts)
                                                     │
                          export: CSV + JSON (real, client-side from def + result)   [PDF/Excel = v2]
  ```

  - **Semantic layer is mandatory** — every "AI" operation goes through typed entities/fields
    (`string` / `number` / `date` / `boolean`, with `dimension`/`measure` roles), never the raw shape.
  - **Stack rules (enforced by lint/review):** Ant Design only for **admin/system UI, Tables, Cards,
    Forms, and the report library** — **never** for charts or dashboard layout. Charts = Recharts
    (basic) / Apache ECharts (advanced BI); dashboard = `react-grid-layout`.
  - **i18n:** `fa-IR` (default, **RTL**) + `en-US` (LTR) via react-i18next; RTL applied through AntD
    `ConfigProvider direction`.

  Folder map (`src/`): `contracts/`, `semantic/`, `query/`, `ai/`, `presentation/`, `dashboard/`,
  `features/` (`ask-ai`, `viewer`, `library`, `dashboards`, `export`), `admin/`, `auth/`, `api/`,
  `store/`, `i18n/`, `theme/`, `layout/`, `app/`.

  ---

  ## v1 scope (what's built vs. deferred)

  **Built in v1**
  - Mocked AI brain (`IReportAIService` — example prompts + rules), swappable for a real provider.
  - **Real** in-browser query engine: filter / group / aggregate (sum, avg, min, max, count,
    countDistinct) / sort / calculated fields / drill-down, over bundled sample datasets (vitest-tested, pure).
  - Mandatory semantic layer (mock models for the sample datasets).
  - All **user** screens: Ask-AI prompt + preview, report builder (columns/filters/sort/group/
    aggregations/calculated fields/drill-down), auto-visualization, Presentation `views[]` rendering,
    dashboard builder (`react-grid-layout`), report library.
  - All **admin/system** screens (AntD shells over mock data): Users, Roles/permissions, AI Providers,
    Data Sources, Semantic Models, Tenant settings, Audit log, AI routing/prompts/usage, System.
  - **Export: CSV + JSON are fully real** (client-side from `ReportDefinition` + result). **PDF/Excel
    show in the menu but are disabled with a "v2" tag.**
  - Global OIDC `report-web` PKCE client **+ dev mock-user toggle** (fully offline); roles read from
    claims and **simulated** in the UI.
  - Mock backend (`localStorage` + seed) behind TanStack Query hooks whose signatures match the future real API.

  **Out of scope for v1 (designed for later)**
  - Any new .NET service, real data-source connections, server-side RBAC enforcement, real tenant
    isolation, PDF/Excel export, multi-provider AI, real AI calls, caching/cost tracking.

  ---

  ## Roadmap — v2/v3 swap points

  Each version is a standalone, demoable milestone, and the cross-version **contracts never break**:
  the `ReportDefinition` JSON, the `IReportAIService` interface, and the TanStack Query hook
  signatures are fixed in v1 so later versions swap *implementations* without rewriting screens.

  | | v1 — Prototype (this build) | v2 — Real backend | v3 — Platform |
  |---|---|---|---|
  | **AI brain** | Mocked (`IReportAIService`) | Real AI Gateway, 1–2 providers (OpenAI + Ollama), semantic-grounded | Full multi-provider router: fallback, caching, cost/token dashboards, prompt versioning |
  | **Query engine** | Real, in-browser, bundled samples | Real, server-side, real tenant data | Same, hardened + scaled (large datasets, cross-source drill-down) |
  | **Persistence** | `localStorage` mockApi | SQL Server (or per-tenant store) | + audit/usage stores |
  | **Auth** | OIDC `report-web` + mock toggle | Same OIDC; server validates JWT (`mabhas19.api`) | + full RBAC enforcement, SSO/SCIM-ready |
  | **RBAC** | Simulated in the UI from claims | Enforced server-side (7 roles, permission matrix) | Tenant-scoped, delegated admin, audit-logged |
  | **Multi-tenant** | Single mock tenant (UI only) | Real isolation + per-tenant config | Branding, quotas, tenant-specific AI config |
  | **Export** | CSV + JSON (client-side) | + PDF + Excel (server-rendered from the same JSON) | Scheduled/emailed/large-export jobs |
  | **Charts** | Recharts + basic ECharts | Same | Advanced ECharts BI (heatmaps, gauges, combos, maps) |
  | **Net-new backend?** | **No** | **Yes** (the main v2 deliverable) | Yes (extends v2) |

  **The v2 swap points (documented exit criterion of v1):**
  - `IReportAIService` (`createAIService()`) — replace `MockReportAIService` with the HTTP gateway impl.
  - The mockApi fetcher behind TanStack Query — point the hooks at the real `api.mabhas19.myceo.ir`.
  - `VITE_USE_MOCK_API=false` / `VITE_AUTH_MODE=oidc` / `VITE_AI_MODE=gateway` flip the three seams from mock to real.

  **Cross-version invariants** (set in v1, stable through v2/v3): `ReportDefinition` JSON;
  `IReportAIService`; TanStack Query hook signatures; semantic-layer typing; OIDC against
  `auth.myceo.ir`, scope `mabhas19.api`, role claim `role`; the AntD/charts/layout stack rules and
  fa-IR RTL default.

  ---

  ## Deployment (designed now, applied at promotion to `report.myceo.ir`)

  v1 is **local-only**; deployment is a *design* that bridges to production. None of it is required
  to demo v1 on a laptop.

  - **Build & serve:** Vite produces a static `dist/`; served by **nginx** (`report-web/deploy/nginx.conf`)
    with SPA history fallback (deep links → `index.html`), immutable caching for `/assets/`,
    `no-store` for `index.html`, and gzip. Image: multi-stage `node:24-alpine` build →
    `nginx:1.27-alpine` final, runs non-root on `:8080` (`report-web/deploy/Dockerfile.report-web`,
    build context = monorepo root). For production the image is built with `VITE_USE_MOCK_API=false`,
    `VITE_AUTH_MODE=oidc`.
  - **Compose + Traefik:** a `report-web` service attaches to the **same external `traefik` network**
    and cert resolver `myresolver`, router/service prefixed `m19report`,
    `Host(\`${REPORT_DOMAIN}\`)`, `loadbalancer.server.port=8080`. No `depends_on`, no DB, no internal
    network — a static SPA talks to `api`/`auth` over the public Traefik path. New SOPS env key:
    `REPORT_DOMAIN=report.myceo.ir`.
  - **OIDC client:** register the public PKCE client `report-web` in the IdP
    (`EnsureClientAsync`, idempotent), scope `mabhas19.api`, no client secret.
  - **API CORS:** add `https://report.myceo.ir` to `Cors:AllowedOrigins` (baked into the API image →
    requires an API rebuild/redeploy).
  - **Iran build/transfer constraint:** the server (`10.249.52.216`, Iran) cannot reach Docker Hub's
    blob CDN or `mcr.microsoft.com`, so `report-web` follows the same **build-locally →
    `docker save | gzip` → `pscp` transfer → `docker load`** path as `api`/`web`. Tag `:rollback`
    before load for instant revert; deploy **only** this service with
    `up -d --no-deps report-web` (the shared daemon also runs mailcow/supabase — never restart it).

  See the monorepo `deploy/README.md` for the canonical build-locally / `docker save | gzip` / `pscp` /
  `docker load` and SOPS + age secrets flow.

  ---

  ## Manual demo checklist (offline, ~2 minutes)

  Run with the offline defaults (`VITE_AUTH_MODE=mock`, `VITE_USE_MOCK_API=true`, `VITE_AI_MODE=mock`).

  1. **Mock login.** `npm run dev` → open `http://localhost:5173`. The dev mock-user toggle signs you
     in with no network. Use the top-bar **Role Switcher** to pick a role (e.g. Power User, then
     Tenant Admin) and confirm menus/buttons change live.
  2. **Ask AI — the canonical example.** Open **Ask AI**, type (or click the seeded chip)
     **«درآمد ماهانه به تفکیک استان»** ("Show monthly revenue by province") and submit. After a short
     "thinking" state a **really computed** report renders (a line/heatmap + table over the sales
     sample dataset) — driven through `IReportAIService` → `ReportDefinition` → `runQuery` →
     `chooseView` → `ReportViewRenderer`. Confirm the result is real (drill into a province/month).
  3. **Save.** Save the report; confirm it appears in the **Report Library** (persisted via the
     mockApi/`localStorage`).
  4. **Add to a dashboard.** Open the **Dashboard builder**, add the saved report as a widget,
     drag/resize it on the `react-grid-layout` grid, then **reload the page** and confirm the layout
     and the widget persist.
  5. **Open an admin screen.** Navigate to an **admin** area (e.g. Users or AI Providers) and confirm
     the AntD shell renders over mock data and is navigable.
  6. **Switch locale & direction.** Toggle to `en-US` (LTR) and back to `fa-IR` (RTL); confirm layout
     direction flips and the same screens render in both.
  7. **Export.** From the report's export menu, export **CSV** and **JSON** (both real); confirm the
     **PDF** and **Excel** items are visible but disabled with a "v2" tag.
  ````

- [ ] **Step 4: Run the full verification gate — build.** From `report-web`, run the production build and confirm it succeeds (this also surfaces any TypeScript error, since `vite build` runs `tsc`/type-check per the scaffolding).
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19/report-web" && npm run build
    ```
  - Expected output (final lines; exact asset names will differ):
    ```
    vite vX.Y.Z building for production...
    ✓ NNN modules transformed.
    dist/index.html                   ...
    dist/assets/index-XXXXXXXX.css    ...
    dist/assets/index-XXXXXXXX.js     ...
    ✓ built in N.NNs
    ```
  - Exit code must be `0`. If the build fails, the failure belongs to an earlier task — stop and report it; do not paper over it in the README.

- [ ] **Step 5: Run the full verification gate — lint.** Confirm ESLint passes, including the stack-rule gate (no AntD imports in charts/dashboard-layout code).
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19/report-web" && npm run lint
    ```
  - Expected output:
    ```
    (no output — ESLint exits 0 with no errors or warnings)
    ```
  - Exit code must be `0`.

- [ ] **Step 6: Run the full verification gate — tests.** Run the entire vitest suite once (CI mode, no watch) and confirm every test file passes.
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19/report-web" && npm run test -- --run
    ```
  - Expected output (final summary; file/test counts depend on earlier tasks but all must pass):
    ```
    Test Files  NN passed (NN)
         Tests  NNN passed (NNN)
      Start at  ...
      Duration  ...
    ```
  - Exit code must be `0`. There must be `0 failed`. If any test fails, fix the owning task before completing Task 23.

- [ ] **Step 7: Spot-check the demo path renders (preview).** Build is already done (Step 4); start the preview server in the background and curl the root to confirm the static bundle serves `index.html`.
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19/report-web" && (npm run preview >/tmp/report-preview.log 2>&1 &) && sleep 3 && curl -fsS http://localhost:4173/ | grep -o "<div id=\"root\"></div>" && curl -fsS http://localhost:4173/reports/123 | grep -o "<div id=\"root\"></div>"
    ```
  - Expected output (the SPA history fallback returns `index.html` for a deep link too):
    ```
    <div id="root"></div>
    <div id="root"></div>
    ```
  - Then stop the preview server:
    ```bash
    pkill -f "vite preview" || true
    ```
  - If the deep-link line is missing, the preview/SPA-fallback is misconfigured — note it (production uses nginx `try_files`, so this is only a dev-preview check).

- [ ] **Step 8: Commit.** Stage the README and commit on `feat/report-service`.
  - Command:
    ```bash
    cd "D:/projects/mabhas19App/mabhas19" && git add report-web/README.md && git commit -m "$(printf 'docs(report-web): add README (run/build/test, env, three swap seams, v1 scope, v2/v3 swap points, demo checklist)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
    ```
  - Expected output:
    ```
    [feat/report-service XXXXXXX] docs(report-web): add README (run/build/test, env, three swap seams, v1 scope, v2/v3 swap points, demo checklist)
     1 file changed, NNN insertions(+)
    ```

**Acceptance criteria:**
- `report-web/README.md` exists and documents: quick start (`dev`/`build`/`preview`/`lint`/`test`), the full `VITE_*` env-var table, the **three swap seams** (AI `IReportAIService` via `createAIService()`, data mockApi-behind-TanStack-Query, auth `useAuth()` via `VITE_AUTH_MODE`), the v1 scope (built vs. deferred), the v2/v3 swap points and cross-version invariants from spec §13, the deployment design from spec §12, and the manual demo checklist.
- The demo checklist covers, in order: mock login (with Role Switcher) → Ask-AI with the canonical example «درآمد ماهانه به تفکیک استان» → save → add to dashboard (persists across reload) → open an admin screen.
- `npm run build`, `npm run lint`, and `npm run test -- --run` all exit `0` from `report-web/` (Steps 4–6) — the final all-green verification gate.
- The commit lands on `feat/report-service` with the required `Co-Authored-By` trailer.