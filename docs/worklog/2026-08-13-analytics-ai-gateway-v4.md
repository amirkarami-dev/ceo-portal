# The AI gateway moved to DeepSeek-V4-Flash, and why «۱۴۰۵» came back empty

**Date:** 2026-08-13
**Area:** `src/Infrastructure/Analytics/Ai`, `src/Infrastructure/Analytics/Sql`, `deploy/.env`
**Status:** deployed to `api`

## The goal

Point the analytics AI at the new ArvanCloud gateway for **DeepSeek-V4-Flash**, testing before
switching. The existing API key was said to work on the new gateway — it does.

Mid-task Amir reported the «دسته‌بندی نوع پروژه‌ها ۱۴۰۵» chip returning null, and sent the SQL he had
written by hand along with its real numbers. That turned a config change into a bug hunt, and the
three causes are the useful part of this record.

## Where the gateway lives

No code change was needed for the switch itself. It is three environment values, bound to
`ArvanAiOptions` from the `AnalyticsAi` section:

| Variable | Meaning |
| --- | --- |
| `ANALYTICS_AI_BASE_URL` | gateway URL, **must end in `/v1`**, and is itself a signed credential |
| `ANALYTICS_AI_API_KEY` | sent as `Authorization: apikey <key>` |
| `ANALYTICS_AI_MODEL` | model id in the request body |

**The base URL names the model too** (`/gateway/models/DeepSeek-V4-Flash/…`), so `ANALYTICS_AI_MODEL`
and the URL have to agree. Both were changed together. The URL never enters the repo — only
`deploy/.env` on the server, with a `.env.bak-2026-08-13-ai` beside it.

## Tested before switching

Against the new gateway with the **existing** key: HTTP 200, model echoed back `DeepSeek-V4-Flash`,
and a faithful copy of the real grounding prompt produced a valid `ReportDefinition`.

Its output shape differs from the old model in a way that turned out to be harmless: the reasoning
comes back in a separate `reasoning_content` field with clean `content`, rather than inline in
`<think>` tags. `ExtractJson` strips `</think>` *if present*, so it is simply a no-op now.

## Three causes for one empty report

**1. The AI was never told `percentOfTotal` exists.** The system prompt lists the allowed
aggregations, and step 3 added the aggregation to the engine without adding it to that list. The
model writes only what the list allows, so «درصد» came back as a bare count. The feature was
unreachable from the moment it shipped.

**2. `between` was silently matching nothing.** The model writes what the schema shows it:

```json
{ "field": "RegDate", "operator": "between", "value": ["1405/01/01", "1405/12/30"] }
```

One `value` key holding two bounds. `ReportFilterDto` carries `Value` **and** `Value2`, so `Value2`
stayed null and the SQL became `BETWEEN @p0 AND NULL` — no rows, no error, a report that reads as
"this year has no data".

**This is pre-existing, not from the model switch.** The old model was asked the same question and
wrote the same array, so every year-filtered report has been empty. It is also the exact mistake I
made in my own unit test in step 3 — two independent readers guessing the same wrong shape is the
schema's fault, not theirs.

**3. The new model can spend its whole budget thinking.** One run in three on the percent prompt
returned `finish_reason: length` with `content: null`. Reasoning measured ~1000 tokens and the JSON
~500, against a `max_tokens` of 2000.

## The fixes

- **`between` accepts both shapes** — `Value`+`Value2`, or a two-item `value` array. Given only one
  bound it now **throws** with the field name, because an empty report that looks like real data is
  worse than an error.
- **The prompt gained** `percentOfTotal` with a note to use it alongside count whenever the request
  says «درصد»; the two-bound `between` spelled out; "keep the reasoning SHORT"; a note that a Jalali
  date is text so a year is a range, never a bare `1405`; and a worked example that mirrors the exact
  report Amir asked for.
- **`max_tokens` 2000 → 4000**, and a null `content` now reports *which* failure it was — a model that
  ran out of budget reads very differently from a parse bug.

## Verified

| | |
| --- | --- |
| Gateway + existing key | HTTP 200, model `DeepSeek-V4-Flash` |
| Reliability at 4000 tokens | **6/6** across all three chip prompts, all valid JSON |
| New prompt → right shape | **4/4** runs emit `count` + `percentOfTotal` and a two-bound `between` |
| Unit tests (server) | **429 passed** |

Amir's hand-written SQL is the same shape the engine now generates — `CASE … IN (0,1)` merged, and
`COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()`. His all-time numbers: عادی 87.33%, بافت فرسوده 5.19%,
زیر ۲۰ هزار نفر 2.90%, across ~154,000 rows.

## Worth knowing

- **`سایر` = 72 rows — now grouped, on request.** Codes outside the dictionary used to show as one
  row per bare number. A label alone could not fix it (`ValueLabels` renames, it never merges), so
  the field gained `OtherCode = "9999"`: the GROUP BY tests `IS NULL OR NOT IN (<the known codes>)`
  first and folds everything else into one bucket, which `ValueLabels` then renders as «سایر».

  **`9999` is deliberately absent from the field's `Description`,** so the AI never sees it. If it
  did, «پروژه‌های سایر» would become `TypProject eq 9999` — a code that exists nowhere in the
  warehouse, returning an empty report. The bucket is a grouping detail; the AI only ever sees real
  org codes.

  `CityId` has a dictionary but no bucket on purpose: an unknown city still shows its own code
  rather than being swept into a group nobody asked for.
- **His query has no year filter**, so 87.33% is all-time; filtered to 1405 the shares will differ.
- **A feature added to the engine is not reachable until the prompt offers it.** Both halves, every
  time — the same "two files" lesson as the semantic model, in a different disguise.
