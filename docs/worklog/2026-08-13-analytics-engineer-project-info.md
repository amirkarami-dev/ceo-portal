# «اطلاعات پروژه‌ای مهندسان» on the Ask-AI page

**Date:** 2026-08-13
**Area:** `analytics-web` (picker, chips, mirror) and `src/…/Analytics/Sql` (semantic store, query engine)
**Status:** deployed — see the deploy section

## The goal

Three رفاهی datasets off the Ask-AI picker for now, and a dataset for engineers' project
information in their place, with three ready-made reports.
Design doc: [`docs/design/2026-08-13-analytics-engineer-project-info.md`](../design/2026-08-13-analytics-engineer-project-info.md).

## Where the picker's list comes from

Worth writing down, because it is not where you would guess. The options come from
`listSemanticModels()` in `analytics-web/src/semantic/registry.ts` — **bundled into the front end at
build time, not fetched**. Which list you get depends on `VITE_USE_MOCK_API`: `"false"` gives the
real KurdNezam + رفاهی models, anything else gives the three sample ones.

That file is a **mirror**. `KurdNezamSemanticModelStore.cs` and `WalfareSemanticModelStore.cs` are
authoritative — they ground the AI and drive the SQL. **Every model change is two files.** The chips
are a third place: `REAL_EXAMPLE_PROMPTS` in `analytics-web/src/ai/examples.ts`.

## The table was already there

The request asked to add `tblDW_EngineerProjectInfo` to the KurdNezam database. Reading the schema
first showed it already exists, already mapped, and already on the picker as
«کارکرد پروژه‌ای مهندسان»:

```
Id, ProjectNo, Ozviat, TypEng, Meter, IsHogh, IsErja, IsHal,
RegDate, TypProject, CityId, MeterFull, HasPayan, ExitTyp, IsAfza
```

Three names in the request were near-misses on names already correct in the code: `TypeEng` →
`TypEng`, `ReqDate` → `RegDate`, `TypeProject` → `TypProject`.

**So no table was added.** What was missing was the dictionaries — `TypEng`, `TypProject` and
`CityId` had no `ValueLabels`, which is why reports printed `4` instead of «مسکن ملی». Agreed with
Amir: rename and enrich the existing model rather than add a second one over the same table.

**Checking the schema before designing is what turned a database change into a labelling change.**

## What changed

**Step 1 — the three رفاهی datasets came off the picker.** Hidden, not deleted: one
`HIDDEN_MODEL_IDS` set that `listSemanticModels()` filters on. They stay in `semanticModels`, so
`getSemanticModel` and `getModelForDataset` still resolve them and anything already saved against one
still opens. Their chips go too — a chip switches the picker to its own dataset on click, so a chip
for a hidden dataset would strand you somewhere the picker cannot show or leave.

**Step 2 — renamed, and the codes became words.** «اطلاعات پروژه‌ای مهندسان». Each dictionary goes in
two places on purpose: `ValueLabels` decodes the rows after SQL, and the same list goes into
`Description`, which is the text the AI reads to turn a Persian request into codes. One without the
other gives readable output the AI cannot target, or the reverse.

Wording follows the organisation's own words: `TypEng` is «صلاحیت مهندس», `Meter` is «متراژ درگیر در
ظرفیت» (متر کار), `MeterFull` «متراژ کل پروژه», `RegDate` «تاریخ درج در ظرفیت», `IsAfza` reads
توسعه بنا / عادی. The model id and the entity source did **not** change, so saved reports and
dashboard widgets keep working.

**Step 3 — the three reports, and the two engine pieces they needed.** Chips are only prompts, so a
report is only as good as what the engine can express. Two things were missing.

## The two engine pieces

**`EquivalentCodes` — codes that mean the same thing count as one group.** The organisation uses
`TypProject` 0 **and** 1 for عادی. `ValueLabels` cannot merge them: it runs after the SQL, so it
renames a value but leaves two groups — two rows both reading «عادی», with the count and the
percentage split between them. `{"0": "1"}` on the field makes the GROUP BY read:

```sql
CASE WHEN [TypProject] = 0 THEN 1 ELSE [TypProject] END
```

Opt-in per field — a `CASE` in every GROUP BY would cost index use everywhere for nothing. Both sides
are parsed as integers before they are written into the SQL.

**`percentOfTotal` — a new aggregation.**

```sql
COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)
```

`SUM(COUNT(*)) OVER ()` is the same number a separate `SELECT COUNT(*)` would return, but read in the
one pass, so the parts and the whole can never disagree. On a measure it becomes a share of metres
rather than of rows. `NULLIF` covers the empty set. The window runs before `OFFSET/FETCH`, so page two
still shows shares of the real total.

**The denominator is the filtered set**, so «نوع پروژه‌ها در ۱۴۰۵» gives each type its share *of 1405*
and the column adds to 100. Dividing by the whole table would sum to whatever slice of history 1405
happens to be — true, but not what «چند درصد پروژه‌ها عادی بوده» asks. Flagged to Amir as a one-line
change if share-of-all-time was meant.

Both compose:

```sql
SELECT CASE WHEN [TypProject] = 0 THEN 1 ELSE [TypProject] END AS [TypProject],
       COUNT(*) AS [cnt],
       COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0) AS [pct]
FROM [tblDW_EngineerProjectInfo]
WHERE [RegDate] BETWEEN @p0 AND @p1
GROUP BY CASE WHEN [TypProject] = 0 THEN 1 ELSE [TypProject] END
```

## Three mistakes worth keeping

**`between` takes `Value` AND `Value2`, not a two-element array.** My first test passed an array;
`Value2` stayed null and `BETWEEN … AND NULL` matches no row. It fails silently — an empty report,
not an error.

**The parameter list carries `@offset` and `@limit` too.** A test asserting "two filters → two
parameters" got four. The code was right; the assumption was not.

**A piped build command hides its failure.** `dotnet test … | tail -30` reports *tail's* exit code, so
a compile error came back as **exit 0**. The failure was only visible in the output. `set -o pipefail`,
or read the output rather than trusting the status.

## Verified

| | |
| --- | --- |
| .NET unit tests (server) | **425 passed** — whole project, no regressions from the DTO change |
| Front-end tests | **377 passed**, lint clean, build clean |
| Picker offers | exactly «اعضا و پروانه‌ها» and «اطلاعات پروژه‌ای مهندسان» |
| Hidden models | still resolvable by id and by source |
| Dictionaries | decode with the real value shapes — tinyint, smallint, bit, decimal |

## What is left

- **The live signed-in page has not been looked at.** Everything above is tests and generated SQL.
  Nobody has clicked the three chips on `analytic.myceo.ir/ask` and read the numbers.
- **Row counts unverified.** The permission classifier blocked the data-profiling query, so how many
  1405 rows exist and which project types actually appear is unknown. Worth one look before trusting
  chip 1's output.
- The three رفاهی datasets come back when asked — delete their lines from `HIDDEN_MODEL_IDS` and
  their chips return with them.
