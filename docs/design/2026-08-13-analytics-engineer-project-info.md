# Design: «اطلاعات پروژه‌ای مهندسان» in the Ask-AI dataset picker

**Date:** 2026-08-13
**Status:** steps 1–3 done (رفاهی hidden; renamed + dictionaries; chips + the two engine pieces);
step 4 (deploy) open
**Area:** `analytics-web` (picker + chips) and `src/Infrastructure/Analytics/Sql` (semantic store)

## Where the dropdown gets its list

The picker on `/ask` is `PromptHero.tsx`, and its options come from **`listSemanticModels()`** in
[`analytics-web/src/semantic/registry.ts`](../../analytics-web/src/semantic/registry.ts).

It is **not** an API call. The list is bundled into the front end at build time, and which list you
get depends on the build flag:

| `VITE_USE_MOCK_API` | picker shows |
| --- | --- |
| `"false"` (production) | `model-oz-info`, `model-engineer-projects`, and the three رفاهی models |
| anything else (local dev) | the three sample models: sales, projects, finance |

The front-end file is a **mirror**. The authoritative copies are the backend stores —
`KurdNezamSemanticModelStore.cs` and `WalfareSemanticModelStore.cs` — which is what the AI is
grounded on and what turns a request into SQL. The comment at the top of the mirror says it plainly:
ids, sources and fields **must** match the backend. So every change here is two files, not one.

The chips under the box are separate: `REAL_EXAMPLE_PROMPTS` in
[`analytics-web/src/ai/examples.ts`](../../analytics-web/src/ai/examples.ts), filtered by the
selected dataset.

## What I found before designing anything

**The table already exists, and is already connected.** I read the schema straight from the
KurdNezam database:

```
tblDW_EngineerProjectInfo
Id, ProjectNo, Ozviat, TypEng, Meter, IsHogh, IsErja, IsHal,
RegDate, TypProject, CityId, MeterFull, HasPayan, ExitTyp, IsAfza
```

`KurdNezamSemanticModelStore.cs` already maps `engineer_projects → tblDW_EngineerProjectInfo` and
already exposes all fourteen of those columns, under the name **«کارکرد پروژه‌ای مهندسان»**.

So **no table needs adding**. Three of the names in the request are near-misses on names that are
already right in the code:

| in the request | real column |
| --- | --- |
| `TypeEng` | **`TypEng`** |
| `ReqDate` | **`RegDate`** |
| `TypeProject` | **`TypProject`** |

**What is actually missing is the dictionaries.** `TypEng`, `TypProject` and `CityId` have no
`ValueLabels` — their description just says «کد داخلی سازمان». That is exactly why reports come back
showing `4` instead of «مسکن ملی». `table-info-2.txt` supplies all three of those dictionaries. This
is the real work.

## The one decision

The request asks for a **new** dataset «اطلاعات پروژه‌ای مهندسان», but the dataset it describes is the
one already on screen under a different name, over the same table, with the same fields.

**Decided (2026-08-13): rename and enrich the existing model, do not add a second one.**

- One dataset per table. Two models over `tblDW_EngineerProjectInfo` with different labels would give
  the AI two ways to answer the same question, and the picker two entries that look different but are
  not.
- The entity `source` stays `engineer_projects`, so saved reports and dashboard widgets that already
  point at it keep working. Only the display name changes.
- The three existing chips for this dataset stay valid.

The alternative — a genuinely separate second model — was considered and turned down: it would leave
two entries in the picker over one table.

After this, the picker holds **two** datasets: «اعضا و پروانه‌ها» and «اطلاعات پروژه‌ای مهندسان».

## What changes

### 1. Hide the three رفاهی datasets

`رزروهای سامانه رفاهی`, `پرداخت‌های سامانه رفاهی`, `استخرها و سانس‌های رفاهی` come off the picker.

Hidden, not deleted — the request says they come back later. One named list in `registry.ts`:

```ts
/** Off the picker for now, by request. Delete a line here to bring one back. */
const HIDDEN_MODEL_IDS = new Set([
  "model-walfare-reservations", "model-walfare-payments", "model-walfare-pools",
]);
```

`listSemanticModels()` filters on it, and their chips drop out of `REAL_EXAMPLE_PROMPTS`. The models
themselves, both mirror and backend, are left completely alone — bringing them back is deleting three
strings.

### 2. The dictionaries

Added as `ValueLabels` on the backend (which is what makes the *output* show words) **and** written
into each field's `Description` (which is what the AI reads to understand a request):

- **`TypEng`** — «صلاحیت مهندس»: 1 طراح معماری, 2 طراح سازه, 3 طراح برق, 4 طراح مکانیک,
  5 ناظر معماری, 6 ناظر عمران, 7 ناظر برق, 8 ناظر مکانیک, 9 ناظر هماهنگ‌کننده, 11 ناظر نقشه‌برداری
- **`TypProject`** — «نوع پروژه»: 0 و 1 عادی, 2 صنعتی, 4 مسکن ملی, 5 بافت فرسوده,
  6 تخفیف همکار پروانه‌دار, 7 روستایی, 8 زیر ۲۰ هزار نفر, 10 مساجد و اماکن خیریه,
  11 مسکن ملی-سایت متمرکز, 12 خانه باغ, 15 بازسازی ساختمان جنگ تحمیلی
- **`CityId`** — «شهر»: 1 بانه, 2 سنندج (مرکزی), 18 کامیاران, 19 قروه, 20 سقز, 21 دهگلان,
  22 مریوان, 23 دیواندره, 25 بیجار

Wording corrected on the fields where the request gives a better meaning than the code has today:

| field | today | becomes |
| --- | --- | --- |
| `Meter` | «متراژ» | «متراژ درگیر در ظرفیت مهندس» |
| `MeterFull` | «متراژ کل» | «متراژ کل پروژه» |
| `RegDate` | «تاریخ ثبت» | «تاریخ درج در ظرفیت» |
| `TypEng` | «نوع خدمت» | «صلاحیت مهندس» |
| `IsAfza` | 1 «افزایش بنا» | 1 «توسعه بنا», 0 «عادی» |

`IsErja` also gains the rule from the request, as description text the AI can use: not ارجاعی means
the engineer's صلاحیت is a طراح one; ارجاعی means it is a ناظر one.

### 3. The three chips

| # | chip | prompt |
| --- | --- | --- |
| 1 | دسته‌بندی نوع پروژه‌ها ۱۴۰۵ | تعداد و درصد پروژه‌ها به تفکیک نوع پروژه در سال ۱۴۰۵ |
| 2 | متر کار: عادی و توسعه بنا | مجموع متراژ درگیر در ظرفیت به تفکیک عادی یا توسعه بنا در سال جاری |
| 3 | متراژ ظرفیت × صلاحیت | مجموع متراژ درگیر در ظرفیت به تفکیک صلاحیت مهندس، فقط صلاحیت ۱ تا ۸ |

**Filtering by year works.** `RegDate` is `nvarchar` and **every value has the same shape** —
`1405/03/17` — confirmed by the request. Because the format is fixed-width, `between '1405/01/01'`
and `'1405/12/30'` sorts correctly as text and is exact. The engine supports `between`, so no new
operator is needed. (`contains` also exists and maps to `LIKE %…%`; `between` is the honest one for a
year, and it can use an index.)

## What could go wrong

- **`TypProject` has two codes for «عادی» — 0 and 1.** Confirmed by the request: both mean عادی.
  Grouping by it in report 1 gives *two* rows both labelled عادی, which looks like a bug to the
  reader. They must be merged, and `ValueLabels` cannot do it — that map is applied *after* SQL, for
  display only, so it renames rows but never combines them. The merge has to happen where the
  grouping does.

  Built as `EquivalentCodes` on a semantic field: `{"0": "1"}` on `TypProject` makes the GROUP BY
  read `CASE WHEN [TypProject] = 0 THEN 1 ELSE [TypProject] END`, so عادی is one row with one count
  and one percentage. Opt-in per field — a `CASE` in every GROUP BY would cost index use everywhere
  for nothing. Both sides are parsed as integers before they are written into the SQL.
- **"چند درصد" — the method is settled.** Divide each group's count by the grand total.

  Built as `percentOfTotal`, a new aggregation: `COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)`.
  `SUM(COUNT(*)) OVER ()` is the same number a separate `SELECT COUNT(*)` would return, but read in
  the one pass, so the parts and the total can never disagree. On a measure it becomes a share of
  metres rather than of rows.

  **The denominator is the filtered set, not the whole table.** For «نوع پروژه‌ها در ۱۴۰۵» that means
  each type's share *of 1405*, and the column adds up to 100. Dividing by the whole table instead
  would give percentages that sum to however much of history 1405 happens to be — true, but not what
  «چند درصد پروژه‌ها عادی بوده» asks. **Say so if you meant share-of-all-time** and it is a one-line
  change.

  It also survives paging: the window runs before `OFFSET/FETCH`, so page 2 still shows shares of the
  real total.
- **Two files must move together.** Changing only the front-end mirror makes the picker show a name
  the AI does not know; changing only the backend leaves the picker stale. Both, every time.
- **.NET builds run on the server** — NuGet is blocked locally, so step 2 cannot be verified on this
  machine.
- **Row counts unverified.** The permission classifier blocked the data-profiling query, so I know the
  table's shape but not how many rows are in 1405 or which project types actually appear. Worth one
  look before trusting chip 1's output.

## Steps

| Step | What |
| --- | --- |
| 1 | Hide the three رفاهی datasets and their chips (front end only, easy to undo) |
| 2 | Rename to «اطلاعات پروژه‌ای مهندسان» and add the dictionaries — backend store + front-end mirror |
| 3 | The three chips, checked against real output on `/ask`. Also reword the three chips this dataset already has — they still say «متراژ کارکرد», which is now «متراژ درگیر در ظرفیت» |
| 4 | Tests, build, deploy, worklog |

Step 1 first because it has no open question in it and can ship alone.
