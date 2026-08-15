# The engineer-quota endpoint, and the DTO that was silently dropping half a report

- **Date:** 2026-08-15
- **Area:** analytics / api
- **Branch / commits:** `main`
- **Status:** **live** on api.myceo.ir, and the report renders on production against real data

## Goal

*"now do the backend endpoint for the stored procedure"* — the follow-up pinned by
[the custom-reports design](../design/2026-08-15-custom-reports-engineer-quota.md): the frontend
shipped against a mock row with the contract written down, and this is the other half.

## What changed

- `Application/Analytics/Reports/EngineerQuotaDto.cs` — the twelve numbers.
- `Application/Common/Interfaces/Analytics/IEngineerQuotaReader.cs` — its own interface, because
  `IQueryEngine`'s contract is "execute a report definition" and this has none.
- `Application/Analytics/Reports/Queries/GetEngineerQuota/` — `[Authorize]` query, handler, validator.
- `Infrastructure/Analytics/Sql/EngineerQuotaReader.cs` — the `SqlCommand`, plus
  `UnconfiguredEngineerQuotaReader` for when the warehouse is not configured.
- `Infrastructure/Analytics/AnalyticsServiceCollectionExtensions.cs` — registered on the same
  config gate as the query engine.
- `Web/Endpoints/Analytics/Reports.cs` — `POST /api/Reports/custom/engineer-quota`.
- `Application/Analytics/Reports/ReportDefinitionDto.cs` — `presentation` now round-trips, keeping
  custom views only. Without this the endpoint had nothing that could call it; see below.
- `tests/Application.UnitTests/Analytics/AnalyticsValidatorTests.cs` — eight tests: three on the
  validator, five on the round trip.

## Decisions

- **Property names match the procedure's columns** (`UsedInTarahi_4`). ASP.NET camel-cases them to
  `usedInTarahi_4`, which is the contract the frontend already expects, and the mapping stays obvious
  at a glance — which matters, because the brief's one hard rule is "do not swap the fields".
- **No capacities in the response.** They are a fixed client constant; returning them would create a
  second source of truth for a number that must not vary.
- **`[Authorize]` with no role**, matching `ExecuteReportQuery`. That handler additionally refuses
  models flagged `RequiresAdministrator`; only the welfare models carry it, the KurdNezam ones do
  not, and this returns aggregates — areas and counts, no name and no کد ملی.
- **`Convert.ToDecimal`, not a cast.** A direct unbox throws if the procedure ever returns `float`
  or `money` where `decimal` was expected, and that would be a 500 on a perfectly good database. The
  column names are the contract; their exact SQL type is not.
- **Loose validation** — `> 0`, not an allow-list of the nine cities. Those ids live in the database,
  and a new city must not get a 400 from a service that does not know about cities.
- **A registered `UnconfiguredEngineerQuotaReader`** rather than leaving the interface unregistered,
  so a missing warehouse says what is wrong instead of "no service for IEngineerQuotaReader".

## Verification

Built and tested **on the server** (NuGet is blocked locally): `dotnet build src/Web/Web.csproj` →
**0 errors**; `dotnet test --filter AnalyticsValidatorTests` → **16 passed**.

Deployed `api` alone. Unauthenticated `POST` returns **401**, so the route is mapped and protected
rather than missing. `ConnectionStrings__AnalyticsDb` is set on the container, so the real reader is
registered and not the stand-in.

**Called for real, authenticated, against the live procedure** — Bijar / mechanical, the same pair as
the reference screenshot:

| base | live now | the screenshot | engineers |
| --- | --- | --- | --- |
| ارشد | 1873.64 / 0.00 | 1558.74 / 0.00 | 1 = 1 |
| یک | 9445.76 / 7556.73 | 9247.66 / 6146.36 | 10 = 10 |
| دو | **1339.52** / 5366.76 | **1339.52** / 5092.96 | 6 = 6 |
| سه | **1173.12** / 4535.57 | **1173.12** / 4358.71 | 6 = 6 |

All four engineer counts match exactly and two design figures match to the cent; the rest are higher,
which is what a later reading of the same city and discipline looks like. That corroborates the field
mapping against an independent reference rather than against my own mock.

The report itself now renders on production — see *Unblocking it* below.

## The blocker this uncovered, and how it was unblocked

**`ReportDefinitionDto` had no `presentation` property**, and both write paths store
`JsonSerializer.Serialize(request.Definition)` — the *typed* DTO. So `presentation` was dropped on the
way in and never came back. Confirmed against live data before changing anything: none of the five
production reports had a `presentation` key.

A custom report **is** a definition whose `presentation.views[0]` carries `library: "custom"`, so with
`presentation` dropped one could not exist in production, however well the endpoint worked.

### Only custom views are kept

The obvious fix — round-trip `presentation` wholesale — has a consequence worth refusing.
`ReportViewer` *prefers* a non-empty `presentation.views` over `chooseView`, so persisting views would
freeze whatever auto-viz picked for **every report anyone re-saves**: a bar chart chosen from one
day's data, kept forever. Custom views are different in kind — nothing derives them, so there is
nothing to freeze.

So `PresentationDto.Views` keeps only views whose library is `custom` and drops the rest.

**The filter lives in the property's `init` accessor, not in the handlers.** There are two write paths
today and both simply serialise the DTO; a rule kept in handlers is a rule the third one forgets. In
the accessor it is impossible to bypass, and it applies on read as well, which is also correct.

### Proven on production, both halves

Saved a custom report through the API (id 6) and read it straight back: the view survives with its
`options` — `{ cityId: 25, reshte: 4 }` — intact, while reports 1-5 still return `presentation: null`.
Ordinary reports are untouched.

Then opened it. It renders: the table with «۱٬۸۷۳.۶۴ / ۰ / ۱ / ۱۸٬۱۲۶.۳۶ / ۲۰٬۰۰۰» for پایه ارشد —
the remainder is the procedure's number subtracted from the client constant — and four rings below.

Both parameters reach the procedure and change the answer:

| city / discipline | engineers per base |
| --- | --- |
| بیجار / مکانیک | 1, 10, 6, 6 |
| سنندج / مکانیک | 23, 93, 79, 52 |
| بیجار / عمران | 10, 42, 20, 30 |

**453 unit tests pass** on the server — the DTO is on every report path, so the whole suite ran, not
only the five new round-trip tests.

## Follow-ups

- **A report now exists on production as id 6**, created through the API to prove the round trip.
  It is the real report, not a test fixture — but it was created by hand rather than through any UI,
  because nothing in the product creates custom reports yet. Deciding how they get created (a seed, an
  admin screen, or by hand as here) is still open.
- **Nothing in the UI offers a custom report.** It has to be known about and navigated to.
- **Export is still absent on custom reports**, deliberately — see the custom-reports worklog.
