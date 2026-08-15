# Custom reports, and the first one: engineer quota by city and discipline

**Status:** **DONE — all eight steps.** Branch `feat/custom-reports`, not merged, **not deployed**
(the endpoint does not exist yet). Worklog: `docs/worklog/2026-08-15-custom-reports-engineer-quota.md`. Step 4's real-mode switch shipped inside step 1.
**Host:** `analytics-web`. **Scope agreed:** frontend first against a mock row; the .NET endpoint is a
separate follow-up with its contract pinned here (§ *The endpoint contract*).

---

## Why this cannot be an ordinary report

«وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته» is driven by
`[dbo].[F_ShowQuataInCity] @CityId, @Reshte` on **KurdNezam**. Three things put it outside the
analytics engine, and all three are structural rather than missing features:

1. **`SqlQueryEngine.cs` builds `SELECT … FROM [table] … GROUP BY …`** from a `ReportDefinition`.
   Nothing in the analytics path calls a stored procedure — `CommandType.StoredProcedure` appears in
   `Auth/External/KurdNezamDirectory.cs` and `Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs`,
   never in `Infrastructure/Analytics`.
2. **The proc returns one wide row** whose dimension lives in the *column names* — `UsedInTarahi_1`,
   `…_2`, `…_3`, `…_4`. The engine's model is rows × dimensions × measures. There is nothing to group
   by, and no amount of definition-writing produces a pivot the engine does not do.
3. **`@CityId` / `@Reshte` are procedure parameters**, not filters over columns.

A fourth, from the requirement itself: the four capacities are a **client-side constant**, explicitly
not from SQL and not user-editable.

**This also settles "can AI create this report".** Ask AI emits `ReportDefinition`s for that same
engine, so it can only ever produce what the engine can already express. No prompt reaches a stored
procedure.

## The shape of the answer

A registered **custom report**: an escape hatch for reports whose data or presentation the
dimensional engine cannot describe, integrated into the *existing* report shell rather than parked
beside it.

`ViewLibrary` already reads `"antd" | "recharts" | "echarts" | "grid"`, and **`"grid"` is declared and
implemented nowhere** — the union was built to be extended. `ReportView.tsx` already dispatches on
`view.library`. That is the extension point.

The rejected alternative was a parallel `/reports/custom/:id` world with its own page and widget type.
Conceptually cleaner — no envelope definitions, no branches in shared files — but the report library,
favourites, permissions, export, the widget picker and the breadcrumb would each have to learn that
there are two kinds of report, and that tax is paid again for every custom report after this one.
With "first of several" as the answer, it is the more expensive path.

---

## The registry

One module owns the set. An entry declares what it is, how it is parameterised, where its data comes
from, and how it draws:

```ts
interface CustomReport<P, D> {
  id: string;                                    // "engineer-quota"
  title: LocalizedText;
  params: ParamSpec[];                           // { key, label, options[] } — drives the picker bar
  defaults: P;
  fetch(params: P): Promise<D>;                  // mock row now, endpoint later
  Component: ComponentType<{ data: D; params: P }>;
}
```

`fetch` sits on the **entry**, not in the component: the presentation component only renders supplied
data, so it can be tested with a literal and never reaches for a network. `params` is declared rather
than hand-built, so the next custom report gets its filter bar by describing it.

The saved definition is a thin envelope:

```ts
{ type: "chart", library: "custom", component: "EngineerQuota", options: { cityId: 25, reshte: 4 } }
```

Parameters go in **`options`**, not `mapping`. `ViewMapping` is a fixed set of named chart bindings
(`x`, `y`, `series`, `category`, `measure`) with no index signature; putting `cityId` there would mean
widening it with `[key: string]: unknown` and weakening the typing of every chart in the app to
accommodate one report. `options` is already `Record<string, unknown>` and documented as
renderer-specific. (Corrected during step 1 — the design first said `mapping`.)

`dataset`, `groupBy` and `metrics` carry nothing meaningful on a custom report. That is a real wart,
and it is the price of reusing the shell — no worse than `library: "recharts"` on a chart ECharts
draws, which the codebase already lives with, and unlike that one it is load-bearing rather than
legacy.

### An unknown component renders an empty state

When `view.component` names something not in the registry, the renderer shows an explicit empty state.
The codebase's own precedent (`chartKind`) silently defaults to a bar — deliberately, because a stored
view naming an unknown *chart* still has a sensible chart to fall back to. Here there is nothing to
fall back to, and a silent fallback would hide a typo'd or deleted registry id behind a plausible
screen. Decided, not inherited.

---

## The quota report

### Field mapping — do not swap these

| Base | Title | Design used | Supervision used | Engineers |
| --- | --- | --- | --- | --- |
| 4 | پایه ارشد | `UsedInTarahi_4` | `UsedInNezart_4` | `CntEngin_4` |
| 1 | پایه یک | `UsedInTarahi_1` | `UsedInNezart_1` | `CntEngin_1` |
| 2 | پایه دو | `UsedInTarahi_2` | `UsedInNezart_2` | `CntEngin_2` |
| 3 | پایه سه | `UsedInTarahi_3` | `UsedInNezart_3` | `CntEngin_3` |

Display order is **ارشد، یک، دو، سه** — base 4 first. Note that this is neither numeric nor the order
the proc returns its columns in; it is the order the reference screenshot uses, and it is the reason
`BASE_CONFIG` is an ordered array rather than a map keyed by base number.

### Capacity and arithmetic

```ts
const BASE_CAPACITY = { 4: 20_000, 1: 160_000, 2: 72_000, 3: 48_000 } as const;
```

Fixed, frozen, identical for every city and discipline. Not from SQL, not from the API, not editable.

```
used      = designUsed + supervisionUsed
remaining = Math.max(total - used, 0)
```

The clamp is not decoration: the proc can report more consumed than the constant allows, and a
negative slice would render as a nonsense ring.

Generated from one `BASE_CONFIG` array, not four copies of the same arithmetic.

### The four models, from the sample row

Row supplied for the mock:

```
UsedInTarahi_4=2357.45  UsedInNezart_4=0        CntEngin_4=2
UsedInTarahi_1=9034.42  UsedInNezart_1=1111.56  CntEngin_1=16
UsedInTarahi_2=6362.96  UsedInNezart_2=2617.29  CntEngin_2=21
UsedInTarahi_3=2348.91  UsedInNezart_3=9405.64  CntEngin_3=55
```

which must produce exactly:

| Base | Used | Total | Remaining | Engineers |
| --- | --- | --- | --- | --- |
| پایه ارشد | 2 357.45 | 20 000 | **17 642.55** | 2 |
| پایه یک | 10 145.98 | 160 000 | **149 854.02** | 16 |
| پایه دو | 8 980.25 | 72 000 | **63 019.75** | 21 |
| پایه سه | 11 754.55 | 48 000 | **36 245.45** | 55 |

These are the unit-test fixtures. (The worked example in the brief and the numbers in the screenshot
are two *other* city/discipline combinations — all three are internally consistent; none of them
contradict each other.)

### Table

Six columns, matching the screenshot, right to left:
پایه · متراژ ثبت شده در طراحی · متراژ ثبت شده در نظارت · تعداد مهندس · ظرفیت باقی‌مانده · ظرفیت کل.

The city and discipline names appear in the *column headers* in the reference («… رشته (مکانیک)»,
«… در شهر (بیجار)»), so the headers are composed from the selected parameters, not static strings.

### Donuts

Four, below the table, same order. Two slices only — «ظرفیت مصرفی» and «ظرفیت باقی‌مانده». Design and
supervision are **combined**; they are not separate slices. Engineer count is metadata, never a slice.

A small `QuotaDonut` built on `useEChart` directly, the way `admin/ai/usage/AIUsageCost.tsx` and
`admin/audit/AuditCostChart.tsx` already do. Reusing `EChartsRenderer`'s pie branch would mean
fabricating a `QueryResult` and a `ReportView` per donut, which is more contortion than ~40 lines of
option. `radius: ['55%','78%']`, `itemStyle: { borderColor: '#fff', borderWidth: 2 }` per the brief —
but the **colours come from the theme** (`chartColors(themeMode).series`), not hardcoded green, or the
report will be the one page in the product wearing a different palette.

### Accessibility, and why this report needs no hidden table

Four canvases would be four holes in the accessibility tree — the exact defect fixed in
`2026-08-15-chart-canvas-accessibility.md`, since `QuotaDonut` does not inherit `EChartsRenderer`'s
hidden data table.

**This report does not need one:** the table above the donuts already carries the same numbers as
text, and it is a real `<table>`. So the donuts are `aria-hidden` and the visible table is their text
alternative.

That reasoning holds *only because this report shows both*. A future custom report that draws a chart
without a table beside it must carry its own text alternative — written down here so the exemption is
not inherited by accident.

---

## The endpoint contract

The `fetch` sits behind the same `VITE_USE_MOCK_API` gate `executeApi.ts` uses, so switching to real
data is one branch. What the backend must implement:

```
POST /api/Reports/custom/engineer-quota
  request   { "cityId": 25, "reshte": 4 }
  response  { "usedInTarahi_4": 2357.45, "usedInNezart_4": 0,    "cntEngin_4": 2,
              "usedInTarahi_1": 9034.42, "usedInNezart_1": 1111.56, "cntEngin_1": 16,
              "usedInTarahi_2": 6362.96, "usedInNezart_2": 2617.29, "cntEngin_2": 21,
              "usedInTarahi_3": 2348.91, "usedInNezart_3": 9405.64, "cntEngin_3": 55 }
```

Twelve numbers, camelCase (matching how `executeApi` already maps backend payloads), one flat object.
It EXECs `[dbo].[F_ShowQuataInCity]` with the two parameters. **No capacities in the response** — they
are a client constant by requirement, and returning them would create a second source of truth.

Authorisation should match the existing report-execute endpoint; the proc reads membership data.

## Parameters

Hardcoded typed constants, as agreed — no extra endpoint, consistent with the fixed capacities.

**Cities:** 1 بانه · 2 سنندج (مرکزی) · 18 کامیاران · 19 قروه · 20 سقز · 21 دهگلان · 22 مریوان ·
23 دیواندره · 25 بیجار
**Disciplines:** 1 معماری · 2 شهرسازی · 3 عمران · 4 مکانیک · 5 برق · 6 نقشه‌برداری · 7 ترافیک

The id gaps (no 3–17, no 24) are the database's, carried verbatim rather than tidied.

---

## Steps

Each step ends green — tests, lint, typecheck, build — and is committed on its own.

### Step 1 — The plumbing, visible end to end

`ViewLibrary` gains `"custom"`. New `presentation/custom/registry.ts` (the interface plus an empty
map) and `CustomRenderer`, dispatched from `ReportView.tsx`. A **stub entry** that renders its own
params so the path can be seen. `ReportViewer`'s execute effect gets its skip branch, and the report
is seeded so it has a URL.

The branch must sit **before** the `!semantic` guard (`ReportViewer.tsx:111`). `semantic` is
`getModelForDataset(data.definition.dataset)` **wrapped in a `try/catch` that returns `undefined`**
(`:79-86`), and a custom report has no real dataset — so a branch placed after that guard produces a
blank page with no error and nothing in the console. Verified by reading it, not assumed.

**Proof:** the seeded custom report opens on a URL and draws the stub; `executeReport` is never
called for it; an unknown `component` shows the empty state, not a chart.
**Risk:** the shared branch. A mistake here breaks *ordinary* reports, so the existing viewer tests
are the guard.

### Step 2 — The params bar

Generic, driven by `ParamSpec`: two selects and a «نمایش» button. Persian labels, RTL, keyboard
reachable.

**Proof:** changing a param refetches with the new arguments and does not refetch on every keystroke.

### Step 3 — The quota arithmetic

`BASE_CONFIG`, `BASE_CAPACITY`, and the model builder. Pure functions, no React.

**Proof:** the four-row fixture table above, asserted exactly. Plus the clamp: consumption over
capacity yields `0`, never a negative. Bite-check by swapping two field names — the test must fail.

### Step 4 — The mock fetch and the real-mode switch

The entry's `fetch`, gated on `VITE_USE_MOCK_API`, returning the sample row in mock mode and calling
the contract above in real mode.

**Proof:** mock mode resolves the row; real mode issues the documented POST (asserted against a
stubbed client). Nothing is deployed until the endpoint exists.

### Step 5 — `QuotaDonut`

One donut, `useEChart`, theme palette, two slices, `aria-hidden`.

**Proof:** read off a live instance — two data points, `used` and `remaining` and *not* design and
supervision; radius is a two-element array; colours equal `chartColors(mode).series`. Both themes.

### Step 6 — The report component

Table plus four donuts, in order, registered in place of the stub. Headers composed from the selected
city and discipline.

**Proof:** the fixture row renders four rows and four donuts in the order ارشد، یک، دو، سه; the table
totals match the donut slices; a browser pass against the reference screenshot.

### Step 7 — The dashboard widget

`WidgetFrame` gets the same skip branch, so a custom report can be pinned to a dashboard.

**Proof:** a seeded widget renders the report inside a widget frame; ordinary widgets are unaffected.
**Risk:** second shared-file branch; the dashboard tests are the guard.

### Step 8 — Polish and record

RTL and LTR, light and dark, 375px. Confirm the accessibility reasoning holds in the tree: donuts
absent, table present. Worklog, and propagate to `GOTCHAS.md` / `PROJECT-MAP.md`.

---

## Open questions, deliberately unanswered

- **Who may see it.** The proc reads membership data across a city. The report inherits whatever the
  report shell enforces; if it needs to be narrower than an ordinary report, that is a decision for
  when the endpoint is built, not a frontend guess.
- **Export.** The toolbar's PDF/CSV export assumes a `QueryResult`. A custom report has none, so
  export will be inert unless it is given something. Left inert in step 1–8 rather than half-wired;
  the export button's behaviour on a custom report should be settled explicitly.
- **Whether `"grid"` should be removed** from `ViewLibrary` while adding `"custom"`. It is dead today.
  Out of scope here, worth its own line in a sweep.

---

## Step 1 — DONE. The plumbing, and a wrong prediction worth keeping.

`ViewLibrary` gains `"custom"`; `ReportView.tsx` gains one case; `presentation/custom/` holds the
registry, the renderer, and the engineer-quota module split four ways — `contract.ts` (params, wire
shape, the city and discipline lists), `fetch.ts` (the mock row and the real-mode call),
`EngineerQuotaReport.tsx` (a placeholder body), `index.tsx` (registration only). Step 6 rewrites one
of those four files and nothing else.

Seeded as `rep-quota`, so it has a URL and the whole path can be walked.

### The design said "one branch in `ReportViewer`". It was four.

Each failed differently, and each was found only by looking at the screen:

| where | what it did |
| --- | --- |
| the execute effect | predicted — skips `executeReport`, before the `!semantic` guard |
| the **render** guard (`:263`) | «خطا در بارگذاری گزارش» — `!semantic` is checked *twice*, far apart |
| `result.total === 0` | «هیچ داده‌ای با فیلترهای فعلی مطابقت ندارد» — the most misleading of the three, because it looks like working software |
| `FilterBar` + `ViewSwitcher` | render nothing for a custom report — see below |

The lesson to carry into **step 7**: `WidgetFrame` will not be one branch either. Budget for finding
its equivalents by running it, not by reading it.

### Two controls removed rather than left

`FilterBar` renders `definition.filters` against a semantic model; a custom report has neither, and
its parameters are procedure arguments with their own picker (step 2).

The `ViewSwitcher` was worse. A custom report has exactly one view and an empty result, so four
buttons rendered disabled and **«جدول» rendered enabled** — one click from replacing a working report
with an empty table. Hidden entirely.

### `any` avoided in the registry

The registry is heterogeneous, so what it stores cannot be typed precisely. Rather than `any` at
three lookups, there is one named `ErasedCustomReport` and **one cast**, inside
`registerCustomReport`, where each entry's real types have just been checked. React props are
contravariant, so the cast is not a formality — it states something the type system genuinely cannot.

### Verified

**685 tests across 85 files** (up from 677), lint, typecheck and build clean. Eight new: five on the
renderer (dispatch, the entry's own fetch, stored params winning over defaults, undeclared keys being
dropped, and the unknown-component empty state) and three on the viewer. Removing the execute skip
fails all three viewer tests.

In a browser: the report opens on its URL, the shell is intact around it, the stub shows
«بیجار — مکانیک» and the mock row, and there are **zero console errors** on a clean tab.

### What is left

Steps 2-8. Nothing about the plumbing is expected to change again; step 6 replaces the placeholder
body, and step 7 does for `WidgetFrame` what this step did for `ReportViewer`.

---

## Step 2 — DONE. The picker bar.

Generic, driven by the entry's `ParamSpec[]`, so the next custom report gets its filters by declaring
them. Rendered as a `Toolbar` flex row like `FilterBar`, and placed **above** the loading and error
branches rather than below them — under the error branch a failed call would leave an empty state
with no way to pick a different city and retry, and the controls would jump on and off screen on
every apply.

### A draft, promoted by «نمایش»

Each apply is a stored-procedure call. Live selects would fire one query per dropdown touched and
throw away every result but the last, so the selects edit a local draft and only the button promotes
it. The reference UI has the same button for the same reason.

Seen on the page: switching منطقه to «سنندج (مرکزی)» left the report reading «بیجار — مکانیک»; pressing
«نمایش» changed it. Reverting to live selects fails *does NOT refetch while a selection is being
made*.

The button stays **enabled** when nothing has changed. It is a submit control doing what it says —
re-run with what is selected — and unlike the `advancedECharts` toggle removed in the ECharts work,
it does not promise a capability that is missing. Disabling it on first load, when the draft
necessarily equals the defaults, would read as broken.

### The accessible name had to be added by hand

antd's `Select` carries no accessible name of its own, so the visible «رشته:» / «منطقه:» text is
tied to it with `aria-labelledby`. Removing that line fails *names each select for a screen reader* —
the
guard exists because nothing about the component looks wrong without it.

### Verified

**690 tests across 85 files** (up from 685), lint, typecheck and build clean. Five new; two
bite-checked by reverting.

In a browser: RTL order matches the reference (رشته, then منطقه, then the button), all nine cities in
the declared order, no console errors beyond the pre-existing antd/React-19 warning. At 375px the bar
wraps to two rows with no horizontal overflow and a 44px-tall button.

---

## Step 3 — DONE. The arithmetic.

`quota.ts`: `BASE_CAPACITY` (frozen), `BASE_CONFIG` (ordered), `buildQuotaModels`. Pure — no React,
no formatting, no ECharts — so the part where correctness is actually decided can be read as what it
is: four subtractions and a clamp.

### The fixtures are exact, and that was checked rather than hoped

The four rows in the design table are asserted with `toBe`, not a tolerance. Before writing them down
the sums were run through node: all four are exact in binary floating point for this row.

**Nothing is rounded.** Where a different row does leave a tail, the display absorbs it —
`Intl.NumberFormat` shows at most three fraction digits, so `149854.01999999998` prints as
«۱۴۹٬۸۵۴.۰۲», also verified rather than assumed. Rounding in the model would make it claim a precision
the arithmetic does not have.

### Two choices that look like verbosity and are not

**The column names are spelled out per base** instead of built as `` `usedInTarahi_${base}` ``. The
template version is shorter and type-checks against nothing: a typo, or a base whose columns are ever
named differently, becomes `undefined` at runtime and draws as zero. Listed, they are checked against
`QuotaRow` by the compiler — and a test asserts the twelve names are distinct, which is the
copy-paste failure four near-identical blocks invite.

**`BASE_CONFIG` is an ordered array, not a map keyed by base.** The display order — ارشد، یک، دو، سه —
is neither numeric nor the procedure's column order, and a map would leave it to whatever key order
the runtime chose.

### Bite-checked, both as the plan specified

- Swapping base 2's supervision field for base 3's fails **three** tests, including the distinct-names
  guard. This is the brief's "do not swap the fields" turned into something that cannot be ignored.
- Removing the clamp fails exactly *never reports a negative remainder*.

A missing or non-numeric field counts as nothing consumed rather than becoming `NaN`, because `NaN`
would be painted across a ring on screen instead of appearing in a log.

### Verified

**701 tests across 86 files** (up from 690), lint, typecheck and build clean. Eleven new. No UI change
in this step — the placeholder still shows the raw row; step 6 is where these models reach the screen.

---

## Steps 4-6 — DONE, and pulled forward. The report is real.

Asked for out of order: the step-1 placeholder was still dumping raw JSON on screen, so the table and
the donuts came before the fetch-gate step. Step 4 turned out to be mostly already done —
`fetch.ts` shipped in step 1 with the mock row, the `VITE_USE_MOCK_API` gate and the endpoint
constant — so what was left was 5 and 6.

### The table

Six columns, headers composed from the selected city and discipline so a printed or exported table
still says what it is about. Values straight from `buildQuotaModels`, so the fixtures in this document
are what reaches the screen — checked in a browser, all four rows.

The reference's note about «پایه» is carried verbatim. It is not decoration: without it the figures
look wrong, because they are per-city and use the highest grade active in *that city*, not the
engineer's grade in general.

### The donuts, and a colour decision the tests now hold

`QuotaDonut` on `useEChart` directly, as the two admin charts already do.

First attempt took `series[0]` and `series[1]` in data order, which put **orange on the majority of
every ring** — a base with 12% consumed looked alarming at a glance. Colour is now assigned by
meaning: remaining is the brand blue, consumed is the accent. Seen on screen before and after; a test
holds it, and reverting to palette order fails that test.

Three other things the brief's sketch did not survive contact with:

- **`borderColor: '#fff'`** verbatim would be a white seam in dark mode. It is the panel colour.
- **No `totalCapacity` prop.** Used + remaining *is* the total, by construction. Taking a third number
  would let a caller pass one that disagrees, and the ring could not say which was right.
- **The base titles stay Persian in English mode** — see the open question below.

### `currentDir` moved to `format.ts`

It was private to `EChartsRenderer` until a second chart needed it. Two copies reading
`document.documentElement.dir` is two places to fix when that answer ever changes.

### The table's width took three attempts, and the first two looked fine

Six columns with long composed headers. What was measured, in order:

1. **No `scroll.x`** — shipped first, and wrong. At 375px the table is 394px wide inside a 287px box
   with `overflow: visible` on every ancestor, so about **107px is clipped and unreachable**; in RTL
   that is «ظرفیت باقی‌مانده» and «ظرفیت کل». It passed the check I ran because the *page* did not
   scroll sideways — which I read as "the table scrolls inside its wrapper". It does not. Nothing
   scrolls. That reading was the mistake, not the code.
2. **`scroll={{ x: "max-content" }}`** — fixes the phone and breaks the desktop: `max-content` stops
   the headers wrapping, so the columns claim their intrinsic width and the table overflows at
   ordinary desktop widths too. It also cost three tests, which was worth knowing on its own —
   with `scroll.x` set, **antd prepends an `aria-hidden` measure row** to `<tbody>`, invisible in a
   screenshot, so the only symptom was the first entry of three assertions silently becoming
   `undefined`. The test helper now excludes it.
3. **`scroll={{ x: 640 }}`** — a min-width. Wider than it, the columns share the space and the headers
   wrap; narrower, `.ant-table-content` becomes a real scrollable ancestor. Verified as such rather
   than inferred: desktop `scrollWidth === clientWidth` (678/678, no scrollbar), phone 640 in a 287
   box with a scrollable ancestor named in the chain, and six cells per row in both.

Not unit-tested: jsdom has no layout, so a test here could only assert that a prop was passed. The
measurement is the evidence, and it is written down here.

### Verified

**711 tests across 87 files** (up from 701), lint, typecheck and build clean. Sixteen new across the
report body and the donuts; the colour-by-meaning and `aria-hidden` decisions both bite when reverted.

In a browser, all four combinations:

| | table | donuts |
| --- | --- | --- |
| RTL light/dark | six columns, Persian digits, values match the fixtures exactly | rings mostly blue with an orange arc, counts in the holes, order ارشد→سه right to left |
| LTR light/dark | English headers with the Persian city and discipline interpolated | mirrored, order left to right |

The accessibility tree carries the whole table — headers and all twenty-four values — and **no chart
nodes at all**, which is the exemption in *Donuts* above working as designed. (`read_page` collapses
some short numeric cells in its own output; the DOM was checked directly and has all six per row.)

At 375px: no page overflow in either direction, the donuts stack, and the table scrolls inside its own
wrapper.

### Open question for the user

**The four base titles — «پایه ارشد», «پایه یک», «پایه دو», «پایه سه» — stay Persian in English mode.**
They sit beside city and discipline names that are Persian-only data, so they are consistent with
their row; but every header around them translates. Rendering "Senior level" / "Level 1" would be
guessing at terminology for the Iranian engineering order's grading system, which is a translation
decision rather than a coding one. Left as-is and raised rather than invented.

---

## Step 7 — DONE. The dashboard widget, and the prediction held.

Step 1's memo said: *"`WidgetFrame` will not be one branch either. Budget for finding its equivalents
by running it, not by reading it."* Reading it found **five**, which is the good outcome — the warning
made me map the file before touching it instead of patching the first failure and re-running:

| where | why |
| --- | --- |
| the `exec` query | nothing to execute; left enabled it runs against a dataset that cannot answer |
| the `views` memo | gated on `exec.data`, so the stored view never arrived |
| `loading` | a **disabled** react-query reports `isLoading` forever, so the card would spin for good |
| the `Segmented` | one view by construction, and «جدول» would sit enabled over a working report |
| CSV / Excel / PDF | all three serialise a `QueryResult`; they would hand over an empty file that looks like a successful export |

`loading` is the one reading would have missed on a first pass and running would have shown as a
permanent spinner — worth naming, because "disabled queries are stuck in `isLoading`" is not obvious
from the call site.

### The duplicated detection is gone

Step 1 left `def.presentation?.views?.[0]?.library === "custom"` written inline. With a second file
asking the same question in several places, it is now `isCustomDefinition` in the registry, and
`EMPTY_RESULT` moved there too — both exist *because* custom reports exist, so that is where they
live.

### Verified

**717 tests across 87 files** (up from 711), lint, typecheck and build clean. Six new. Both
exemptions bite: leaving the query enabled fails *never asks the engine to execute it*, and removing
the `views` line fails all five custom-widget tests.

A seeded widget was added beside the ordinary one, so the dashboard exercises both paths. In a
browser, measured on the widget itself: the custom widget contains the report — **4 table rows, 4
donuts, no error alert, and no export buttons** — while the ordinary widget beside it still has CSV,
Excel and PDF.

### What is NOT verified, and it is not this step's fault

**The widget cannot actually be looked at.** Both widgets render **159×40** on the dashboard —
including the ordinary one, which has nothing to do with this work. That is the pre-existing sizing
bug recorded in `2026-08-14-recharts-to-echarts.md` (a widget laid out `w:6 h:4` rendering 133×40 on
`main`, before any of this). So the widget's *contents* are confirmed by measuring the DOM, and its
*appearance* is not confirmed at all.

Fixing it is a separate task with its own cause, and doing it here would have hidden inside a
custom-reports change. It is now blocking something real, though, which raises its priority.
