# analytics-web Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all ~20 `analytics-web` screens with a cohesive Ant Design UI (hybrid: Calm Enterprise base + dark-mode toggle + bento dashboards), via a single theme-token source and a shared UI-primitive layer, without changing charts, animations, backend, routes, auth, or i18n.

**Architecture:** Build theme tokens + a `components/ui` primitive layer first, then migrate every screen onto those primitives, area by area. Ant Design `ConfigProvider` drives theming (light/dark algorithm + RTL). Charts (ECharts/Recharts) and framer-motion are untouched except for receiving theme colors so dark mode renders correctly.

**Tech Stack:** React 19, Vite 6, TypeScript, Ant Design 5, ECharts + Recharts, react-grid-layout, framer-motion, Zustand, TanStack Query, react-i18next (fa-IR/RTL default + en-US), Vitest + Testing-Library.

## Global Constraints

- Ant Design is the component library for all non-chart UI; charts stay ECharts/Recharts; dashboard layout stays react-grid-layout.
- Do NOT change: chart rendering logic, framer-motion animations, backend/API, data shapes, routes, auth/OIDC, i18n keys/behavior, or the three swap seams (`@/ai`, `VITE_USE_MOCK_API`, `VITE_AUTH_MODE`).
- RTL-first: fa-IR default (RTL), en-US (LTR). Every component works in both directions AND both light/dark.
- Persian/Vazirmatn typography preserved. Two font weights (400/500). Sentence case.
- Preserve all functionality and flows. Restyle/restructure, not behavior rewrite.
- Tests stay green; update selectors/snapshots for new markup but never weaken assertions.
- `npm run build` (tsc + vite) and `npm run lint` must pass at the end of every task.
- Work on branch `feat/frontend-redesign`. Commit after each task.
- All work is under `analytics-web/`. Run commands from `analytics-web/` unless noted.

---

## File Structure

**New:**
- `analytics-web/src/components/ui/PageHeader.tsx` — page title/subtitle/breadcrumbs/actions row
- `analytics-web/src/components/ui/PageContainer.tsx` — max-width + padding + vertical rhythm wrapper
- `analytics-web/src/components/ui/SectionCard.tsx` — antd Card preset
- `analytics-web/src/components/ui/KpiTile.tsx` — bento metric tile
- `analytics-web/src/components/ui/Toolbar.tsx` — filter/search/action row
- `analytics-web/src/components/ui/DataTable.tsx` — antd Table wrapper (paging/sort/empty/loading)
- `analytics-web/src/components/ui/EmptyState.tsx` — antd Empty preset
- `analytics-web/src/components/ui/ErrorState.tsx` — antd Result(error) preset
- `analytics-web/src/components/ui/Loading.tsx` — skeleton/spinner presets
- `analytics-web/src/components/ui/FormDrawer.tsx` — create/edit drawer shell
- `analytics-web/src/components/ui/ConfirmModal.tsx` — confirm helper (wraps antd Modal.confirm)
- `analytics-web/src/components/ui/index.ts` — barrel export
- `analytics-web/src/theme/tokens.ts` — shared light/dark token objects + chart color helper
- `*.test.tsx` next to each new primitive

**Modified:**
- `analytics-web/src/theme/theme.ts`, `analytics-web/src/theme/ThemeProvider.tsx` — consume `tokens.ts`, add dark algorithm + toggle
- `analytics-web/src/layout/AppLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`
- `analytics-web/src/features/ask-ai/*`, `features/library/ReportLibrary.tsx`, `features/viewer/*`, `features/dashboards/*`, `dashboard/DashboardCanvas.tsx`
- `analytics-web/src/admin/**/*` (all)
- `analytics-web/src/presentation/renderers/KpiRenderer.tsx`, `TableRenderer.tsx` (restyle); `EChartsRenderer.tsx`, `RechartsRenderer.tsx` (color-feed only)
- `analytics-web/src/auth/routes.tsx`
- `analytics-web/src/i18n/locales/fa.json`, `en.json` (new UI strings only)
- `analytics-web/src/store/ui-store.ts` (theme mode state, if not present)

---

## Task 0: Pre-flight

- [ ] **Step 1:** From `analytics-web/`, run `npm run build` and `npm run test` to confirm a green baseline. Record current pass counts.
- [ ] **Step 2:** Read the current `src/theme/theme.ts`, `src/theme/ThemeProvider.tsx`, `src/store/ui-store.ts`, `src/layout/AppLayout.tsx`, `src/layout/Sidebar.tsx`, `src/layout/Topbar.tsx` so later tasks extend (not rewrite) existing patterns.

Expected: baseline build + tests pass.

---

## Task 1: Theme tokens + dark mode + chart color helper

**Files:** Create `src/theme/tokens.ts`; Modify `src/theme/theme.ts`, `src/theme/ThemeProvider.tsx`, `src/store/ui-store.ts`; Test `src/theme/tokens.test.ts`.

**Interfaces — Produces:**
- `lightTokens: ThemeConfig['token']`, `darkComponentTokens`, `sharedToken`
- `buildTheme(mode: 'light' | 'dark'): ThemeConfig` — merges algorithm + tokens
- `chartColors(mode: 'light'|'dark'): { text:string; axis:string; grid:string; series:string[] }`
- ui-store: `themeMode: 'light'|'dark'`, `toggleTheme()`, persisted to `localStorage` key `analytics-theme`

- [ ] **Step 1: Write the failing test** (`src/theme/tokens.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { buildTheme, chartColors } from "./tokens";

describe("theme tokens", () => {
  it("light theme uses emerald primary", () => {
    const t = buildTheme("light");
    expect(t.token?.colorPrimary).toBe("#0f6e56");
  });
  it("dark theme sets a dark base background", () => {
    const t = buildTheme("dark");
    expect(t.algorithm).toBeDefined();
    expect(t.token?.colorPrimary).toBe("#1d9e75");
  });
  it("chartColors differ between modes", () => {
    expect(chartColors("light").text).not.toBe(chartColors("dark").text);
    expect(chartColors("dark").series.length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run** `npm run test -- tokens` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/theme/tokens.ts`

```ts
import { theme as antdTheme, type ThemeConfig } from "antd";

const radius = { borderRadius: 8, borderRadiusLG: 12 } as const;
const typography = { fontFamily: "Vazirmatn, -apple-system, Segoe UI, sans-serif", fontSize: 14 } as const;

export const sharedToken = { ...radius, ...typography, wireframe: false } as const;

export const lightTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#0f6e56",
  colorBgLayout: "#f7f8f8",
  colorBgContainer: "#ffffff",
  colorBorderSecondary: "#ebece9",
};

export const darkTokens: ThemeConfig["token"] = {
  ...sharedToken,
  colorPrimary: "#1d9e75",
  colorBgLayout: "#0e1513",
  colorBgContainer: "#15211d",
  colorBorderSecondary: "#1d2a26",
};

export function buildTheme(mode: "light" | "dark"): ThemeConfig {
  return {
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: mode === "dark" ? darkTokens : lightTokens,
    cssVar: true,
  };
}

const SERIES = ["#0f6e56", "#1d9e75", "#5dcaa5", "#185fa5", "#ef9f27", "#d4537e", "#7f77dd"];
export function chartColors(mode: "light" | "dark") {
  return mode === "dark"
    ? { text: "#e6efe9", axis: "#8aa39a", grid: "#1d2a26", series: SERIES }
    : { text: "#1c1c1a", axis: "#6b6b66", grid: "#ebece9", series: SERIES };
}
```

- [ ] **Step 4:** Modify `ThemeProvider.tsx` to read `themeMode` from ui-store and pass `buildTheme(mode)` to antd `ConfigProvider` (keep existing `direction` logic). Add `themeMode`/`toggleTheme` to `ui-store.ts` with localStorage persistence (key `analytics-theme`, default `"light"`).

- [ ] **Step 5: Run** `npm run test -- tokens` → PASS; `npm run build` → PASS.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(analytics-web): theme tokens + dark mode foundation"`

---

## Task 2: Layout primitives (PageHeader, PageContainer, SectionCard, EmptyState, ErrorState, Loading)

**Files:** Create the six files under `src/components/ui/` + `index.ts`; Tests next to each.

**Interfaces — Produces:**
- `PageHeader: { title: ReactNode; subtitle?: ReactNode; breadcrumbs?: {title:ReactNode;href?:string}[]; actions?: ReactNode }`
- `PageContainer: { children: ReactNode; maxWidth?: number }`
- `SectionCard: AntCardProps & { title?: ReactNode; extra?: ReactNode }`
- `EmptyState: { description?: ReactNode; action?: ReactNode; icon?: ReactNode }`
- `ErrorState: { title?: ReactNode; detail?: ReactNode; onRetry?: () => void }`
- `Loading: { rows?: number; mode?: "skeleton"|"spin" }`

- [ ] **Step 1: Write failing tests** (one per primitive). Example `PageHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

it("renders title and actions", () => {
  render(<PageHeader title="گزارش‌ها" actions={<button>جدید</button>} />);
  expect(screen.getByText("گزارش‌ها")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "جدید" })).toBeInTheDocument();
});
```

`EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
it("shows description", () => {
  render(<EmptyState description="موردی یافت نشد" />);
  expect(screen.getByText("موردی یافت نشد")).toBeInTheDocument();
});
```

(Write analogous one-assertion render tests for PageContainer, SectionCard, ErrorState, Loading.)

- [ ] **Step 2: Run** `npm run test -- components/ui` → FAIL (missing modules).

- [ ] **Step 3: Implement** the primitives. Reference implementations:

```tsx
// PageHeader.tsx
import { Breadcrumb, Flex, Space, Typography } from "antd";
import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, breadcrumbs, actions }: {
  title: ReactNode; subtitle?: ReactNode;
  breadcrumbs?: { title: ReactNode; href?: string }[]; actions?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumbs?.length ? <Breadcrumb items={breadcrumbs} style={{ marginBottom: 8 }} /> : null}
      <Flex align="center" justify="space-between" gap={12} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
          {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
        </div>
        {actions ? <Space wrap>{actions}</Space> : null}
      </Flex>
    </div>
  );
}
```

```tsx
// PageContainer.tsx
import type { ReactNode } from "react";
export function PageContainer({ children, maxWidth = 1280 }: { children: ReactNode; maxWidth?: number }) {
  return <div style={{ maxWidth, margin: "0 auto", padding: "20px 24px", width: "100%" }}>{children}</div>;
}
```

```tsx
// SectionCard.tsx
import { Card, type CardProps } from "antd";
export function SectionCard(props: CardProps) {
  return <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12 }} {...props} />;
}
```

```tsx
// EmptyState.tsx
import { Empty } from "antd";
import type { ReactNode } from "react";
export function EmptyState({ description = "موردی یافت نشد", action, icon }: { description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <Empty image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE} description={description} style={{ padding: "40px 0" }}>{action}</Empty>;
}
```

```tsx
// ErrorState.tsx
import { Button, Result } from "antd";
import type { ReactNode } from "react";
export function ErrorState({ title = "خطایی رخ داد", detail, onRetry }: { title?: ReactNode; detail?: ReactNode; onRetry?: () => void }) {
  return <Result status="error" title={title} subTitle={detail}
    extra={onRetry ? <Button onClick={onRetry}>تلاش دوباره</Button> : undefined} />;
}
```

```tsx
// Loading.tsx
import { Skeleton, Spin } from "antd";
export function Loading({ rows = 4, mode = "skeleton" }: { rows?: number; mode?: "skeleton" | "spin" }) {
  if (mode === "spin") return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>;
  return <Skeleton active paragraph={{ rows }} />;
}
```

```ts
// index.ts
export * from "./PageHeader"; export * from "./PageContainer"; export * from "./SectionCard";
export * from "./EmptyState"; export * from "./ErrorState"; export * from "./Loading";
export * from "./KpiTile"; export * from "./Toolbar"; export * from "./DataTable";
export * from "./FormDrawer"; export * from "./ConfirmModal";
```

(The `index.ts` references Task 3 primitives too; if Task 3 not done yet, export only what exists, then extend.)

- [ ] **Step 4: Run** `npm run test -- components/ui` → PASS; `npm run build` → PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): layout UI primitives"`

---

## Task 3: Data primitives (DataTable, Toolbar, KpiTile, FormDrawer, ConfirmModal)

**Files:** Create five files under `src/components/ui/`; update `index.ts`; tests next to each.

**Interfaces — Produces:**
- `DataTable<T>: { columns: ColumnsType<T>; data?: T[]; loading?: boolean; error?: unknown; rowKey: string|((r:T)=>string); empty?: ReactNode; toolbar?: ReactNode; pageSize?: number }`
- `Toolbar: { children: ReactNode }` (flex row, gap, wrap, space-between)
- `KpiTile: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: "neutral"|"emerald"|"blue"|"amber" }`
- `FormDrawer: { open: boolean; title: ReactNode; onClose():void; onSubmit():void; submitting?:boolean; children: ReactNode; width?: number }`
- `confirmAction({ title, content, onOk }): void` (wraps `Modal.confirm`)

- [ ] **Step 1: Write failing tests.** `KpiTile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { KpiTile } from "./KpiTile";
it("renders label and value", () => {
  render(<KpiTile label="کل پروژه‌ها" value="۱۷۱٬۰۶۸" />);
  expect(screen.getByText("کل پروژه‌ها")).toBeInTheDocument();
  expect(screen.getByText("۱۷۱٬۰۶۸")).toBeInTheDocument();
});
```

`DataTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { DataTable } from "./DataTable";
it("shows empty state when no rows", () => {
  render(<DataTable rowKey="id" columns={[{ title: "نام", dataIndex: "name" }]} data={[]} />);
  expect(screen.getByText("موردی یافت نشد")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** `npm run test -- components/ui` → FAIL.

- [ ] **Step 3: Implement.** Reference implementations:

```tsx
// KpiTile.tsx
import { Card, Typography } from "antd";
import type { ReactNode } from "react";
const TONES: Record<string, { bg: string; fg: string }> = {
  neutral: { bg: "var(--ant-color-fill-quaternary)", fg: "var(--ant-color-text)" },
  emerald: { bg: "#e1f5ee", fg: "#085041" },
  blue: { bg: "#e6f1fb", fg: "#0c447c" },
  amber: { bg: "#faeeda", fg: "#633806" },
};
export function KpiTile({ label, value, icon, tone = "neutral" }: { label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: keyof typeof TONES }) {
  const c = TONES[tone];
  return (
    <Card variant="borderless" style={{ background: c.bg, borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
      <Typography.Text style={{ color: c.fg, fontSize: 13 }}>{icon} {label}</Typography.Text>
      <div style={{ color: c.fg, fontSize: 24, fontWeight: 500, marginTop: 4 }}>{value}</div>
    </Card>
  );
}
```

```tsx
// Toolbar.tsx
import { Flex } from "antd";
import type { ReactNode } from "react";
export function Toolbar({ children }: { children: ReactNode }) {
  return <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 12 }}>{children}</Flex>;
}
```

```tsx
// DataTable.tsx
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
export function DataTable<T extends object>({ columns, data, loading, error, rowKey, empty, toolbar, pageSize = 10 }: {
  columns: ColumnsType<T>; data?: T[]; loading?: boolean; error?: unknown;
  rowKey: string | ((r: T) => string); empty?: ReactNode; toolbar?: ReactNode; pageSize?: number;
}) {
  if (error) return <ErrorState detail={String((error as Error)?.message ?? error)} />;
  return (
    <>
      {toolbar}
      <Table<T> columns={columns} dataSource={data} loading={loading} rowKey={rowKey} size="middle"
        pagination={{ pageSize, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: empty ?? <EmptyState /> }} />
    </>
  );
}
```

```tsx
// FormDrawer.tsx
import { Button, Drawer, Space } from "antd";
import type { ReactNode } from "react";
export function FormDrawer({ open, title, onClose, onSubmit, submitting, children, width = 480 }: {
  open: boolean; title: ReactNode; onClose: () => void; onSubmit: () => void; submitting?: boolean; children: ReactNode; width?: number;
}) {
  return (
    <Drawer open={open} title={title} onClose={onClose} width={width} destroyOnClose
      extra={<Space><Button onClick={onClose}>انصراف</Button><Button type="primary" loading={submitting} onClick={onSubmit}>ذخیره</Button></Space>}>
      {children}
    </Drawer>
  );
}
```

```tsx
// ConfirmModal.tsx
import { Modal } from "antd";
import type { ReactNode } from "react";
export function confirmAction({ title, content, onOk }: { title: ReactNode; content?: ReactNode; onOk: () => void | Promise<void> }) {
  Modal.confirm({ title, content, okText: "تأیید", cancelText: "انصراف", okButtonProps: { danger: true }, onOk });
}
```

- [ ] **Step 4: Run** `npm run test -- components/ui` → PASS; `npm run build` → PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): data UI primitives (DataTable/KpiTile/FormDrawer)"`

---

## Task 4: Shell (AppLayout / Sidebar / Topbar)

**Files:** Modify `src/layout/AppLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`; add theme-toggle i18n keys to `fa.json`/`en.json`.

**Interfaces — Consumes:** `themeMode`/`toggleTheme` from ui-store (Task 1).

- [ ] **Step 1:** Restyle `Sidebar.tsx` to grouped antd `Menu` (`mode="inline"`, collapsible) with the existing route items grouped under: پرسش هوشمند / گزارش‌ها / داشبوردها / داده‌ها / خروجی‌ها / مدیریت (keep current role-gating + `@/i18n/navigation` links). Keep `selectedKeys` from the current route.
- [ ] **Step 2:** Restyle `Topbar.tsx`: keep tenant switcher + user menu; add a theme-toggle `Button` (`ti`/antd icon, calls `toggleTheme()`), keep locale switch. Add i18n keys `common.theme.light`/`common.theme.dark` to both locale files.
- [ ] **Step 3:** `AppLayout.tsx`: wrap content in `PageContainer` is the SCREEN's job; here ensure antd `Layout`/`Sider`/`Header`/`Content` structure, RTL-correct sider placement, and content background `colorBgLayout`.
- [ ] **Step 4: Verify** existing `app/router.test.tsx` + any layout tests pass: `npm run test`. Fix selectors if markup changed. `npm run build` + `npm run lint` pass.
- [ ] **Step 5: Verify visually** (see "Visual verification" below) at `/ask`, toggle theme + locale, confirm sidebar/topbar in light/dark + RTL/LTR. Screenshot.
- [ ] **Step 6: Commit** `git commit -am "feat(analytics-web): redesigned app shell (sidebar/topbar/layout)"`

---

## Task 5: Ask-AI area

**Files:** Modify `src/features/ask-ai/AskAiBuilder.tsx`, `PromptHero.tsx`, `DefinitionPanel.tsx`, `ViewSwitcher.tsx`, `SaveReportModal.tsx`.

- [ ] **Step 1:** Recompose `AskAiBuilder` to: `PageHeader` (or hero) → prompt composer (`PromptHero`) → result canvas using `SectionCard` + `KpiTile` row (bento) + the existing `ReportView` (charts unchanged) + `ViewSwitcher`. Keep the dataset selector, example chips, generate→execute flow, and `useAskAi` hook usage exactly.
- [ ] **Step 2:** `SaveReportModal` → keep logic; restyle to antd `Modal` + `Form` consistent with `FormDrawer` styling.
- [ ] **Step 3: Verify** `features/ask-ai/AskAiBuilder.test.tsx` passes (update selectors if needed, do not weaken). `npm run build`/`lint` pass.
- [ ] **Step 4: Verify visually** at `/ask`: run a prompt, confirm result + KPIs render in light/dark/RTL. Screenshot.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): redesign Ask-AI area"`

---

## Task 6: Library + Viewer areas

**Files:** Modify `src/features/library/ReportLibrary.tsx`, `src/features/viewer/ReportViewer.tsx`, `src/features/viewer/FilterBar.tsx`.

- [ ] **Step 1:** `ReportLibrary` → `PageHeader` (title + "گزارش جدید" action) + `Toolbar` (search/filter) + `DataTable` (or card grid) using `EmptyState`/`Loading`. Preserve queries + navigation to viewer.
- [ ] **Step 2:** `ReportViewer` → `PageHeader` (title + export/save actions) + `FilterBar` (restyled `Toolbar`) + `ReportView` (charts unchanged). Preserve execute/refresh + filter logic.
- [ ] **Step 3: Verify** `ReportLibrary.test.tsx` + `ReportViewer.test.tsx` pass (update selectors as needed). build/lint pass.
- [ ] **Step 4: Verify visually** at `/reports` and a report viewer route, light/dark/RTL. Screenshot.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): redesign Library + Viewer"`

---

## Task 7: Dashboards area (bento)

**Files:** Modify `src/features/dashboards/DashboardList.tsx`, `DashboardBuilder.tsx`, `WidgetFrame.tsx`, `AddWidgetDrawer.tsx`, `src/dashboard/DashboardCanvas.tsx`.

- [ ] **Step 1:** `DashboardList` → `PageHeader` + card grid (`SectionCard`) + `EmptyState`. Preserve CRUD + navigation.
- [ ] **Step 2:** `DashboardBuilder` + `DashboardCanvas` → bento look: polished `WidgetFrame` (header/actions via `SectionCard`), `AddWidgetDrawer` → `FormDrawer`. Keep react-grid-layout config and widget logic unchanged.
- [ ] **Step 3:** Add a `KpiTile` row option to dashboards where KPI widgets exist (bento treatment).
- [ ] **Step 4: Verify** `DashboardList.test.tsx` + `DashboardBuilder.test.tsx` pass. build/lint pass.
- [ ] **Step 5: Verify visually** at `/dashboards` + builder: drag a widget, light/dark/RTL. Screenshot.
- [ ] **Step 6: Commit** `git commit -am "feat(analytics-web): redesign Dashboards (bento)"`

---

## Task 8: Renderers restyle + dark-mode chart colors

**Files:** Modify `src/presentation/renderers/KpiRenderer.tsx`, `TableRenderer.tsx` (restyle); `EChartsRenderer.tsx`, `RechartsRenderer.tsx` (color-feed only); `src/presentation/ReportView.tsx` if it wires renderers.

- [ ] **Step 1:** `KpiRenderer` → use `KpiTile`. `TableRenderer` → use `DataTable` (or keep antd Table but apply the shared styling). Preserve the props/contract consumed by `ReportView`.
- [ ] **Step 2:** In `EChartsRenderer`/`RechartsRenderer`, read `themeMode` from ui-store and apply `chartColors(mode)` to axis/text/grid/series colors. **Do not change** the chart-construction logic, series mapping, or data flow.
- [ ] **Step 3: Verify** all `presentation/renderers/*.test.tsx` pass (update only color/markup assertions if present; keep data assertions). build/lint pass.
- [ ] **Step 4: Verify visually:** a chart report in dark mode renders legible axes/series. Screenshot.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): restyle KPI/Table renderers + dark-mode chart colors"`

---

## Task 9: Admin area (all screens)

**Files:** Modify all under `src/admin/**`: `users/UserList.tsx`+`UserFormModal.tsx`, `roles/RolePermissionMatrix.tsx`, `data-sources/DataSourceList.tsx`, `semantic-models/SemanticModelList.tsx`+`FieldPreviewTable.tsx`, `audit/AuditLog.tsx`+`AuditEventDrawer.tsx`+`AuditCostChart.tsx`, `tenant/TenantSettings.tsx`+`QuotaPanel.tsx`, `tenants/TenantList.tsx`+`TenantFormModal.tsx`, `system/SystemSettings.tsx`, `ai/AIAdminShell.tsx`+`providers/AIProviderList.tsx`+`providers/ProviderFormModal.tsx`+`routing/AIRoutingRules.tsx`+`prompts/PromptVersions.tsx`+`usage/AIUsageCost.tsx`.

**Worked template (apply to every list screen):** `PageHeader` (title + primary action) → `DataTable` (columns unchanged, `rowKey`, `loading`/`error` from the existing query) → create/edit via `FormDrawer` (move existing `*FormModal` form bodies into the drawer, keep validation + submit handlers) → deletes via `confirmAction`. Charts inside admin (e.g. `AuditCostChart`, `AIUsageCost`) keep their chart libs; only containers restyled. `AIAdminShell` keeps its antd `Tabs`, restyled.

- [ ] **Step 1:** Migrate the simplest list first end-to-end as the reference: `data-sources/DataSourceList.tsx` → `PageHeader` + `DataTable` + (if it has a form) `FormDrawer`. Run `DataSourceList.test.tsx`.
- [ ] **Step 2:** Apply the same template to: `users`, `tenants`, `semantic-models`, `roles`, `audit`, `ai/providers`, `ai/routing`, `ai/prompts`, `ai/usage`. After each screen, run that screen's `*.test.tsx` (where present) and fix selectors without weakening assertions.
- [ ] **Step 3:** Settings-style screens (`system/SystemSettings`, `tenant/TenantSettings`+`QuotaPanel`) → `PageHeader` + `SectionCard` sections + antd `Form`. Run their tests.
- [ ] **Step 4: Verify** `npm run test` (whole suite) passes; `npm run build` + `npm run lint` pass.
- [ ] **Step 5: Verify visually** at `/admin/users`, `/admin/semantic-models`, `/admin/audit`, `/admin/ai/providers` in light/dark/RTL. Screenshots.
- [ ] **Step 6: Commit** `git commit -am "feat(analytics-web): redesign Admin area"`

---

## Task 10: Auth screens + final polish

**Files:** Modify `src/auth/routes.tsx` (LoginScreen, OidcCallback, OidcSilentCallback, LogoutScreen, ForbiddenScreen), `src/app/PagePlaceholder.tsx`.

- [ ] **Step 1:** Restyle `LoginScreen` (branded card, primary "ورود"), `ForbiddenScreen` (antd `Result` 403), keep `OidcCallback`/`OidcSilentCallback` logic; `PagePlaceholder` → `EmptyState`.
- [ ] **Step 2:** Sweep for leftover bespoke styling / inline colors that break dark mode; replace hardcoded colors with antd tokens / CSS vars.
- [ ] **Step 3: Verify** full suite `npm run test`, `npm run build`, `npm run lint` all pass.
- [ ] **Step 4: Verify visually:** log out → login screen, 403 page, in light/dark/RTL. Screenshot.
- [ ] **Step 5: Commit** `git commit -am "feat(analytics-web): redesign auth screens + final polish"`

---

## Visual verification (used by Tasks 4–10)

For each "Verify visually" step: run the analytics-web dev server and use the browser-preview workflow (or, for the deployed flow, the live `analytic.myceo.ir` session). Confirm the screen in: light mode, dark mode (toggle), fa-IR (RTL), and en-US (LTR). Capture a screenshot for the reviewer. Do not mark the task complete on a blank/error screen.

---

## Self-Review (completed by plan author)

**Spec coverage:** theme/dark (T1) ✓; shell (T4) ✓; primitives (T2,T3) ✓; Ask-AI (T5) ✓; Library/Viewer (T6) ✓; Dashboards/bento (T7) ✓; renderers + chart dark colors (T8) ✓; admin all screens (T9) ✓; auth screens (T10) ✓; i18n keys (T4) ✓; tests/build/lint gates (every task) ✓; non-goals respected (charts/animations/backend/routes/auth/i18n untouched) ✓.

**Type consistency:** `buildTheme`/`chartColors`/`themeMode`/`toggleTheme` (T1) consumed by ThemeProvider (T1) + renderers (T8); primitive prop names stable across T2/T3 and consumed by T4–T10; `DataTable`/`FormDrawer`/`KpiTile`/`PageHeader` signatures match their usages.

**Placeholders:** none — foundation tasks carry full code; screen tasks specify exact files + the compose pattern + the verification gate (full per-screen JSX is intentionally delegated to the implementer following the primitive contracts + the worked template, since this is a restyle composing fixed primitives).
