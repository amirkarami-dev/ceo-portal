# The engineer-quota endpoint, and the reason the report still cannot be used

- **Date:** 2026-08-15
- **Area:** analytics / api
- **Branch / commits:** `main`
- **Status:** **live** on api.myceo.ir — and the report that consumes it is still unreachable, see below

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
- `tests/Application.UnitTests/Analytics/AnalyticsValidatorTests.cs` — three validator tests.

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

**Not verified:** the report rendering against real data, for the reason below.

## The blocker this uncovered

**`ReportDefinitionDto` has no `presentation` property**, and `SaveReportCommandHandler` stores
`JsonSerializer.Serialize(request.Definition)` — the *typed* DTO. So `presentation` is dropped on the
way in and never comes back out. Confirmed against live data: none of the five production reports has
a `presentation` key.

A custom report **is** a definition whose `presentation.views[0]` carries
`library: "custom"`. With `presentation` dropped, such a report cannot exist in production, so the
quota report stays unreachable no matter how well this endpoint works.

That is not a small addition, which is why it stopped here rather than being folded in: `ReportViewer`
**prefers** `presentation.views` when non-empty, so the moment saving starts persisting views, every
re-saved report freezes the view auto-viz happened to pick instead of re-deriving it. That is a
product behaviour change, not plumbing.

## Follow-ups

- **Decide how a custom report reaches production.** Either round-trip `presentation` through
  `ReportDefinitionDto` (and accept the frozen-views consequence, or store only `views` whose library
  is `custom`), or give custom reports their own registration path that does not travel inside a
  report definition.
- Nothing else blocks the report: the endpoint, the contract and the whole frontend are in place.
