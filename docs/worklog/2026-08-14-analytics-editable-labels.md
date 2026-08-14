# Renaming a chart label in place, and the two blockers that made it a backend job

**Date:** 2026-08-14
**Area:** analytics-web + api
**Branch / commits:** `main` — `2f76810`, `4b7b6da`, `9a1d8fb`, `9276c44`, `655d556`, `2b22dd2`, and this one
**Status:** **built and verified locally; NOT deployed.** The api half is live but nothing calls it yet.

## Goal

Amir pointed at a chart's `<h3>` title and its legend text and asked to edit them in place, with a
pencil, and save. Two decisions he made up front:

- **report title + series label.** Not axis titles, not dashboard widget titles.
- **one label per language.** You edit in whichever language the app is in; Persian and English keep
  their own text; anything not typed falls back to the automatic name.

Planned in [`docs/design/2026-08-14-inline-editable-labels.md`](../design/2026-08-14-inline-editable-labels.md)
and built as its seven steps.

## Root cause of the shape: two blockers, both verified before writing code

This looked like a frontend change and was not.

**1. There was no update endpoint.** `Reports.cs` mapped four routes — none of them PUT or PATCH — and
`SaveReportCommandHandler` called `Add(report)` unconditionally, ignoring the definition's id. A
pencil-save built on that path would have **created a second report** and left the first named as it
was. Dashboards had the identical bug and already fixed it; the comment in `SaveDashboard` still reads
*"the old always-Add duplicated the dashboard on every save"*.

**2. The backend DTO threw labels away, on both legs.** `ReportColumnDto` carried only `Field`;
`ReportMetricDto` had no `label` at all. The strip happened on write (`SaveReport.cs`) *and* on read
(`GetReports.cs`), so a label stored in the definition would have worked perfectly against the mock
API — localStorage keeps whole objects — and **silently vanished in production**. Same class of
failure as a build that looks green and ships nothing.

## What changed

**Backend (step 1)**
- `Commands/UpdateReport/` **(new)** — `PUT /api/Reports/{id}`, tenant-scoped, `Guard.Against.NotFound`.
  No `Name` on the request: the name is stored twice (the `AnalyticsReport.Name` column *and* inside
  `DefinitionJson`), so taking only the definition makes drift structurally impossible.
- `ReportDefinitionDto` — `titleOverrides`, `labelOverrides`, and `LocalizedLabelDto`
  (`{ "fa-IR", "en-US" }`, both optional).

**Contract and resolution (step 2)**
- `contracts/report-definition.ts` — the same two fields plus `LocalizedLabel`.
- `presentation/labels.ts` — `useColumnLabel`'s body became a pure
  `resolveColumnLabel(def, result, key, locale, t)`; the hook is a thin wrapper. Exports are plain
  functions and cannot call a hook, which is the whole reason the non-hook form exists.

**The control (step 3)**
- `components/ui/EditableLabel.tsx` **(new)** — antd `Typography` plus everything antd does not do:
  controlled `editing` held open across the save, `SaveButton`'s spinner→tick→idle convention,
  revert-on-error, a string `tooltip` so the pencil keeps a name.

**Wiring (steps 4–5)**
- `PageHeader` gained `titleNode`; `ReportViewer` renames the title into `titleOverrides[locale]`.
- `features/viewer/SeriesLabelBar.tsx` **(new)** — the series pencils, beside the chart.
- `presentation/series-keys.ts` **(new)** — `seriesKeysOf`, shared with `RechartsRenderer`.
- `api/queries.ts` — `useUpdateReport`, invalidating the single report **and** the list.

**Permissions (step 6)**
- `features/viewer/can-edit.ts` **(new)** — `canEditReports`, `canRenameSeries`.

**The rest of the label chain (step 7)**
- `features/export/useExportResult.ts` **(new)** — resolves `columns[].label` once at the export
  boundary, so CSV / Excel / PDF stop disagreeing with the screen. Used at all five export call sites.
- `KpiRenderer` — was reading the engine's `col.label`, so a renamed metric still read `sum_amount` on
  a KPI tile.

## Decisions

- **A new field, not `metric.label`.** The AI writes a Persian `label` onto *every* report it
  generates (`ai/rules.ts`), so promoting a stored label above the composed name would show Persian to
  an English reader again — the exact bug `labels.ts` was written to prevent, pinned by a test.
  Human overrides need their own field so "a machine guessed" and "a human typed" stay separable.
- **The override is checked above the metric branch.** Composition returns as soon as it has an
  aggregation word and a field label — including for `aggregation: "none"`, since `t("agg.none")` is
  "None"/«بدون» rather than empty. Placed beside `metric.label` it never fires for the common case;
  moving it there fails 5 tests.
- **The series control sits beside the chart, not on the legend.** ECharts draws its legend into a
  **canvas** — there is no element to mount an editor into at any price. On the legend you would get
  renameable bar charts and un-renameable heatmaps, decided by which library drew them.
- **Not gated on `reports:write`.** `PowerUser` and `DashboardDesigner` both hold it and the editor
  route admits neither, so gating on the permission would render controls the routes refuse.
- **The «ویرایش در Ask AI» button was left on its old, wider rule** — against what the design doc
  said. Checking the router showed that button goes to `/ask`, which has **no role guard at all**, so
  narrowing it would remove an existing affordance from `PowerUser` rather than fix a mismatch.
  Renaming is new and gets the strict rule. A test pins the split.
- **No renaming while drilled down.** A drill-down child is built on the fly and never saved, so the
  override lands on the *parent* — under the child's column keys when the drilldown uses a
  `targetDefinition`, which is a different report. A rename that reports success and changes nothing.
- **Labels resolved at the export boundary, not inside the exporters.** Keeps three signatures alone
  and, more usefully, keeps the rule in one place instead of three.

## Verified

- **538 front-end tests** (up from 484 at the start of the day), lint, typecheck and build clean.
  445 backend unit tests, 12 new, built on the server (NuGet is blocked locally).
- **Every new guard was made to fail first.** The most useful were:
  - override placed beside `metric.label` → 5 failures
  - `inFlight` guard removed → *"expected 1 times, but got 2 times"* (a double PUT)
  - `rk.report(id)` invalidation dropped → the viewer goes stale
  - rename written to `name` instead of `titleOverrides` → 2 failures
  - export resolution bypassed → *"expected 'استان,sum_amount' to contain 'فروش خالص'"*
- **Backend checked against the running container**, not the source: `PUT /api/Reports/1` → **401**
  (registered, needs auth) while POST/GET/DELETE on that path → **405**; previously no route existed
  there. All four new symbols present in the shipped `Mabhas19.Application.dll`.
- **End to end in a real browser**, twice: renamed the title (heading changed, `titleOverrides["fa-IR"]`
  stored, `name` untouched, survived a reload); renamed a series (**the chart's own legend** read
  «فروش خالص استانی», `metrics[0].label` untouched). Switching to English gave the automatic
  "Sum Revenue", not the Persian.
- Pencil hit area measured **44×44** at 375px, no horizontal scroll.

**Not verified — read before relying on it:**

- **Pressing Enter to save has never been exercised by a real keypress.** user-event delivers
  `keyCode: 0` and antd requires 13; the in-app browser delivered **zero** key events to a focused
  textarea. Only the blur / click-away path is proven. It ought to work — browsers do populate
  `keyCode` — but that is an inference.
- **The tooltip is inferred, not observed.** recharts takes the legend and tooltip from one `name`
  prop and the legend was verified; no tooltip was hovered (that needs compositing frames the
  preview pane does not give).
- **Nothing has been through the real API.** Both sides assert the same JSON keys independently, but
  they have never shaken hands — no auth token available. This is the largest remaining gap.
- The drill-down guard cannot be reached from a test (recharts draws nothing in jsdom, so there is no
  datum to click). It is covered as a named predicate instead of an inline `&&`.

## Follow-ups

- **Deploy `analytics-web`,** then on production: rename a title and a series, reload, check the
  library list reflects the title, and **press Enter** rather than clicking away.
- The mock user defaults to `["PowerUser"]`, so **the pencil is invisible in local dev** until the mock
  role is switched to `ReportDesigner`. Worth knowing before someone reports it as broken.
- **The library's «ویرایش» is a dead link.** It navigates to `/ask?from=<id>` and nothing reads
  `?from=` — `useAskAi` has no `useSearchParams` and starts at `phase: "hero"`. So "Edit" drops you at
  a blank prompt and loses the report. Found while planning; not fixed.
- `useSaveReport` still invalidates only the list, not `rk.report(id)`. Harmless today because it is
  only reached from the Ask-AI save modal, which navigates away — but it is the same bug
  `useUpdateReport` had to avoid.
- Axis titles and dashboard widget titles were deliberately out of scope.
