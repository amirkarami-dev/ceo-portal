# Inline-editable chart labels on /reports/:id

**Date:** 2026-08-14
**Area:** analytics-web + api
**Status:** **plan only — nothing built.** Waiting on "start step 1".

## Goal

On a report page (e.g. `analytic.myceo.ir/reports/2`), click a pencil, edit a label in place, save it.

Two labels, decided with Amir:

| what | where it is now |
| --- | --- |
| the report **title** | `<h3>` from `PageHeader.tsx:22`, fed by `ReportViewer.tsx:219` `title={data.definition.name}` |
| the chart **series / legend** label | `<span class="recharts-legend-item-text">`, from `useColumnLabel()` in `presentation/labels.ts` |

Not in scope: axis titles, dashboard widget titles.

**Language: one label per language.** You edit in whichever language the app is in; Persian and
English each keep their own text; anything not typed falls back to today's automatic name. This
matches the only per-language shape already in the codebase, `contracts/semantic.ts:30`
`label: { "fa-IR": string; "en-US": string }`.

## How much of this is checked

Four parallel read-only investigations (persistence, label contract, permissions, antd internals),
each reporting file:line. **The critic pass that was meant to find what they missed did not run — it
died on a session limit.** So this plan has no adversarial second opinion. Treat it as well-sourced
but unreviewed, and expect step 1 to turn something up.

---

## Two blockers. This cannot be built on what exists.

### Blocker 1 — there is no update endpoint. Saving a rename would create a duplicate report.

`src/Web/Endpoints/Analytics/Reports.cs:20-23` maps four routes and no more:

```
MapPost(ExecuteReport, "execute");  MapPost(GenerateReportFromPrompt, "generate");
MapGet(GetReports, "");             MapPost(SaveReport, "");
```

No `MapPut`, no `MapPatch`, no `/api/Reports/{id}`. And the handler always inserts —
`SaveReport.cs:36-48` does `new AnalyticsReport { … }; _context.AnalyticsReports.Add(report);`,
never reading `request.Definition.Id` and never querying for an existing row.

**So in real-API mode, a pencil-save built on the existing path renames nothing.** It creates a new
report. The user edits `/reports/2`, gets a new `/reports/57`, and `/reports/2` keeps the old name.
`httpClient` has `put` and `patch` (`httpClient.ts:81-89`) but nothing in `src/api/` calls either for
reports.

### Blocker 2 — the backend DTO throws labels away, on both legs.

`ReportDefinitionDto` (`ReportDefinitionDto.cs:137-176`) carries only id, name, dataset, columns,
filters, groupBy, metrics, sorting, limit, offset, calculatedFields. Missing: `schemaVersion`,
`description`, `tags`, `filterGroup`, `drilldown`, **`presentation`** (which the frontend type marks
required), `meta`.

Worse for this feature specifically:

- `ReportColumnDto` (`:56-60`) has **only `Field`**. `label`, `type`, `format`, `visible`, `width` all dropped.
- `ReportMetricDto` (`:98-109`) has field/aggregation/alias and **no `label`**.

The strip happens **both** on write (`SaveReport.cs:34` serialises the narrowed DTO) and on read
(`GetReports.cs:42` deserialises back into the same narrow DTO). Even hand-written JSON in the
database would be stripped on the way out.

**Consequence:** any label stored in `metric.label`, `ColumnDef.label` or `ReportView.title` will
work perfectly in mock mode — localStorage keeps everything — and **silently vanish in production**.
This is the same class of failure as the palette deploy: it looks green locally and does nothing live.

---

## Four traps that would each pass review

**1. Do not reuse `metric.label`.** The mock AI writes Persian into it on *every* report it
generates — `ai/rules.ts:105` `label: measure.label["fa-IR"]` and `:107` `label: "تعداد"`. Promote
`metric.label` above composition and every AI-made report shows Persian to an English reader again —
exactly the bug the doc comment at `labels.ts:22-24` exists to prevent, and it is pinned by a test
(`labels.test.tsx:53`, "prefers the composed name over a stored one, because a stored one has no
language"). A human override needs its **own** field so "the machine guessed" and "a human typed"
stay distinguishable.

**2. Do not store it in `ColumnDef.label`.** It is read in exactly one place, inside
`engine.ts:424`'s `if (!def.groupBy?.length && !def.metrics?.length)` branch. A grouped, aggregated
report — which `/reports/2` is, and which is the common shape — never reads it. `useColumnLabel`
never reads it at all. It looks like the natural home and would do nothing.

**3. The override must be checked *above* `labels.ts:53`, not inside the `if (metric)` branch.**
The composed branch returns at `:57` before the stored label is consulted at `:58`, and it fires for
any metric over a modelled field — including `aggregation: "none"`, because `t("agg.none")` resolves
to "None" / «بدون» rather than empty. Put the check inside `if (metric)` and it never fires for the
common case.

**4. Renaming the legend will not rename the Excel header.** Exports read the **engine's**
`ResolvedColumn.label` (`engine.ts:416` `push(key, m.label ?? key, …)`), not `useColumnLabel`:
`csv.ts:17`, `xlsx.ts:8`, `pdf.ts:38`, plus `KpiRenderer.tsx:32`, `AskAiBuilder.tsx:34`,
`executeApi.ts:28`. Those are plain functions, not components, so they cannot call a React hook.
**The override has to be resolvable by a non-hook function** — which drives the step 2 refactor below.

Also worth knowing: in recharts the legend text and the tooltip series name are the *same* `name`
prop (`RechartsRenderer.tsx:326`). "Rename the legend but keep the tooltip" is not available without
restructuring the renderer.

---

## What antd gives us, and what it does not

`Typography` `editable` in the installed antd **5.29.3** has exactly 12 options
(`antd/es/typography/Base/index.d.ts:15-29`): `text, editing, icon, tooltip, onStart, onChange,
onCancel, onEnd, maxLength, autoSize, triggerType, enterIcon`.

- **No `loading`, no `onSave`, no error channel, no validation.** `onEditChange` calls your
  `onChange(value)` and then immediately `triggerEdit(false)`, unmounting the textarea before any
  promise can resolve. Our save is a network call, so we must drive `editing` ourselves — it is
  controllable, and that is the only hook available.
- **The element is replaced, not augmented.** `Base/index.js:241-255` returns early in edit mode, so
  the `<h3>` disappears and becomes a `<div>`. Anything doing `getByRole("heading")` or styling
  `h3` breaks the moment the pencil is clicked.
- **The pencil is 14px.** The repo requires 44px on phones (the "Controls on a phone" block in
  `theme/global.css`), and the existing phone CSS does not cover `.ant-typography-edit`. Needs a new
  rule.
- **The pencil's accessible name comes from `tooltip` — and is empty if `tooltip` is a ReactNode.**
  `ariaLabel = typeof editTitle === "string" ? editTitle : ""`. Pass a string, or `tooltip: false`
  (which keeps the locale name «ویرایش» / "Edit").
- **RTL is fine.** Not one physical left/right in the editable path; every offset is logical
  (`insetInlineStart`, `marginInlineStart`), and `ant-typography-rtl` is applied from ConfigProvider.
  One caveat: `enterIcon` is `pointer-events: none` decoration, not a save button, and its arrow is
  not mirrored.

---

## Permissions

There is **no shared predicate for reports**, unlike dashboards which have
`features/dashboards/can-manage.ts:12-20` (`DASHBOARD_MANAGER_ROLES`, `canManageDashboards`,
deliberately mirroring the route allow-list, and tested).

Reports duplicate an inline role array instead, and it disagrees with the router:
`ReportViewer.tsx:175-179` counts `PowerUser` as able to edit, while `router.tsx:63` — the only route
claiming to be the report editor — refuses `PowerUser`. So "just reuse `canEdit`" inherits a flag
that is wrong for two roles and untested.

Ownership is not usable: there is no `def.owner`; `meta.ownerId` exists at
`report-definition.ts:184` and is never read or written anywhere; and the frontend's own save path
returns `ownerName: ""` (`reportsHttpApi.ts:98`).

**Smallest correct rule: `ReportDesigner | TenantAdmin | SuperAdmin`** — the exact set
`router.tsx:63` already admits. Build it as `features/viewer/can-edit.ts` mirroring the dashboards
file, and use it for both the pencil and the existing button.

**Hide the pencil where no save target exists.** `/reports/:id` also renders drill-down children and
Ask-AI results that were never saved; those have no row to update.

---

## Steps

Shippable after each. Nothing user-visible until step 4.

### Step 1 — Backend: an update endpoint, and stop throwing labels away

- `MapPut(UpdateReport, "{id}")` in `Reports.cs`, plus `UpdateReportCommand` that **loads** the row,
  checks tenant, and writes both `AnalyticsReport.Name` **and** the name inside `DefinitionJson`.
  *(The name is stored twice — `SaveReport.cs:40` sets the column, and it is also inside the JSON.
  The frontend reconciles them at read time, `reportsHttpApi.ts:45`
  `name: definition.name?.trim() || b.name`. Write one and they drift.)*
- Widen `ReportDefinitionDto` with the two new override fields (step 2 defines them) so they survive
  the round trip. Do **not** widen it wholesale in this step — `presentation` and friends are a
  separate decision with their own blast radius.
- **Proves it worked:** PUT then GET over the real API returns the changed name *and* the overrides.
  Not a mock-mode test — this is precisely the leg where mock mode lies.
- **Risk:** `.NET builds run on the server` (NuGet is blocked locally), so this step is a server build.

### Step 2 — Contract + one resolver both hooks and plain functions can use

- New types in `contracts/report-definition.ts`:
  ```ts
  export type LocalizedLabel = { "fa-IR"?: string; "en-US"?: string };
  // Human-authored overrides. Absent language falls back to the composed name.
  titleOverrides?: LocalizedLabel;
  labelOverrides?: Record<string, LocalizedLabel>;   // keyed by result column key
  ```
  Separate from `metric.label` on purpose — see trap 1.
- Extract the body of `useColumnLabel` into a **pure** `resolveColumnLabel(def, result, key, locale, t)`
  and make the hook a thin wrapper. Check `labelOverrides[key][locale]` **first** (see trap 3).
- **Proves it worked:** the existing `labels.test.tsx:53` still passes (composition still beats
  `metric.label`), and a new test shows an override beats composition while the *other* language
  still composes.
- **Risk:** none user-visible; nothing writes overrides yet.

### Step 3 — One `<EditableLabel>` component

Wraps antd `Typography` with what antd does not provide: controlled `editing` held open during the
save, the app's existing `SaveButton` phases (idle → saving → tick) for feedback, revert-on-error,
a string `tooltip` so the pencil keeps an accessible name, and a `.ant-typography-edit` rule giving
44px on phones.

- **Proves it worked:** unit tests for save-succeeds, save-fails-and-reverts, cancel, and a phone-width
  measurement of the pencil. Plus a test that a failing save does **not** close the editor.
- **Risk:** the `<h3>`→`<div>` swap breaks `getByRole("heading")` in edit state — assert on the text,
  not the role, and check `PageHeader.test.tsx`.

### Step 4 — Wire the report title

`ReportViewer` passes an `<EditableLabel>` as `PageHeader`'s `title`, saving `titleOverrides[locale]`
via the step 1 PUT. First user-visible step.

- **Proves it worked:** rename on production, reload, still there; switch language and the other
  language still shows the automatic name; check the library list reflects it.
- **Risk:** the name lives in two places server-side. Verify the library list *and* the viewer.

### Step 5 — Wire the series / legend label

An `<EditableLabel>` for the series name. It cannot go inside the recharts legend — that is a
formatter returning a `<span>` — so it belongs beside the chart, in the view's header row, editing
"the label for this series". Saves `labelOverrides[columnKey][locale]`.

- **Proves it worked:** rename, then confirm the legend **and** the tooltip both change (same `name`
  prop), in both renderers and both directions.
- **Risk:** highest-uncertainty step. Where the control lives is a design question this doc does not
  settle — the legend text itself is not a mountable slot.

### Step 6 — Permissions

`features/viewer/can-edit.ts` mirroring the dashboards file, and use it for the pencil *and* the
existing edit button. Hide the pencil for drill-down children and unsaved Ask-AI results.

- **Proves it worked:** a role-parameterised test like `Topbar.test.tsx`'s, covering all five roles.
- **Risk:** this narrows today's `canEdit`, so `PowerUser` loses the existing button. That is a
  deliberate fix of an inconsistency with `router.tsx:63`, but it is user-visible — confirm first.

### Step 7 — Exports, and the rest of the label chain

Point `csv.ts`, `xlsx.ts`, `pdf.ts` at the step 2 pure resolver so a renamed series reaches the
Excel header. Then the worklog and `GOTCHAS.md` propagation.

- **Risk:** exports currently take `result.columns[].label` straight from the engine; threading a
  locale through them is a signature change at several call sites.

## Sizing

| step | size |
| --- | --- |
| 1 backend PUT + DTO | 1 day (server build, real-API verification) |
| 2 contract + resolver | half a day |
| 3 EditableLabel | half a day |
| 4 title | 2–3 hours |
| 5 series label | half a day, plus a design decision |
| 6 permissions | 2–3 hours |
| 7 exports + docs | half a day |

**Roughly 3–4 days**, and it is front-loaded: nothing is visible until step 4, because steps 1–3 are
the parts that stop the feature from being a lie in production.

## Found in passing — a live bug, not part of this feature

The library's ⋮ **«ویرایش»** action (`ReportLibrary.tsx:78`) navigates to `/ask?from=${r.id}`, and
**`?from=` is never read**. `useAskAi` has no `useSearchParams`/`useParams` and starts unconditionally
at `phase: "hero"` (`useAskAi.ts:47`). The viewer's «ویرایش در Ask AI» (`ReportViewer.tsx:206`) does
the same thing. So "Edit" today drops the user at a blank prompt box and loses the report. There is
no load-existing-and-resave flow anywhere.
