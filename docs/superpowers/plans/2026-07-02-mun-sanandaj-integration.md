# mun-sanandaj Integration Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `MunSanandaj` backend feature (two 12h sync workers against the KurdNezam SQL Server + mahyapardaz REST API, with a full audit trail) and a new `mun-sanandaj-web` React/AntD monitoring dashboard, deployed to `mun-sanandaj.myceo.ir` on the `185.206.94.116` stack.

**Architecture:** New `MunSanandaj` bounded feature inside the existing Clean-Architecture backend (Domain/Application/Infrastructure/Web), storing `mun_sync_runs`/`mun_report_logs` in the existing `Mabhas19Db` via EF Core. Two `BackgroundService`s call a shared `IMunSanandajSyncService` (also callable on-demand from an admin API). A new standalone Vite/React SPA polls that API for live status.

**Tech Stack:** .NET 10 (raw ADO.NET for the external SQL Server, typed `HttpClient` for the REST calls), EF Core / SQL Server, NUnit + Moq + Shouldly for backend tests, Vite + React 19 + TypeScript + AntD 5 + ECharts + framer-motion + TanStack Query + oidc-client-ts for the frontend, Docker/Traefik for deploy.

## Global Constraints

- Numeric/logic values from the source spec are exact contracts — do not "improve" them: stored procedure names (`WebS_GetListRepToShahrdari`, `WebS_GetReportFullInfo`), endpoint URLs/hosts, JSON field names, and the specific hardcoded values in `addEngineer` (`father_name="none"`, `code_persontype_id=1`, `code_engineeringbranch_id=1`, `economic_code="41123456789"`, `signature_code="SGN-4589"`, `description="none"`) must match verbatim.
- No secrets committed anywhere: `ConnectionStrings:KurdNezamDb` and `MunSanandaj:ApiToken` are empty placeholders in every committed `appsettings*.json`; real values only via env vars / `deploy/.env` on the server.
- The whole `MunSanandaj` backend feature (options binding, DI registrations, background workers) is **gated off** when `ConnectionStrings:KurdNezamDb` is empty/unset — mirrors the existing `AnalyticsDb`/`FarsNezamDb` gating pattern in `AnalyticsServiceCollectionExtensions`/`DependencyInjection.cs`, so local dev and CI never fail for lacking this external, credentialed DB.
- EF Core enums are stored as `int` via `.HasConversion<int>()` (matches `ProjectConfiguration`/`AssessmentConfiguration`/`SubscriptionConfiguration` — never store enums as string in this codebase).
- Test framework is **NUnit** (`[TestFixture]`/`[Test]`) with **Shouldly** assertions and **Moq** for fakes — matches every existing file under `tests/Application.UnitTests`. Do not introduce xUnit.
- `mun-sanandaj-web` is Persian-only (no i18next dual-language machinery — this is a lean 2-screen admin tool, unlike the much larger `analytics-web`), RTL, AntD 5, emerald-ish default AntD theme is NOT required — a plain default AntD theme is fine (no shared design-system package to reuse).
- Live updates on the dashboard are **polling-based** (TanStack Query `refetchInterval`), not SignalR/WebSocket.

## File Structure

**Backend — new files:**
- `src/Domain/MunSanandaj/MunWorkerType.cs`, `MunRunStatus.cs`, `MunRunTrigger.cs`, `MunLogStatus.cs` — enums.
- `src/Domain/MunSanandaj/MunSyncRun.cs`, `MunReportLog.cs` — entities.
- `src/Infrastructure/Data/Configurations/MunSanandaj/MunSyncRunConfiguration.cs`, `MunReportLogConfiguration.cs` — EF configs.
- `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSourceReader.cs` — interface + `MunSourceRowDto`/`MunEngineerInfoDto`.
- `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajGatewayClient.cs` — interface + `MunEngMapEngineer`/`MunGatewayResult`/`MunAddEngineerResult`.
- `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSyncService.cs` — interface.
- `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajPdfFetcher.cs` — interface.
- `src/Infrastructure/MunSanandaj/MunSanandajOptions.cs` — options (API token, interval).
- `src/Infrastructure/MunSanandaj/MunFieldMapper.cs` — pure mapping helpers (sp2 row → `addEngineer` payload / `saveEngMap` engineer entry).
- `src/Infrastructure/MunSanandaj/MunSanandajGatewayClient.cs` — HTTP client + pure response parsers.
- `src/Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs` — ADO.NET reader for sp1/sp2.
- `src/Infrastructure/MunSanandaj/MunSanandajPdfFetcher.cs` — PDF fetch + base64.
- `src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs` — orchestration.
- `src/Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs`, `SaveEngMapWorker.cs` — `BackgroundService`s.
- `src/Web/Endpoints/MunSanandaj/Runs.cs`, `Logs.cs` — Minimal API endpoints + DTOs.
- `tests/Application.UnitTests/MunSanandaj/MunFieldMapperTests.cs`, `MunSanandajGatewayClientTests.cs`, `MunSanandajSyncServiceTests.cs`.

**Backend — modified files:**
- `src/Application/Common/Interfaces/IApplicationDbContext.cs`, `src/Infrastructure/Data/ApplicationDbContext.cs` — add 2 `DbSet`s.
- `src/Infrastructure/DependencyInjection.cs` — register the gated `MunSanandaj` services.
- `src/Web/appsettings.json` — add `ConnectionStrings:KurdNezamDb` + `MunSanandaj` section placeholders.
- `src/Infrastructure/Infrastructure.csproj` migration output — new migration file (generated, not hand-written).

**Frontend — new folder `mun-sanandaj-web/`** (sibling to `analytics-web/`), mirroring its tooling but much smaller:
- `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.eslintrc` equivalent, `index.html`.
- `src/main.tsx`, `src/app/App.tsx`, `src/app/providers.tsx`, `src/app/router.tsx`.
- `src/auth/oidc.ts`, `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/routes.tsx`.
- `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/queries.ts`.
- `src/layout/AppLayout.tsx`.
- `src/features/dashboard/Dashboard.tsx`.
- `src/features/logs/LogsPage.tsx`.
- `deploy/Dockerfile.mun-sanandaj-web`, `deploy/nginx.conf`.

**Deploy — modified files:**
- `deploy/docker-compose.newserver.yml` — new `mun-sanandaj-web` service + `api`/`auth` env additions.
- `src/Auth/Data/AuthDbInitialiser.cs` — seed the `mun-sanandaj-web` OIDC client.
- `scripts/deploy.ps1`, `scripts/remote-provision.sh` — build-loop + `.env` template additions.
- `roadmap/roadmap.json` — new `mun-sanandaj` service entry.

---

### Task 1: Domain entities + DbContext wiring + migration

**Files:**
- Create: `src/Domain/MunSanandaj/MunWorkerType.cs`, `src/Domain/MunSanandaj/MunRunStatus.cs`, `src/Domain/MunSanandaj/MunRunTrigger.cs`, `src/Domain/MunSanandaj/MunLogStatus.cs`
- Create: `src/Domain/MunSanandaj/MunSyncRun.cs`, `src/Domain/MunSanandaj/MunReportLog.cs`
- Create: `src/Infrastructure/Data/Configurations/MunSanandaj/MunSyncRunConfiguration.cs`, `src/Infrastructure/Data/Configurations/MunSanandaj/MunReportLogConfiguration.cs`
- Modify: `src/Application/Common/Interfaces/IApplicationDbContext.cs`, `src/Infrastructure/Data/ApplicationDbContext.cs`
- Create (generated): `src/Infrastructure/Data/Migrations/*_AddMunSanandaj.cs`

**Interfaces:**
- Produces: `MunSyncRun`, `MunReportLog` entities; `MunWorkerType{SaveEngineerReport,SaveEngMap}`, `MunRunStatus{Running,Completed,Failed}`, `MunRunTrigger{Timer,Manual}`, `MunLogStatus{Success,Failed}` enums; `IApplicationDbContext.MunSyncRuns`/`MunReportLogs` (`DbSet<MunSyncRun>`/`DbSet<MunReportLog>`) — every later backend task depends on these exact names.

- [ ] **Step 1: Create the enums**

`src/Domain/MunSanandaj/MunWorkerType.cs`:
```csharp
namespace Mabhas19.Domain.MunSanandaj;

public enum MunWorkerType
{
    SaveEngineerReport,
    SaveEngMap
}
```

`src/Domain/MunSanandaj/MunRunStatus.cs`:
```csharp
namespace Mabhas19.Domain.MunSanandaj;

public enum MunRunStatus
{
    Running,
    Completed,
    Failed
}
```

`src/Domain/MunSanandaj/MunRunTrigger.cs`:
```csharp
namespace Mabhas19.Domain.MunSanandaj;

public enum MunRunTrigger
{
    Timer,
    Manual
}
```

`src/Domain/MunSanandaj/MunLogStatus.cs`:
```csharp
namespace Mabhas19.Domain.MunSanandaj;

public enum MunLogStatus
{
    Success,
    Failed
}
```

- [ ] **Step 2: Create the entities**

`src/Domain/MunSanandaj/MunSyncRun.cs`:
```csharp
using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.MunSanandaj;

/// <summary>One row per worker execution (a 12h timer tick or a manual "run now").</summary>
public class MunSyncRun : BaseEntity
{
    /// <summary>Public identifier used by the API/frontend (internal Id is EF-only).</summary>
    public Guid RunId { get; set; }

    public MunWorkerType WorkerType { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public MunRunStatus Status { get; set; }

    /// <summary>Rows returned by sp1 (WebS_GetListRepToShahrdari) for this run.</summary>
    public int TotalRows { get; set; }

    public int SuccessCount { get; set; }

    public int FailedCount { get; set; }

    public MunRunTrigger TriggeredBy { get; set; }

    /// <summary>Admin email, only set when TriggeredBy == Manual.</summary>
    public string? TriggeredByUser { get; set; }
}
```

`src/Domain/MunSanandaj/MunReportLog.cs`:
```csharp
using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.MunSanandaj;

/// <summary>
/// One row per ATTEMPT at posting a single source row (Peygiri) to the municipality API.
/// Append-only — never updated after insert. The current status of a Peygiri is its latest
/// row (highest Id) for that WorkerType.
/// </summary>
public class MunReportLog : BaseEntity
{
    /// <summary>FK to MunSyncRun.Id (the internal int Id, not the public RunId).</summary>
    public int RunId { get; set; }

    /// <summary>Denormalized copy of the owning run's WorkerType, for simpler queries.</summary>
    public MunWorkerType WorkerType { get; set; }

    /// <summary>Tracking code from sp1, e.g. "90038565090216074508".</summary>
    public string Peygiri { get; set; } = string.Empty;

    /// <summary>darkhast_id.</summary>
    public string ProjectNo { get; set; } = string.Empty;

    /// <summary>melk_id.</summary>
    public string ReqId { get; set; } = string.Empty;

    public string? Nosazi { get; set; }

    public MunLogStatus Status { get; set; }

    /// <summary>1-based count of attempts at this (WorkerType, Peygiri) across all runs.</summary>
    public int AttemptNumber { get; set; }

    /// <summary>The "peigiri" value the endpoint returns on success.</summary>
    public string? RemoteSubmissionId { get; set; }

    /// <summary>Raw JSON response body, for debugging.</summary>
    public string? ResponseBody { get; set; }

    public string? ErrorMessage { get; set; }

    /// <summary>Comma-separated code_meli values auto-created via addEngineer during this attempt (SaveEngMap only).</summary>
    public string? CreatedEngineerCodes { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset CompletedAt { get; set; }
}
```

- [ ] **Step 3: Create the EF configurations**

`src/Infrastructure/Data/Configurations/MunSanandaj/MunSyncRunConfiguration.cs`:
```csharp
using Mabhas19.Domain.MunSanandaj;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.MunSanandaj;

public class MunSyncRunConfiguration : IEntityTypeConfiguration<MunSyncRun>
{
    public void Configure(EntityTypeBuilder<MunSyncRun> builder)
    {
        builder.ToTable("mun_sync_runs");

        builder.Property(r => r.WorkerType).HasConversion<int>();
        builder.Property(r => r.Status).HasConversion<int>();
        builder.Property(r => r.TriggeredBy).HasConversion<int>();
        builder.Property(r => r.TriggeredByUser).HasMaxLength(256);

        builder.HasIndex(r => r.RunId).IsUnique();
        builder.HasIndex(r => r.StartedAt);
    }
}
```

`src/Infrastructure/Data/Configurations/MunSanandaj/MunReportLogConfiguration.cs`:
```csharp
using Mabhas19.Domain.MunSanandaj;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.MunSanandaj;

public class MunReportLogConfiguration : IEntityTypeConfiguration<MunReportLog>
{
    public void Configure(EntityTypeBuilder<MunReportLog> builder)
    {
        builder.ToTable("mun_report_logs");

        builder.Property(l => l.WorkerType).HasConversion<int>();
        builder.Property(l => l.Status).HasConversion<int>();
        builder.Property(l => l.Peygiri).HasMaxLength(64).IsRequired();
        builder.Property(l => l.ProjectNo).HasMaxLength(64).IsRequired();
        builder.Property(l => l.ReqId).HasMaxLength(64).IsRequired();
        builder.Property(l => l.Nosazi).HasMaxLength(64);
        builder.Property(l => l.RemoteSubmissionId).HasMaxLength(64);
        builder.Property(l => l.ResponseBody).HasColumnType("nvarchar(max)");
        builder.Property(l => l.ErrorMessage).HasMaxLength(1000);
        builder.Property(l => l.CreatedEngineerCodes).HasMaxLength(500);

        // Immutable, append-only — no update after insert (same rationale as AuditEventConfiguration).
        builder.HasIndex(l => l.RunId);
        builder.HasIndex(l => new { l.WorkerType, l.Peygiri, l.Id });
    }
}
```

- [ ] **Step 4: Wire the DbSets**

Edit `src/Application/Common/Interfaces/IApplicationDbContext.cs` — add after the `AnalyticsAuditEvents` line:
```csharp
using Mabhas19.Domain.MunSanandaj;
```
(add to the top `using` block, alongside the existing `Mabhas19.Domain.Analytics`/`Mabhas19.Domain.Entities` usings), and add these two members before `Task<int> SaveChangesAsync(...)`:
```csharp
    // MunSanandaj integration
    DbSet<MunSyncRun> MunSyncRuns { get; }

    DbSet<MunReportLog> MunReportLogs { get; }
```

Edit `src/Infrastructure/Data/ApplicationDbContext.cs` — add `using Mabhas19.Domain.MunSanandaj;` to the usings, and add these two members after `AnalyticsAuditEvents`:
```csharp
    // MunSanandaj integration
    public DbSet<MunSyncRun> MunSyncRuns => Set<MunSyncRun>();

    public DbSet<MunReportLog> MunReportLogs => Set<MunReportLog>();
```

- [ ] **Step 5: Build**

Run: `dotnet build Mabhas19.slnx`
Expected: build succeeds with 0 errors/warnings (this repo has `TreatWarningsAsErrors=true`).

- [ ] **Step 6: Generate the EF migration**

Run (requires local SQL Server up via `docker compose -f deploy/docker-compose.dev.yml up -d` and `ConnectionStrings:Mabhas19Db` configured, per this repo's standard dev setup):
```bash
dotnet ef migrations add AddMunSanandaj --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```
Expected: a new migration file `*_AddMunSanandaj.cs` is generated under `src/Infrastructure/Data/Migrations/`, creating tables `mun_sync_runs` and `mun_report_logs`. Inspect the generated `Up()` method to confirm both tables and the two indexes from Step 3 appear; if the migration is empty, re-check that Steps 1-4 compiled and `OnModelCreating`'s `ApplyConfigurationsFromAssembly` picked up the new configuration classes (they must be `public` and implement `IEntityTypeConfiguration<T>`, which they do above).

- [ ] **Step 7: Commit**

```bash
git add src/Domain/MunSanandaj src/Infrastructure/Data/Configurations/MunSanandaj src/Infrastructure/Data/Migrations src/Application/Common/Interfaces/IApplicationDbContext.cs src/Infrastructure/Data/ApplicationDbContext.cs
git commit -m "feat(mun-sanandaj): add MunSyncRun/MunReportLog entities + migration"
```

---

### Task 2: Application interfaces, DTOs, and options

**Files:**
- Create: `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSourceReader.cs`
- Create: `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajGatewayClient.cs`
- Create: `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSyncService.cs`
- Create: `src/Application/Common/Interfaces/MunSanandaj/IMunSanandajPdfFetcher.cs`
- Create: `src/Infrastructure/MunSanandaj/MunSanandajOptions.cs`

**Interfaces:**
- Consumes: `MunWorkerType`, `MunRunTrigger` from Task 1.
- Produces: `MunSourceRowDto`, `MunEngineerInfoDto`, `IMunSanandajSourceReader`, `MunEngMapEngineer`, `MunGatewayResult`, `MunAddEngineerResult`, `IMunSanandajGatewayClient`, `IMunSanandajSyncService`, `IMunSanandajPdfFetcher`, `MunSanandajOptions` — every later task (3-9) depends on these exact names/shapes.

- [ ] **Step 1: Source-reader interface + DTOs**

`src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSourceReader.cs`:
```csharp
namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>One row returned by sp1 [dbo].[WebS_GetListRepToShahrdari].</summary>
public sealed record MunSourceRowDto(string Peygiri, string ProjectNo, string? Nosazi, string ReqId);

/// <summary>One row returned by sp2 [dbo].[WebS_GetReportFullInfo] @TraceCode.</summary>
public sealed record MunEngineerInfoDto(
    string Ozviat,
    string ShomarehNezam,
    string FName,
    string LName,
    string TarikhSodur,
    string TarikhTamdid,
    string TarikhPayanEtebar,
    string PesronTyp,
    string NationalId,
    string Mob,
    string PayehNezaratTemp,
    string Major);

/// <summary>Read-only access to the KurdNezam SQL Server (ConnectionStrings:KurdNezamDb).</summary>
public interface IMunSanandajSourceReader
{
    /// <summary>Calls sp1 — every row currently pending report/map submission.</summary>
    Task<IReadOnlyList<MunSourceRowDto>> GetPendingReportsAsync(CancellationToken ct = default);

    /// <summary>Calls sp2 for one Peygiri — every engineer assigned to that project (may be more than one).</summary>
    Task<IReadOnlyList<MunEngineerInfoDto>> GetEngineersAsync(string peygiri, CancellationToken ct = default);
}
```

- [ ] **Step 2: Gateway-client interface + DTOs**

`src/Application/Common/Interfaces/MunSanandaj/IMunSanandajGatewayClient.cs`:
```csharp
namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>One entry of the saveEngMap "engineers" array.</summary>
public sealed record MunEngMapEngineer(string CodeMeli, int Branch, int Task);

/// <summary>
/// Uniform result for saveEngineerReport / saveEngMap.
/// <paramref name="FailedEngineerMessages"/> is non-null only for saveEngMap when one or more
/// engineers came back with success:false (code_meli -> msg) — the caller uses this to drive
/// the addEngineer-then-retry flow.
/// </summary>
public sealed record MunGatewayResult(
    bool Success,
    string? RemoteSubmissionId,
    string RawResponse,
    string? ErrorMessage,
    IReadOnlyDictionary<string, string>? FailedEngineerMessages);

public sealed record MunAddEngineerResult(bool Success, string? ErrorMessage);

/// <summary>The mahyapardaz REST API (Bearer auth via MunSanandaj:ApiToken).</summary>
public interface IMunSanandajGatewayClient
{
    Task<MunGatewayResult> SaveEngineerReportAsync(string projectNo, string reqId, string pdfBase64, CancellationToken ct = default);

    Task<MunGatewayResult> SaveEngMapAsync(string projectNo, IReadOnlyList<MunEngMapEngineer> engineers, string pdfBase64, CancellationToken ct = default);

    Task<MunAddEngineerResult> AddEngineerAsync(MunEngineerInfoDto engineer, CancellationToken ct = default);
}
```

- [ ] **Step 3: Sync-service interface**

`src/Application/Common/Interfaces/MunSanandaj/IMunSanandajSyncService.cs`:
```csharp
using Mabhas19.Domain.MunSanandaj;

namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>
/// Orchestrates one full sync pass for a worker type. Returns the public RunId of the
/// mun_sync_runs row it created — callers (the timer workers and the manual-trigger endpoint)
/// use this to look up the run's final state.
/// </summary>
public interface IMunSanandajSyncService
{
    Task<Guid> RunSaveEngineerReportAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default);

    Task<Guid> RunSaveEngMapAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default);
}
```

- [ ] **Step 4: PDF-fetcher interface**

`src/Application/Common/Interfaces/MunSanandaj/IMunSanandajPdfFetcher.cs`:
```csharp
namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>Fetches the pre-generated supervising-engineer PDF for a project and base64-encodes it.</summary>
public interface IMunSanandajPdfFetcher
{
    /// <summary>Returns null (not an exception) when the PDF hasn't been generated yet (HTTP 404) —
    /// the caller logs this attempt as Failed and retries on the next 12h run, same as any other failure.</summary>
    Task<string?> FetchAsBase64Async(string projectNo, CancellationToken ct = default);
}
```

- [ ] **Step 5: Options**

`src/Infrastructure/MunSanandaj/MunSanandajOptions.cs`:
```csharp
namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Configuration for the mahyapardaz REST API. The KurdNezam SQL connection string is bound
/// separately from ConnectionStrings:KurdNezamDb (kept out of this section, same reasoning as
/// FarsNezamOptions, so it can live in env/.env without leaking into appsettings).
/// </summary>
public class MunSanandajOptions
{
    public const string SectionName = "MunSanandaj";

    /// <summary>Bearer token for the mahyapardaz REST API.</summary>
    public string ApiToken { get; set; } = string.Empty;

    /// <summary>Hours between automatic sync runs. Defaults to 12.</summary>
    public int IntervalHours { get; set; } = 12;
}
```

- [ ] **Step 6: Build and commit**

Run: `dotnet build Mabhas19.slnx`
Expected: 0 errors/warnings.

```bash
git add src/Application/Common/Interfaces/MunSanandaj src/Infrastructure/MunSanandaj/MunSanandajOptions.cs
git commit -m "feat(mun-sanandaj): add source-reader/gateway/sync-service interfaces + options"
```

---

### Task 3: Pure field-mapping helpers (TDD)

**Files:**
- Create: `src/Infrastructure/MunSanandaj/MunFieldMapper.cs`
- Test: `tests/Application.UnitTests/MunSanandaj/MunFieldMapperTests.cs`

**Interfaces:**
- Consumes: `MunEngineerInfoDto` (Task 2), `MunEngMapEngineer` (Task 2).
- Produces: `internal static class MunFieldMapper` with `BuildAddEngineerPayload(MunEngineerInfoDto) : object` and `ToEngMapEngineer(MunEngineerInfoDto) : MunEngMapEngineer` — consumed by `MunSanandajGatewayClient` (Task 4) and `MunSanandajSyncService` (Task 7).

- [ ] **Step 1: Write the failing tests**

`tests/Application.UnitTests/MunSanandaj/MunFieldMapperTests.cs`:
```csharp
using System.Text.Json;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunFieldMapperTests
{
    private static readonly MunEngineerInfoDto SampleEngineer = new(
        Ozviat: "1499",
        ShomarehNezam: "22-10-01079",
        FName: "حمید",
        LName: "پارسا",
        TarikhSodur: "1404/04/04",
        TarikhTamdid: "1404/05/05",
        TarikhPayanEtebar: "1405/04/04",
        PesronTyp: "1",
        NationalId: "4420716746",
        Mob: "9133240295",
        PayehNezaratTemp: "3",
        Major: "1");

    [Test]
    public void ToEngMapEngineer_maps_national_id_to_code_meli_and_persontype_to_branch()
    {
        var result = MunFieldMapper.ToEngMapEngineer(SampleEngineer);

        result.CodeMeli.ShouldBe("4420716746");
        result.Branch.ShouldBe(1); // from PesronTyp
        result.Task.ShouldBe(1);   // hardcoded
    }

    [Test]
    public void BuildAddEngineerPayload_maps_every_field_per_spec()
    {
        var payload = MunFieldMapper.BuildAddEngineerPayload(SampleEngineer);
        var json = JsonSerializer.Serialize(payload);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        root.ValueKind.ShouldBe(JsonValueKind.Array);
        root.GetArrayLength().ShouldBe(1);
        var engineer = root[0];

        engineer.GetProperty("first_name").GetString().ShouldBe("حمید");
        engineer.GetProperty("last_name").GetString().ShouldBe("پارسا");
        engineer.GetProperty("father_name").GetString().ShouldBe("none");
        engineer.GetProperty("code_persontype_id").GetInt32().ShouldBe(1);
        engineer.GetProperty("national_code").GetString().ShouldBe("4420716746");
        engineer.GetProperty("mobile").GetString().ShouldBe("9133240295");
        engineer.GetProperty("membership_number").GetString().ShouldBe("1499");
        engineer.GetProperty("membership_date").GetString().ShouldBe("1404/04/04");
        engineer.GetProperty("renewal_date").GetString().ShouldBe("1404/04/04"); // from TarikhSodur, NOT TarikhTamdid
        engineer.GetProperty("membership_expire_date").GetString().ShouldBe("1405/04/04");

        var license = engineer.GetProperty("license")[0];
        license.GetProperty("license_number").GetString().ShouldBe("1499");
        license.GetProperty("license_issue_date").GetString().ShouldBe("1404/04/04");
        license.GetProperty("license_renewal_date").GetString().ShouldBe("1404/04/04");
        license.GetProperty("license_expire_date").GetString().ShouldBe("1405/04/04");
        license.GetProperty("economic_code").GetString().ShouldBe("41123456789");
        license.GetProperty("signature_code").GetString().ShouldBe("SGN-4589");
        license.GetProperty("description").GetString().ShouldBe("none");

        var branch = license.GetProperty("branch")[0];
        branch.GetProperty("code_engineeringbase_id").GetInt32().ShouldBe(3);   // from PayehNezaratTemp
        branch.GetProperty("code_engineeringbranch_id").GetInt32().ShouldBe(1); // hardcoded
        branch.GetProperty("code_engineeringtask_id").GetInt32().ShouldBe(1);   // from PesronTyp
        branch.GetProperty("issue_date").GetString().ShouldBe("1404/04/04");
        branch.GetProperty("expire_date").GetString().ShouldBe("1405/04/04");
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunFieldMapperTests"`
Expected: FAIL — `MunFieldMapper` does not exist yet (compile error).

- [ ] **Step 3: Implement `MunFieldMapper`**

`src/Infrastructure/MunSanandaj/MunFieldMapper.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces.MunSanandaj;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Pure mapping helpers from a KurdNezam sp2 engineer row to the two municipality payload
/// shapes. No I/O — kept static and side-effect-free so they're directly unit-testable.
/// </summary>
internal static class MunFieldMapper
{
    public static MunEngMapEngineer ToEngMapEngineer(MunEngineerInfoDto e) =>
        new(e.NationalId, ParseIntOrZero(e.PesronTyp), 1);

    /// <summary>
    /// Builds the addEngineer request body — a JSON array containing exactly one engineer,
    /// per the source spec's example. Comments below mark "// map from X" (authoritative
    /// source field) vs "// hardcoded" (literal constant) per the design spec.
    /// </summary>
    public static object BuildAddEngineerPayload(MunEngineerInfoDto e) => new object[]
    {
        new
        {
            first_name = e.FName,
            last_name = e.LName,
            father_name = "none", // hardcoded
            code_persontype_id = 1, // hardcoded
            national_code = e.NationalId,
            mobile = e.Mob,
            membership_number = e.Ozviat,
            membership_date = e.TarikhSodur,
            renewal_date = e.TarikhSodur, // from TarikhSodur per spec, NOT TarikhTamdid
            membership_expire_date = e.TarikhPayanEtebar,
            license = new object[]
            {
                new
                {
                    license_number = e.Ozviat,
                    license_issue_date = e.TarikhSodur,
                    license_renewal_date = e.TarikhSodur,
                    license_expire_date = e.TarikhPayanEtebar,
                    economic_code = "41123456789", // hardcoded
                    signature_code = "SGN-4589", // hardcoded
                    description = "none", // hardcoded
                    branch = new object[]
                    {
                        new
                        {
                            code_engineeringbase_id = ParseIntOrZero(e.PayehNezaratTemp),
                            code_engineeringbranch_id = 1, // hardcoded
                            code_engineeringtask_id = ParseIntOrZero(e.PesronTyp),
                            issue_date = e.TarikhSodur,
                            expire_date = e.TarikhPayanEtebar,
                        }
                    }
                }
            }
        }
    };

    private static int ParseIntOrZero(string s) => int.TryParse(s, out var v) ? v : 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunFieldMapperTests"`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/Infrastructure/MunSanandaj/MunFieldMapper.cs tests/Application.UnitTests/MunSanandaj/MunFieldMapperTests.cs
git commit -m "feat(mun-sanandaj): add pure field-mapping helpers"
```

---

### Task 4: Gateway HTTP client + response parsers (TDD)

**Files:**
- Create: `src/Infrastructure/MunSanandaj/MunSanandajGatewayClient.cs`
- Test: `tests/Application.UnitTests/MunSanandaj/MunSanandajGatewayClientTests.cs`

**Interfaces:**
- Consumes: `IMunSanandajGatewayClient`, `MunGatewayResult`, `MunAddEngineerResult`, `MunEngMapEngineer` (Task 2); `MunSanandajOptions` (Task 2); `MunFieldMapper.BuildAddEngineerPayload` (Task 3).
- Produces: `internal sealed class MunSanandajGatewayClient : IMunSanandajGatewayClient` with `internal static` pure parsers `ParseSaveEngineerReportResponse(string)`, `ParseSaveEngMapResponse(string)`, `ParseAddEngineerResponse(string)` (all return the DTOs from Task 2) — consumed by `MunSanandajSyncService` (Task 7) via the interface, and directly by this task's tests.

- [ ] **Step 1: Write the failing tests**

`tests/Application.UnitTests/MunSanandaj/MunSanandajGatewayClientTests.cs`:
```csharp
using Mabhas19.Infrastructure.MunSanandaj;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunSanandajGatewayClientTests
{
    [Test]
    public void ParseSaveEngineerReportResponse_success()
    {
        const string raw = """
            {"supervising_engineers_report": {"success": true, "peigiri": 2583267}}
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngineerReportResponse(raw);

        result.Success.ShouldBeTrue();
        result.RemoteSubmissionId.ShouldBe("2583267");
        result.ErrorMessage.ShouldBeNull();
    }

    [Test]
    public void ParseSaveEngMapResponse_top_level_error_is_failed_with_no_engineer_retry()
    {
        const string raw = """
            {"error": "Call to a member function toArray() on null"}
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeFalse();
        result.ErrorMessage.ShouldBe("Call to a member function toArray() on null");
        result.FailedEngineerMessages.ShouldBeNull();
    }

    [Test]
    public void ParseSaveEngMapResponse_engineer_not_found_surfaces_for_addEngineer_retry()
    {
        const string raw = """
            {
                "engineers": {
                    "3732087395": { "success": false, "msg": "مهندس یافت نشد..." }
                },
                "files": { "building": { "success": true, "peigiri": 2581618 } }
            }
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeFalse();
        result.FailedEngineerMessages.ShouldNotBeNull();
        result.FailedEngineerMessages!.ShouldContainKeyAndValue("3732087395", "مهندس یافت نشد...");
    }

    [Test]
    public void ParseSaveEngMapResponse_success_reads_building_peigiri()
    {
        const string raw = """
            {
                "engineers": { "3732087395": { "success": true } },
                "files": { "building": { "success": true, "peigiri": 2581618 } }
            }
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeTrue();
        result.RemoteSubmissionId.ShouldBe("2581618");
        result.FailedEngineerMessages.ShouldBeNull();
    }

    [Test]
    public void ParseAddEngineerResponse_success()
    {
        const string raw = """{"4420716746": {"success": true}}""";

        var result = MunSanandajGatewayClient.ParseAddEngineerResponse(raw);

        result.Success.ShouldBeTrue();
        result.ErrorMessage.ShouldBeNull();
    }

    [Test]
    public void ParseAddEngineerResponse_failure()
    {
        const string raw = """{"success": false, "msg": "invalid national_code (index 0)"}""";

        var result = MunSanandajGatewayClient.ParseAddEngineerResponse(raw);

        result.Success.ShouldBeFalse();
        result.ErrorMessage.ShouldBe("invalid national_code (index 0)");
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunSanandajGatewayClientTests"`
Expected: FAIL — `MunSanandajGatewayClient` does not exist yet (compile error).

- [ ] **Step 3: Implement `MunSanandajGatewayClient`**

`src/Infrastructure/MunSanandaj/MunSanandajGatewayClient.cs`:
```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// The mahyapardaz REST API. Static HttpClient with a long timeout (NOT the DI typed client) so
/// base64 PDF uploads over a slow municipal link bypass Aspire's 10s-per-attempt resilience
/// handler — same fix already applied to ArvanReportAiService for the analogous reason.
/// </summary>
internal sealed class MunSanandajGatewayClient : IMunSanandajGatewayClient
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(120) };

    private const string MahyapardazBase = "https://185.172.68.98/cakephp/mahyapardaz/services/restapi";
    private const string EeshahrBase = "https://eeshahr.sanandaj.ir/cakephp/mahyapardaz/services/restapi";

    private readonly MunSanandajOptions _options;

    public MunSanandajGatewayClient(IOptions<MunSanandajOptions> options)
    {
        _options = options.Value;
    }

    public async Task<MunGatewayResult> SaveEngineerReportAsync(string projectNo, string reqId, string pdfBase64, CancellationToken ct = default)
    {
        var url = $"{MahyapardazBase}?method=saveEngineerReport&darkhast_id={projectNo}&melk_id={reqId}";
        var body = new { supervising_engineers_report = new { file = $"data:image/jpg;base64,{pdfBase64}" } };
        var raw = await PostAsync(url, body, ct);
        return ParseSaveEngineerReportResponse(raw);
    }

    public async Task<MunGatewayResult> SaveEngMapAsync(string projectNo, IReadOnlyList<MunEngMapEngineer> engineers, string pdfBase64, CancellationToken ct = default)
    {
        var url = $"{MahyapardazBase}?method=saveEngMap&darkhast_id={projectNo}";
        var body = new
        {
            engineers = engineers.Select(e => new { code_meli = e.CodeMeli, branch = e.Branch, task = e.Task }),
            engReport = new { file = $"data:image/jpeg;base64,{pdfBase64}" },
        };
        var raw = await PostAsync(url, body, ct);
        return ParseSaveEngMapResponse(raw);
    }

    public async Task<MunAddEngineerResult> AddEngineerAsync(MunEngineerInfoDto engineer, CancellationToken ct = default)
    {
        var url = $"{EeshahrBase}?method=addEngineer";
        var body = MunFieldMapper.BuildAddEngineerPayload(engineer);
        var raw = await PostAsync(url, body, ct);
        return ParseAddEngineerResponse(raw);
    }

    private async Task<string> PostAsync(string url, object body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiToken);
        using var response = await Http.SendAsync(request, ct);
        return await response.Content.ReadAsStringAsync(ct);
    }

    // ------------------------------------------------------------------
    // Pure response parsers (also exercised directly by unit tests)
    // ------------------------------------------------------------------

    internal static MunGatewayResult ParseSaveEngineerReportResponse(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        if (root.TryGetProperty("supervising_engineers_report", out var result)
            && result.TryGetProperty("success", out var successEl) && successEl.GetBoolean())
        {
            var peigiri = result.TryGetProperty("peigiri", out var p) ? p.ToString() : null;
            return new MunGatewayResult(true, peigiri, raw, null, null);
        }

        var error = root.TryGetProperty("error", out var e) ? e.GetString() : "saveEngineerReport failed";
        return new MunGatewayResult(false, null, raw, error, null);
    }

    internal static MunGatewayResult ParseSaveEngMapResponse(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        // Shape 1: top-level error (e.g. invalid darkhast_id).
        if (root.TryGetProperty("error", out var errorEl))
            return new MunGatewayResult(false, null, raw, errorEl.GetString(), null);

        // Shape 2: per-engineer failures inside "engineers" -> caller must addEngineer + retry.
        Dictionary<string, string>? failedEngineers = null;
        if (root.TryGetProperty("engineers", out var engineersEl) && engineersEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in engineersEl.EnumerateObject())
            {
                if (prop.Value.TryGetProperty("success", out var s) && !s.GetBoolean())
                {
                    failedEngineers ??= new Dictionary<string, string>();
                    failedEngineers[prop.Name] = prop.Value.TryGetProperty("msg", out var msg) ? msg.GetString() ?? "" : "";
                }
            }
        }

        if (failedEngineers is not null)
            return new MunGatewayResult(false, null, raw, "one or more engineers not found", failedEngineers);

        // Shape 3: success -> files.building.{success,peigiri}.
        string? submissionId = null;
        if (root.TryGetProperty("files", out var filesEl)
            && filesEl.TryGetProperty("building", out var buildingEl)
            && buildingEl.TryGetProperty("success", out var bs) && bs.GetBoolean()
            && buildingEl.TryGetProperty("peigiri", out var pg))
        {
            submissionId = pg.ToString();
        }

        return new MunGatewayResult(true, submissionId, raw, null, null);
    }

    internal static MunAddEngineerResult ParseAddEngineerResponse(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        // Failure shape: { "success": false, "msg": "..." }
        if (root.TryGetProperty("success", out var successEl) && !successEl.GetBoolean())
        {
            var msg = root.TryGetProperty("msg", out var m) ? m.GetString() : "addEngineer failed";
            return new MunAddEngineerResult(false, msg);
        }

        // Success shape: { "<national_code>": { "success": true } }
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Object
                && prop.Value.TryGetProperty("success", out var s) && s.GetBoolean())
            {
                return new MunAddEngineerResult(true, null);
            }
        }

        return new MunAddEngineerResult(false, $"unexpected addEngineer response shape: {raw}");
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunSanandajGatewayClientTests"`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/Infrastructure/MunSanandaj/MunSanandajGatewayClient.cs tests/Application.UnitTests/MunSanandaj/MunSanandajGatewayClientTests.cs
git commit -m "feat(mun-sanandaj): add mahyapardaz gateway client + response parsers"
```

---

### Task 5: KurdNezam SQL source reader

**Files:**
- Create: `src/Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs`

**Interfaces:**
- Consumes: `IMunSanandajSourceReader`, `MunSourceRowDto`, `MunEngineerInfoDto` (Task 2).
- Produces: `internal sealed class MunSanandajSourceReader : IMunSanandajSourceReader`, constructed from `IConfiguration` reading `ConnectionStrings:KurdNezamDb` — registered in Task 8.

No unit tests here (raw ADO.NET against a real, credentialed, third-party SQL Server — not safe or possible to exercise in CI, consistent with the rest of this codebase's external-DB readers like `FarsNezamProjectProvider` having no unit tests either).

- [ ] **Step 1: Implement**

`src/Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs`:
```csharp
using System.Data;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Mabhas19.Infrastructure.MunSanandaj.Sql;

/// <summary>Read-only access to the KurdNezam SQL Server (ConnectionStrings:KurdNezamDb).</summary>
internal sealed class MunSanandajSourceReader : IMunSanandajSourceReader
{
    private readonly string _connectionString;

    public MunSanandajSourceReader(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("KurdNezamDb")
            ?? throw new InvalidOperationException("ConnectionStrings:KurdNezamDb is not configured.");
    }

    public async Task<IReadOnlyList<MunSourceRowDto>> GetPendingReportsAsync(CancellationToken ct = default)
    {
        var rows = new List<MunSourceRowDto>();
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("[dbo].[WebS_GetListRepToShahrdari]", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new MunSourceRowDto(
                Peygiri: reader["Peygiri"].ToString() ?? string.Empty,
                ProjectNo: reader["ProjectNo"].ToString() ?? string.Empty,
                Nosazi: reader["Nosazi"] == DBNull.Value ? null : reader["Nosazi"].ToString(),
                ReqId: reader["ReqId"].ToString() ?? string.Empty));
        }
        return rows;
    }

    public async Task<IReadOnlyList<MunEngineerInfoDto>> GetEngineersAsync(string peygiri, CancellationToken ct = default)
    {
        var rows = new List<MunEngineerInfoDto>();
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("[dbo].[WebS_GetReportFullInfo]", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("@TraceCode", peygiri);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new MunEngineerInfoDto(
                Ozviat: reader["Ozviat"].ToString() ?? string.Empty,
                ShomarehNezam: reader["ShomarehNezam"].ToString() ?? string.Empty,
                FName: reader["FName"].ToString() ?? string.Empty,
                LName: reader["LName"].ToString() ?? string.Empty,
                TarikhSodur: reader["TarikhSodur"].ToString() ?? string.Empty,
                TarikhTamdid: reader["TarikhTamdid"].ToString() ?? string.Empty,
                TarikhPayanEtebar: reader["TarikhPayanEtebar"].ToString() ?? string.Empty,
                PesronTyp: reader["PesronTyp"].ToString() ?? string.Empty,
                NationalId: reader["NationalId"].ToString() ?? string.Empty,
                Mob: reader["Mob"].ToString() ?? string.Empty,
                PayehNezaratTemp: reader["Payeh_Nezarat_Temp"].ToString() ?? string.Empty,
                Major: reader["Major"].ToString() ?? string.Empty));
        }
        return rows;
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build src/Infrastructure/Infrastructure.csproj`
Expected: 0 errors/warnings. (`Microsoft.Data.SqlClient` is already a transitive package via EF Core's SQL Server provider, already referenced by `Infrastructure.csproj` — no new package needed; confirm by checking the build succeeds without a missing-package error.)

- [ ] **Step 3: Commit**

```bash
git add src/Infrastructure/MunSanandaj/Sql/MunSanandajSourceReader.cs
git commit -m "feat(mun-sanandaj): add KurdNezam SQL source reader (sp1/sp2)"
```

---

### Task 6: PDF fetcher

**Files:**
- Create: `src/Infrastructure/MunSanandaj/MunSanandajPdfFetcher.cs`

**Interfaces:**
- Consumes: `IMunSanandajPdfFetcher` (Task 2).
- Produces: `internal sealed class MunSanandajPdfFetcher : IMunSanandajPdfFetcher` — registered in Task 8, consumed by `MunSanandajSyncService` (Task 7).

- [ ] **Step 1: Implement**

`src/Infrastructure/MunSanandaj/MunSanandajPdfFetcher.cs`:
```csharp
using System.Net;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;

namespace Mabhas19.Infrastructure.MunSanandaj;

internal sealed class MunSanandajPdfFetcher : IMunSanandajPdfFetcher
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };

    public async Task<string?> FetchAsBase64Async(string projectNo, CancellationToken ct = default)
    {
        var url = $"https://eservice.kurdnezam.ir/sm/pdf/{projectNo}.pdf";
        using var response = await Http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        return Convert.ToBase64String(bytes);
    }
}
```

- [ ] **Step 2: Build and commit**

Run: `dotnet build src/Infrastructure/Infrastructure.csproj`
Expected: 0 errors/warnings.

```bash
git add src/Infrastructure/MunSanandaj/MunSanandajPdfFetcher.cs
git commit -m "feat(mun-sanandaj): add PDF fetch-and-base64-encode helper"
```

---

### Task 7: Sync service orchestration (TDD on the row-processing logic)

**Files:**
- Create: `src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs`
- Test: `tests/Application.UnitTests/MunSanandaj/MunSanandajSyncServiceTests.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (`MunSyncRuns`/`MunReportLogs`, Task 1), `IMunSanandajSourceReader`/`IMunSanandajGatewayClient` (Task 2), `IMunSanandajPdfFetcher` (Task 6), `MunFieldMapper.ToEngMapEngineer` (Task 3).
- Produces: `internal sealed class MunSanandajSyncService : IMunSanandajSyncService`, with two `internal` row-processing methods (`ProcessSaveEngineerReportRowAsync`, `ProcessSaveEngMapRowAsync`) that this task's tests exercise directly (via `InternalsVisibleTo("Mabhas19.Application.UnitTests")`, already declared in `Infrastructure.csproj` for the `ArvanReportAiServiceTests` precedent — no csproj change needed). Registered in Task 8; called by the two workers (Task 8) and the `Runs` endpoint (Task 9).

The DB-touching outer loop (`RunAsync`: create the run row, skip already-succeeded Peygiris, append log rows, close out the run) is **not unit-tested** — this codebase has no EF InMemory/SQLite test infrastructure anywhere (verified: no `UseInMemoryDatabase`/`UseSqlite` in `tests/`), and other `IApplicationDbContext`-touching Infrastructure services (e.g. `AuditLogger`) are likewise untested at the unit level. The addEngineer-then-retry control flow — the actually error-prone part — is covered by testing the two `internal` row processors directly against mocked `IMunSanandajSourceReader`/`IMunSanandajGatewayClient`/`IMunSanandajPdfFetcher`, with no DB involved.

- [ ] **Step 1: Write the failing tests**

`tests/Application.UnitTests/MunSanandaj/MunSanandajSyncServiceTests.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunSanandajSyncServiceTests
{
    private Mock<IMunSanandajSourceReader> _reader = null!;
    private Mock<IMunSanandajGatewayClient> _gateway = null!;
    private Mock<IMunSanandajPdfFetcher> _pdfFetcher = null!;
    private MunSanandajSyncService _sut = null!;

    private static readonly MunSourceRowDto Row = new("90038565090216074508", "90038565", "-", "418162");

    private static readonly MunEngineerInfoDto Engineer = new(
        Ozviat: "1499", ShomarehNezam: "22-10-01079", FName: "حمید", LName: "پارسا",
        TarikhSodur: "1404/04/04", TarikhTamdid: "1404/05/05", TarikhPayanEtebar: "1405/04/04",
        PesronTyp: "1", NationalId: "3732087395", Mob: "9133240295", PayehNezaratTemp: "3", Major: "1");

    [SetUp]
    public void SetUp()
    {
        _reader = new Mock<IMunSanandajSourceReader>();
        _gateway = new Mock<IMunSanandajGatewayClient>();
        _pdfFetcher = new Mock<IMunSanandajPdfFetcher>();
        _pdfFetcher.Setup(f => f.FetchAsBase64Async(Row.ProjectNo, It.IsAny<CancellationToken>()))
            .ReturnsAsync("cGRmYnl0ZXM=");

        _sut = new MunSanandajSyncService(
            Mock.Of<IApplicationDbContext>(),
            _reader.Object,
            _gateway.Object,
            _pdfFetcher.Object,
            Mock.Of<ILogger<MunSanandajSyncService>>());
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_pdf_not_found_fails_without_calling_gateway()
    {
        _pdfFetcher.Setup(f => f.FetchAsBase64Async(Row.ProjectNo, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var (status, _, _, _, error, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Failed);
        error.ShouldBe("pdf not found");
        _gateway.Verify(g => g.SaveEngineerReportAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_success_passes_through_gateway_result()
    {
        _gateway.Setup(g => g.SaveEngineerReportAsync(Row.ProjectNo, Row.ReqId, "cGRmYnl0ZXM=", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(true, "2583267", "{}", null, null));

        var (status, _, remoteId, _, _, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Success);
        remoteId.ShouldBe("2583267");
    }

    [Test]
    public async Task ProcessSaveEngMapRowAsync_engineer_not_found_creates_then_retries_and_succeeds()
    {
        _reader.Setup(r => r.GetEngineersAsync(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MunEngineerInfoDto> { Engineer });

        _gateway.SetupSequence(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(false, null, "{}", "one or more engineers not found",
                new Dictionary<string, string> { ["3732087395"] = "مهندس یافت نشد..." }))
            .ReturnsAsync(new MunGatewayResult(true, "2581618", "{}", null, null));

        _gateway.Setup(g => g.AddEngineerAsync(Engineer, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunAddEngineerResult(true, null));

        var (status, _, remoteId, _, _, createdCodes) = await _sut.ProcessSaveEngMapRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Success);
        remoteId.ShouldBe("2581618");
        createdCodes.ShouldBe("3732087395");
        _gateway.Verify(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        _gateway.Verify(g => g.AddEngineerAsync(Engineer, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ProcessSaveEngMapRowAsync_top_level_error_fails_without_addEngineer()
    {
        _reader.Setup(r => r.GetEngineersAsync(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MunEngineerInfoDto> { Engineer });

        _gateway.Setup(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(false, null, "{}", "Call to a member function toArray() on null", null));

        var (status, _, _, _, error, _) = await _sut.ProcessSaveEngMapRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Failed);
        error.ShouldBe("Call to a member function toArray() on null");
        _gateway.Verify(g => g.AddEngineerAsync(It.IsAny<MunEngineerInfoDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunSanandajSyncServiceTests"`
Expected: FAIL — `MunSanandajSyncService` does not exist yet (compile error).

- [ ] **Step 3: Implement `MunSanandajSyncService`**

`src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Infrastructure.MunSanandaj;

internal sealed class MunSanandajSyncService : IMunSanandajSyncService
{
    private readonly IApplicationDbContext _context;
    private readonly IMunSanandajSourceReader _reader;
    private readonly IMunSanandajGatewayClient _gateway;
    private readonly IMunSanandajPdfFetcher _pdfFetcher;
    private readonly ILogger<MunSanandajSyncService> _logger;

    public MunSanandajSyncService(
        IApplicationDbContext context,
        IMunSanandajSourceReader reader,
        IMunSanandajGatewayClient gateway,
        IMunSanandajPdfFetcher pdfFetcher,
        ILogger<MunSanandajSyncService> logger)
    {
        _context = context;
        _reader = reader;
        _gateway = gateway;
        _pdfFetcher = pdfFetcher;
        _logger = logger;
    }

    public Task<Guid> RunSaveEngineerReportAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default)
        => RunAsync(MunWorkerType.SaveEngineerReport, trigger, triggeredByUser, ProcessSaveEngineerReportRowAsync, ct);

    public Task<Guid> RunSaveEngMapAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default)
        => RunAsync(MunWorkerType.SaveEngMap, trigger, triggeredByUser, ProcessSaveEngMapRowAsync, ct);

    private async Task<Guid> RunAsync(
        MunWorkerType workerType,
        MunRunTrigger trigger,
        string? triggeredByUser,
        Func<MunSourceRowDto, int, CancellationToken, Task<RowResult>> processRow,
        CancellationToken ct)
    {
        var run = new MunSyncRun
        {
            RunId = Guid.NewGuid(),
            WorkerType = workerType,
            StartedAt = DateTimeOffset.UtcNow,
            Status = MunRunStatus.Running,
            TriggeredBy = trigger,
            TriggeredByUser = triggeredByUser,
        };
        _context.MunSyncRuns.Add(run);
        await _context.SaveChangesAsync(ct);

        try
        {
            var rows = await _reader.GetPendingReportsAsync(ct);
            run.TotalRows = rows.Count;

            foreach (var row in rows)
            {
                var latestAttempt = await _context.MunReportLogs
                    .Where(l => l.WorkerType == workerType && l.Peygiri == row.Peygiri)
                    .OrderByDescending(l => l.Id)
                    .FirstOrDefaultAsync(ct);

                if (latestAttempt?.Status == MunLogStatus.Success)
                {
                    run.SuccessCount++;
                    continue;
                }

                var attemptNumber = (latestAttempt?.AttemptNumber ?? 0) + 1;
                var startedAt = DateTimeOffset.UtcNow;
                var result = await processRow(row, attemptNumber, ct);

                _context.MunReportLogs.Add(new MunReportLog
                {
                    RunId = run.Id,
                    WorkerType = workerType,
                    Peygiri = row.Peygiri,
                    ProjectNo = row.ProjectNo,
                    ReqId = row.ReqId,
                    Nosazi = row.Nosazi,
                    Status = result.Status,
                    AttemptNumber = attemptNumber,
                    RemoteSubmissionId = result.RemoteSubmissionId,
                    ResponseBody = result.RawResponse,
                    ErrorMessage = result.ErrorMessage,
                    CreatedEngineerCodes = result.CreatedEngineerCodes,
                    StartedAt = startedAt,
                    CompletedAt = DateTimeOffset.UtcNow,
                });

                if (result.Status == MunLogStatus.Success) run.SuccessCount++;
                else run.FailedCount++;

                await _context.SaveChangesAsync(ct);
            }

            run.Status = MunRunStatus.Completed;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MunSanandaj {WorkerType} run {RunId} failed", workerType, run.RunId);
            run.Status = MunRunStatus.Failed;
        }
        finally
        {
            run.CompletedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(ct);
        }

        return run.RunId;
    }

    /// <summary>Internal (not private) so unit tests can exercise the addEngineer-then-retry
    /// control flow directly, without a database.</summary>
    internal async Task<RowResult> ProcessSaveEngineerReportRowAsync(MunSourceRowDto row, int attemptNumber, CancellationToken ct)
    {
        var pdfBase64 = await _pdfFetcher.FetchAsBase64Async(row.ProjectNo, ct);
        if (pdfBase64 is null)
            return RowResult.Failed(attemptNumber, "pdf not found");

        var result = await _gateway.SaveEngineerReportAsync(row.ProjectNo, row.ReqId, pdfBase64, ct);
        return result.Success
            ? RowResult.Succeeded(attemptNumber, result.RemoteSubmissionId, result.RawResponse)
            : RowResult.Failed(attemptNumber, result.ErrorMessage, result.RawResponse);
    }

    internal async Task<RowResult> ProcessSaveEngMapRowAsync(MunSourceRowDto row, int attemptNumber, CancellationToken ct)
    {
        var engineerInfos = await _reader.GetEngineersAsync(row.Peygiri, ct);
        if (engineerInfos.Count == 0)
            return RowResult.Failed(attemptNumber, "no engineers found for Peygiri");

        var pdfBase64 = await _pdfFetcher.FetchAsBase64Async(row.ProjectNo, ct);
        if (pdfBase64 is null)
            return RowResult.Failed(attemptNumber, "pdf not found");

        var engineersByCode = engineerInfos.ToDictionary(e => e.NationalId);
        var engMapEngineers = engineerInfos.Select(MunFieldMapper.ToEngMapEngineer).ToList();

        var result = await _gateway.SaveEngMapAsync(row.ProjectNo, engMapEngineers, pdfBase64, ct);
        if (result.Success)
            return RowResult.Succeeded(attemptNumber, result.RemoteSubmissionId, result.RawResponse);

        if (result.FailedEngineerMessages is { Count: > 0 } failed)
        {
            var createdCodes = new List<string>();
            foreach (var codeMeli in failed.Keys)
            {
                if (!engineersByCode.TryGetValue(codeMeli, out var engineerInfo)) continue;
                var addResult = await _gateway.AddEngineerAsync(engineerInfo, ct);
                if (addResult.Success) createdCodes.Add(codeMeli);
            }

            if (createdCodes.Count > 0)
            {
                var retryResult = await _gateway.SaveEngMapAsync(row.ProjectNo, engMapEngineers, pdfBase64, ct);
                return retryResult.Success
                    ? RowResult.Succeeded(attemptNumber, retryResult.RemoteSubmissionId, retryResult.RawResponse, string.Join(",", createdCodes))
                    : RowResult.Failed(attemptNumber, retryResult.ErrorMessage, retryResult.RawResponse, string.Join(",", createdCodes));
            }
        }

        return RowResult.Failed(attemptNumber, result.ErrorMessage, result.RawResponse);
    }

    /// <summary>Deconstructable result of processing one source row — kept as a nominal type
    /// (rather than a long value-tuple) so the two processors and their tests stay readable.</summary>
    internal readonly record struct RowResult(
        MunLogStatus Status,
        int AttemptNumber,
        string? RemoteSubmissionId,
        string RawResponse,
        string? ErrorMessage,
        string? CreatedEngineerCodes)
    {
        public static RowResult Succeeded(int attemptNumber, string? remoteSubmissionId, string rawResponse, string? createdEngineerCodes = null) =>
            new(MunLogStatus.Success, attemptNumber, remoteSubmissionId, rawResponse, null, createdEngineerCodes);

        public static RowResult Failed(int attemptNumber, string? errorMessage, string rawResponse = "", string? createdEngineerCodes = null) =>
            new(MunLogStatus.Failed, attemptNumber, null, rawResponse, errorMessage, createdEngineerCodes);

        // No hand-written Deconstruct: a positional record struct already auto-generates one
        // matching the primary constructor's parameter list — adding another here would collide.
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter "FullyQualifiedName~MunSanandajSyncServiceTests"`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs tests/Application.UnitTests/MunSanandaj/MunSanandajSyncServiceTests.cs
git commit -m "feat(mun-sanandaj): add sync-service orchestration + addEngineer retry flow"
```

---

### Task 8: Background workers + DI wiring + config placeholders

**Files:**
- Create: `src/Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs`, `src/Infrastructure/MunSanandaj/SaveEngMapWorker.cs`
- Modify: `src/Infrastructure/DependencyInjection.cs`
- Modify: `src/Web/appsettings.json`

**Interfaces:**
- Consumes: `IMunSanandajSyncService` (Task 7), `MunSanandajOptions` (Task 2), all `MunSanandaj` interfaces/implementations from Tasks 2/4/5/6/7.
- Produces: registered DI services consumed by the `Runs`/`Logs` endpoints (Task 9/10).

- [ ] **Step 1: Implement the two workers**

`src/Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>Runs the saveEngineerReport sync every MunSanandaj:IntervalHours (default 12h).</summary>
internal sealed class SaveEngineerReportWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MunSanandajOptions _options;
    private readonly ILogger<SaveEngineerReportWorker> _logger;

    public SaveEngineerReportWorker(IServiceScopeFactory scopeFactory, IOptions<MunSanandajOptions> options, ILogger<SaveEngineerReportWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(_options.IntervalHours));
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IMunSanandajSyncService>();
                await syncService.RunSaveEngineerReportAsync(MunRunTrigger.Timer, triggeredByUser: null, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "SaveEngineerReportWorker tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
```

`src/Infrastructure/MunSanandaj/SaveEngMapWorker.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>Runs the saveEngMap sync every MunSanandaj:IntervalHours (default 12h).</summary>
internal sealed class SaveEngMapWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MunSanandajOptions _options;
    private readonly ILogger<SaveEngMapWorker> _logger;

    public SaveEngMapWorker(IServiceScopeFactory scopeFactory, IOptions<MunSanandajOptions> options, ILogger<SaveEngMapWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(_options.IntervalHours));
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IMunSanandajSyncService>();
                await syncService.RunSaveEngMapAsync(MunRunTrigger.Timer, triggeredByUser: null, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "SaveEngMapWorker tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
```

- [ ] **Step 2: Wire DI (gated on `ConnectionStrings:KurdNezamDb`)**

Edit `src/Infrastructure/DependencyInjection.cs` — add these usings near the top:
```csharp
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj.Sql;
```

Add this block inside `AddMabhas19Services`, right after the `// Analytics module (...)` line (`services.AddAnalyticsServices(config);`):
```csharp
        // MunSanandaj integration (KurdNezam SQL -> mahyapardaz REST). Gated off entirely when
        // ConnectionStrings:KurdNezamDb is empty, mirroring the AnalyticsDb/FarsNezamDb pattern —
        // so local dev/CI never fails for lacking this external, credentialed municipal DB.
        var kurdNezamCs = config.GetConnectionString("KurdNezamDb") ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(kurdNezamCs))
        {
            services.Configure<MunSanandajOptions>(config.GetSection(MunSanandajOptions.SectionName));
            services.AddSingleton<IMunSanandajSourceReader, MunSanandajSourceReader>();
            services.AddSingleton<IMunSanandajGatewayClient, MunSanandajGatewayClient>();
            services.AddSingleton<IMunSanandajPdfFetcher, MunSanandajPdfFetcher>();
            services.AddScoped<IMunSanandajSyncService, MunSanandajSyncService>();
            services.AddHostedService<SaveEngineerReportWorker>();
            services.AddHostedService<SaveEngMapWorker>();
        }
```

Note: `IMunSanandajSourceReader`/`IMunSanandajGatewayClient`/`IMunSanandajPdfFetcher` are registered `Singleton` (they hold no per-request state — `MunSanandajSourceReader` opens/closes its own `SqlConnection` per call, the other two use static `HttpClient`s), while `IMunSanandajSyncService` is `Scoped` because it depends on `IApplicationDbContext`, which is itself `Scoped`.

- [ ] **Step 3: Add config placeholders**

Edit `src/Web/appsettings.json` — add `"KurdNezamDb": ""` to the `ConnectionStrings` object (after `"AnalyticsDb": ""`):
```json
  "ConnectionStrings": {
    "Mabhas19Db": "",
    "FarsNezamDb": "",
    "AnalyticsDb": "",
    "KurdNezamDb": ""
  },
```

Add a new top-level `"MunSanandaj"` section (e.g. after the `"AnalyticsAi"` block):
```json
  "MunSanandaj": {
    "ApiToken": "",
    "IntervalHours": 12
  },
```

- [ ] **Step 4: Build**

Run: `dotnet build Mabhas19.slnx`
Expected: 0 errors/warnings.

- [ ] **Step 5: Run the full test suite**

Run: `dotnet test`
Expected: all prior tests still pass, including the 12 new `MunSanandaj` tests from Tasks 3/4/7 (2 + 6 + 4).

- [ ] **Step 6: Commit**

```bash
git add src/Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs src/Infrastructure/MunSanandaj/SaveEngMapWorker.cs src/Infrastructure/DependencyInjection.cs src/Web/appsettings.json
git commit -m "feat(mun-sanandaj): add 12h background workers + gated DI wiring"
```

---

### Task 9: `Runs` API endpoints

**Files:**
- Create: `src/Web/Endpoints/MunSanandaj/Runs.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Task 1), `IMunSanandajSyncService` (Task 7), `MunWorkerType`/`MunRunTrigger` (Task 1).
- Produces: `GET /api/MunSanandaj/Runs`, `GET /api/MunSanandaj/Runs/{runId:guid}`, `POST /api/MunSanandaj/Runs/{workerType}/trigger`; `MunSyncRunDto`, `MunReportLogDto`, `MunRunDetailDto` — consumed by `mun-sanandaj-web`'s dashboard (Task 14).

Auto-mapped route prefix defaults to `/api/{ClassName}` (see `src/Web/Infrastructure/IEndpointGroup.cs`) — every existing `Analytics` endpoint (e.g. `Dashboards.cs`, `SemanticModels.cs`) actually relies on this default and maps flat (`/api/Dashboards`, not `/api/Analytics/Dashboards`), none of them override `RoutePrefix`. Since a class named `Runs` would otherwise default to `/api/Runs`, this task explicitly overrides `RoutePrefix` to get `/api/MunSanandaj/Runs` instead — confirmed safe because `WebApplicationExtensions.MapEndpoints` reads it via `type.GetProperty(nameof(IEndpointGroup.RoutePrefix))?.GetValue(null)`, and the no-`BindingFlags` overload of `Type.GetProperty` searches `Type.DefaultLookup` (`Public | Instance | Static`), so a plain `public static string? RoutePrefix => "...";` on the class is found and used.

- [ ] **Step 1: Implement**

`src/Web/Endpoints/MunSanandaj/Runs.cs`:
```csharp
using System.Security.Claims;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Web.Endpoints.MunSanandaj;

/// <summary>Sync-run status for the mun-sanandaj-web dashboard. Auto-mapped to <c>/api/MunSanandaj/Runs</c>.</summary>
public class Runs : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/MunSanandaj/Runs";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetRuns, string.Empty);
        groupBuilder.MapGet(GetRun, "{runId:guid}");
        groupBuilder.MapPost(TriggerRun, "{workerType}/trigger");
    }

    public static async Task<Ok<IReadOnlyList<MunSyncRunDto>>> GetRuns(IApplicationDbContext context, CancellationToken ct)
    {
        // Inline the projection (not a call to the ToDto helper below) — EF Core's SQL Server
        // provider cannot translate a call to an arbitrary user-defined static method inside
        // .Select() over IQueryable; ToDto is only safe to use against already-materialized entities.
        var runs = await context.MunSyncRuns
            .OrderByDescending(r => r.StartedAt)
            .Take(20)
            .Select(r => new MunSyncRunDto(
                r.RunId, r.WorkerType.ToString(), r.StartedAt, r.CompletedAt, r.Status.ToString(),
                r.TotalRows, r.SuccessCount, r.FailedCount, r.TriggeredBy.ToString(), r.TriggeredByUser))
            .ToListAsync(ct);
        return TypedResults.Ok((IReadOnlyList<MunSyncRunDto>)runs);
    }

    public static async Task<Results<Ok<MunRunDetailDto>, NotFound>> GetRun(IApplicationDbContext context, Guid runId, CancellationToken ct)
    {
        var run = await context.MunSyncRuns.FirstOrDefaultAsync(r => r.RunId == runId, ct);
        if (run is null) return TypedResults.NotFound();

        var logs = await context.MunReportLogs
            .Where(l => l.RunId == run.Id)
            .OrderByDescending(l => l.Id)
            .Select(l => new MunReportLogDto(
                l.Id, l.Peygiri, l.ProjectNo, l.ReqId, l.Nosazi, l.Status.ToString(),
                l.AttemptNumber, l.RemoteSubmissionId, l.ErrorMessage, l.CreatedEngineerCodes,
                l.StartedAt, l.CompletedAt))
            .ToListAsync(ct);

        return TypedResults.Ok(new MunRunDetailDto(ToDto(run), logs));
    }

    public static async Task<Results<Ok<MunSyncRunDto>, BadRequest<string>>> TriggerRun(
        IMunSanandajSyncService syncService, IApplicationDbContext context, HttpContext httpContext, string workerType, CancellationToken ct)
    {
        if (!Enum.TryParse<MunWorkerType>(workerType, ignoreCase: true, out var type))
            return TypedResults.BadRequest("workerType must be 'SaveEngineerReport' or 'SaveEngMap'.");

        var triggeredByUser = httpContext.User.FindFirstValue("email") ?? httpContext.User.FindFirstValue("name");

        var runId = type == MunWorkerType.SaveEngineerReport
            ? await syncService.RunSaveEngineerReportAsync(MunRunTrigger.Manual, triggeredByUser, ct)
            : await syncService.RunSaveEngMapAsync(MunRunTrigger.Manual, triggeredByUser, ct);

        var run = await context.MunSyncRuns.FirstAsync(r => r.RunId == runId, ct);
        return TypedResults.Ok(ToDto(run));
    }

    private static MunSyncRunDto ToDto(MunSyncRun r) => new(
        r.RunId, r.WorkerType.ToString(), r.StartedAt, r.CompletedAt, r.Status.ToString(),
        r.TotalRows, r.SuccessCount, r.FailedCount, r.TriggeredBy.ToString(), r.TriggeredByUser);
}

public sealed record MunSyncRunDto(
    Guid RunId, string WorkerType, DateTimeOffset StartedAt, DateTimeOffset? CompletedAt,
    string Status, int TotalRows, int SuccessCount, int FailedCount, string TriggeredBy, string? TriggeredByUser);

public sealed record MunReportLogDto(
    int Id, string Peygiri, string ProjectNo, string ReqId, string? Nosazi, string Status,
    int AttemptNumber, string? RemoteSubmissionId, string? ErrorMessage, string? CreatedEngineerCodes,
    DateTimeOffset StartedAt, DateTimeOffset CompletedAt);

public sealed record MunRunDetailDto(MunSyncRunDto Run, IReadOnlyList<MunReportLogDto> Logs);
```

- [ ] **Step 2: Build**

Run: `dotnet build src/Web/Web.csproj`
Expected: 0 errors/warnings.

- [ ] **Step 3: Manual smoke check**

Run: `dotnet run --project src/Web` (with `docker compose -f deploy/docker-compose.dev.yml up -d` already running), then open `http://localhost:5000/scalar` and confirm `GET /api/MunSanandaj/Runs`, `GET /api/MunSanandaj/Runs/{runId}`, and `POST /api/MunSanandaj/Runs/{workerType}/trigger` are listed (they'll 401 without a bearer token — that's expected; this just confirms the routes registered).

- [ ] **Step 4: Commit**

```bash
git add src/Web/Endpoints/MunSanandaj/Runs.cs
git commit -m "feat(mun-sanandaj): add Runs API endpoints (list/detail/trigger)"
```

---

### Task 10: `Logs` API endpoint

**Files:**
- Create: `src/Web/Endpoints/MunSanandaj/Logs.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Task 1), `MunReportLogDto` (Task 9).
- Produces: `GET /api/MunSanandaj/Logs?workerType=&status=&peygiri=&projectNo=&from=&to=&page=&pageSize=` — consumed by `mun-sanandaj-web`'s Logs page (Task 15).

- [ ] **Step 1: Implement**

`src/Web/Endpoints/MunSanandaj/Logs.cs`:
```csharp
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Web.Endpoints.MunSanandaj;

/// <summary>Paginated, filterable mun_report_logs history. Auto-mapped to <c>/api/MunSanandaj/Logs</c>.</summary>
public class Logs : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/MunSanandaj/Logs";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));
        groupBuilder.MapGet(GetLogs, string.Empty);
    }

    public static async Task<Ok<MunReportLogPageDto>> GetLogs(
        IApplicationDbContext context,
        CancellationToken ct,
        string? workerType = null,
        string? status = null,
        string? peygiri = null,
        string? projectNo = null,
        DateTimeOffset? from = null,
        DateTimeOffset? to = null,
        int page = 1,
        int pageSize = 50)
    {
        var query = context.MunReportLogs.AsQueryable();

        if (Enum.TryParse<MunWorkerType>(workerType, ignoreCase: true, out var wt))
            query = query.Where(l => l.WorkerType == wt);
        if (Enum.TryParse<MunLogStatus>(status, ignoreCase: true, out var st))
            query = query.Where(l => l.Status == st);
        if (!string.IsNullOrWhiteSpace(peygiri))
            query = query.Where(l => l.Peygiri.Contains(peygiri));
        if (!string.IsNullOrWhiteSpace(projectNo))
            query = query.Where(l => l.ProjectNo.Contains(projectNo));
        if (from is not null)
            query = query.Where(l => l.StartedAt >= from);
        if (to is not null)
            query = query.Where(l => l.StartedAt <= to);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.Id)
            .Skip((Math.Max(page, 1) - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new MunReportLogDto(
                l.Id, l.Peygiri, l.ProjectNo, l.ReqId, l.Nosazi, l.Status.ToString(),
                l.AttemptNumber, l.RemoteSubmissionId, l.ErrorMessage, l.CreatedEngineerCodes,
                l.StartedAt, l.CompletedAt))
            .ToListAsync(ct);

        return TypedResults.Ok(new MunReportLogPageDto(items, total, page, pageSize));
    }
}

public sealed record MunReportLogPageDto(IReadOnlyList<MunReportLogDto> Items, int Total, int Page, int PageSize);
```

- [ ] **Step 2: Build and commit**

Run: `dotnet build src/Web/Web.csproj`
Expected: 0 errors/warnings.

```bash
git add src/Web/Endpoints/MunSanandaj/Logs.cs
git commit -m "feat(mun-sanandaj): add paginated Logs API endpoint"
```

---

### Task 11: Frontend scaffold — `mun-sanandaj-web` tooling

**Files:**
- Create: `mun-sanandaj-web/package.json`, `mun-sanandaj-web/vite.config.ts`, `mun-sanandaj-web/tsconfig.json`, `mun-sanandaj-web/tsconfig.node.json`, `mun-sanandaj-web/index.html`, `mun-sanandaj-web/src/main.tsx`, `mun-sanandaj-web/.gitignore`

**Interfaces:**
- Produces: a buildable Vite/React/TS project skeleton that Tasks 12-15 add source files to.

- [ ] **Step 1: `package.json`**

`mun-sanandaj-web/package.json`:
```json
{
  "name": "mun-sanandaj-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "lint": "eslint . --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ant-design/icons": "^5.5.0",
    "@tanstack/react-query": "^5.59.0",
    "antd": "^5.21.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.2",
    "framer-motion": "^11.11.0",
    "oidc-client-ts": "^3.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "@typescript-eslint/parser": "^8.8.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.12",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: `vite.config.ts`**

`mun-sanandaj-web/vite.config.ts`:
```typescript
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
});
```

- [ ] **Step 3: TypeScript configs**

`mun-sanandaj-web/tsconfig.json`:
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
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

`mun-sanandaj-web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "noEmit": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: `index.html` + `main.tsx` + `.gitignore`**

`mun-sanandaj-web/index.html`:
```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title> وب سرویس شهرداری سنندج  </title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`mun-sanandaj-web/src/main.tsx` (placeholder render — Task 12 replaces `App` with the real router):
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`mun-sanandaj-web/.gitignore`:
```
node_modules
dist
.env
```

`mun-sanandaj-web/src/app/App.tsx` (temporary placeholder so `npm run build` succeeds until Task 12 provides the real `App`):
```tsx
export function App() {
  return <div>mun-sanandaj-web</div>;
}
```

- [ ] **Step 5: Install and build**

Run:
```bash
cd mun-sanandaj-web && npm install && npm run build
```
Expected: install succeeds, `npm run build` (typecheck + vite build) succeeds, producing `mun-sanandaj-web/dist/`.

- [ ] **Step 6: Commit**

```bash
git add mun-sanandaj-web/package.json mun-sanandaj-web/package-lock.json mun-sanandaj-web/vite.config.ts mun-sanandaj-web/tsconfig.json mun-sanandaj-web/tsconfig.node.json mun-sanandaj-web/index.html mun-sanandaj-web/src/main.tsx mun-sanandaj-web/src/app/App.tsx mun-sanandaj-web/.gitignore
git commit -m "feat(mun-sanandaj-web): scaffold Vite/React/TS project"
```

---

### Task 12: Frontend OIDC auth + router

**Files:**
- Create: `mun-sanandaj-web/src/auth/oidc.ts`, `mun-sanandaj-web/src/auth/AuthProvider.tsx`, `mun-sanandaj-web/src/auth/useAuth.ts`, `mun-sanandaj-web/src/auth/routes.tsx`
- Create: `mun-sanandaj-web/src/app/providers.tsx`, `mun-sanandaj-web/src/app/router.tsx`
- Modify: `mun-sanandaj-web/src/app/App.tsx`
- Modify: `mun-sanandaj-web/.env.example` (create), for local dev without a real IdP client yet

**Interfaces:**
- Produces: `useAuth() : { user, isAdmin, ready, login, logout }`; route components `LoginScreen`, `OidcCallback`, `OidcSilentCallback`, `LogoutScreen`, `ForbiddenScreen`, `RequireAuth`, `RequireAdmin` — consumed by `router.tsx` and, indirectly, by Tasks 13-15's pages (which render inside `RequireAuth`+`RequireAdmin`).

This mirrors `analytics-web/src/auth/*` (same `oidc-client-ts` PKCE setup) but is simplified: mun-sanandaj-web has exactly one gate (`Administrator` role), not `analytics-web`'s 7-role/8-permission matrix — so there is no `contracts/rbac.ts` equivalent here.

- [ ] **Step 1: `oidc.ts`**

`mun-sanandaj-web/src/auth/oidc.ts`:
```typescript
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

let _userManager: UserManager | undefined;

export function getUserManager(): UserManager {
  if (!_userManager) {
    const origin = window.location.origin;
    _userManager = new UserManager({
      authority: import.meta.env.VITE_AUTH_AUTHORITY as string,
      client_id: import.meta.env.VITE_AUTH_CLIENT_ID ?? "mun-sanandaj-web",
      redirect_uri: `${origin}/auth/callback`,
      silent_redirect_uri: `${origin}/auth/silent`,
      post_logout_redirect_uri: origin,
      response_type: "code",
      scope: import.meta.env.VITE_AUTH_SCOPE ?? "openid profile email roles mabhas19.api",
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
    });
  }
  return _userManager;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export function sessionUserFromOidc(u: User): SessionUser {
  const p = u.profile as Record<string, unknown>;
  const rawRoles = p["role"] ?? p["roles"];
  const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : [];
  return {
    id: (p["sub"] as string) ?? "",
    name: (p["name"] as string) ?? (p["email"] as string) ?? "کاربر",
    email: (p["email"] as string) ?? "",
    isAdmin: roles.includes("Administrator"),
  };
}
```

- [ ] **Step 2: `AuthProvider.tsx` + `useAuth.ts`**

`mun-sanandaj-web/src/auth/useAuth.ts`:
```typescript
import { createContext, useContext } from "react";
import type { SessionUser } from "./oidc";

export interface AuthValue {
  user: SessionUser | null;
  isAdmin: boolean;
  ready: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue | undefined>(undefined);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

`mun-sanandaj-web/src/auth/AuthProvider.tsx` (same event-subscription fix already proven necessary in `analytics-web` — see `analytics-web/src/auth/AuthProvider.tsx` — applied here from the start rather than discovered later):
```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthValue } from "./useAuth";
import { getUserManager, sessionUserFromOidc, type SessionUser } from "./oidc";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const mgr = getUserManager();
    const apply = (u: User | null) => {
      if (alive) setUser(u && !u.expired ? sessionUserFromOidc(u) : null);
    };

    void (async () => {
      const u = await mgr.getUser();
      if (!alive) return;
      apply(u);
      setReady(true);
    })();

    const onLoaded = (u: User) => apply(u);
    const onUnloaded = () => {
      if (alive) setUser(null);
    };
    mgr.events.addUserLoaded(onLoaded);
    mgr.events.addUserUnloaded(onUnloaded);

    return () => {
      alive = false;
      mgr.events.removeUserLoaded(onLoaded);
      mgr.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const login = useCallback(() => {
    void getUserManager().signinRedirect();
  }, []);

  const logout = useCallback(() => {
    void getUserManager().signoutRedirect();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, isAdmin: user?.isAdmin ?? false, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 3: `routes.tsx`**

`mun-sanandaj-web/src/auth/routes.tsx` (ref-guarded `OidcCallback`, same fix as `analytics-web/src/auth/routes.tsx`, applied from the start):
```tsx
import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Button, Card, Result, Spin, Typography } from "antd";
import { useAuth } from "./useAuth";
import { getUserManager } from "./oidc";

export function LoginScreen() {
  const { login, user, ready } = useAuth();
  if (ready && user) return <Navigate to="/" replace />;
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card variant="borderless" style={{ width: 360 }} styles={{ body: { padding: 40, textAlign: "center" } }}>
        <Typography.Title level={3} style={{ marginBottom: 8 }}>
          وب سرویس شهرداری سنندج
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 32 }}>
          برای ورود به حساب خود ادامه دهید
        </Typography.Text>
        <Button type="primary" size="large" block onClick={login}>
          ورود
        </Button>
      </Card>
    </div>
  );
}

export function OidcCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    getUserManager()
      .signinRedirectCallback()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("ورود ناموفق بود"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Result status="error" title={error} />;
  return <Spin tip="در حال ورود…" fullscreen />;
}

export function OidcSilentCallback() {
  useEffect(() => {
    getUserManager()
      .signinSilentCallback()
      .catch(() => {
        /* silent renew failed; ignore — interactive login still works */
      });
  }, []);
  return null;
}

export function LogoutScreen() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
  }, [logout]);
  return <Result title="خارج شدید" />;
}

export function ForbiddenScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Result status="403" title="403" subTitle="دسترسی محدود به مدیران سیستم است" />
    </div>
  );
}

export function RequireAuth() {
  const { ready, user } = useAuth();
  if (!ready) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { ready, isAdmin } = useAuth();
  if (!ready) return <Spin fullscreen />;
  return isAdmin ? <Outlet /> : <Navigate to="/403" replace />;
}
```

- [ ] **Step 4: `providers.tsx` + `router.tsx` + wire `App.tsx`**

`mun-sanandaj-web/src/app/providers.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import { AuthProvider } from "../auth/AuthProvider";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider direction="rtl" locale={faIR}>
        <AuthProvider>{children}</AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
```

`mun-sanandaj-web/src/app/router.tsx` (placeholder pages `Dashboard`/`LogsPage` — Tasks 14/15 replace them):
```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import {
  LoginScreen,
  OidcCallback,
  OidcSilentCallback,
  LogoutScreen,
  ForbiddenScreen,
  RequireAuth,
  RequireAdmin,
} from "../auth/routes";
import { Dashboard } from "../features/dashboard/Dashboard";
import { LogsPage } from "../features/logs/LogsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginScreen /> },
  { path: "/auth/callback", element: <OidcCallback /> },
  { path: "/auth/silent", element: <OidcSilentCallback /> },
  { path: "/logout", element: <LogoutScreen /> },
  { path: "/403", element: <ForbiddenScreen /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: "logs", element: <LogsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
```

`mun-sanandaj-web/src/app/App.tsx` (replaces Task 11's placeholder):
```tsx
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

`mun-sanandaj-web/.env.example` (documents the required dev env — not committed as `.env`, per `.gitignore`):
```
VITE_AUTH_AUTHORITY=https://auth.myceo.ir
VITE_AUTH_CLIENT_ID=mun-sanandaj-web
VITE_AUTH_SCOPE=openid profile email roles mabhas19.api
VITE_API_BASE=https://api.mabhas19.myceo.ir
```

Note: this task references `AppLayout` (Task 14) and `Dashboard`/`LogsPage` (Tasks 14/15), which don't exist yet — `npm run build` will fail until those land. That's expected; Steps 5-6 of Tasks 13-15 are where the build is next verified. Do not run `npm run build` at the end of this task.

- [ ] **Step 5: Commit**

```bash
git add mun-sanandaj-web/src/auth mun-sanandaj-web/src/app mun-sanandaj-web/.env.example
git commit -m "feat(mun-sanandaj-web): add OIDC auth + router (admin-gated)"
```

---

### Task 13: Frontend API client + query hooks

**Files:**
- Create: `mun-sanandaj-web/src/lib/api.ts`, `mun-sanandaj-web/src/lib/types.ts`, `mun-sanandaj-web/src/lib/queries.ts`

**Interfaces:**
- Consumes: `getUserManager` (Task 12); the `MunSyncRunDto`/`MunReportLogDto`/`MunRunDetailDto`/`MunReportLogPageDto` JSON shapes from Tasks 9/10 (mirrored here as TS types with the same field names — Minimal API's default JSON serializer emits camelCase, so `RunId` → `runId`, etc.).
- Produces: `useRuns()`, `useRunDetail(runId)`, `useTriggerRun()`, `useLogs(filters)` — consumed by Tasks 14/15's pages.

- [ ] **Step 1: `types.ts`**

`mun-sanandaj-web/src/lib/types.ts`:
```typescript
export type MunWorkerType = "SaveEngineerReport" | "SaveEngMap";
export type MunRunStatus = "Running" | "Completed" | "Failed";
export type MunLogStatus = "Success" | "Failed";

export interface MunSyncRunDto {
  runId: string;
  workerType: MunWorkerType;
  startedAt: string;
  completedAt: string | null;
  status: MunRunStatus;
  totalRows: number;
  successCount: number;
  failedCount: number;
  triggeredBy: "Timer" | "Manual";
  triggeredByUser: string | null;
}

export interface MunReportLogDto {
  id: number;
  peygiri: string;
  projectNo: string;
  reqId: string;
  nosazi: string | null;
  status: MunLogStatus;
  attemptNumber: number;
  remoteSubmissionId: string | null;
  errorMessage: string | null;
  createdEngineerCodes: string | null;
  startedAt: string;
  completedAt: string;
}

export interface MunRunDetailDto {
  run: MunSyncRunDto;
  logs: MunReportLogDto[];
}

export interface MunReportLogPageDto {
  items: MunReportLogDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogsFilter {
  workerType?: MunWorkerType;
  status?: MunLogStatus;
  peygiri?: string;
  projectNo?: string;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 2: `api.ts`**

`mun-sanandaj-web/src/lib/api.ts`:
```typescript
import { getUserManager } from "../auth/oidc";

const API_BASE = import.meta.env.VITE_API_BASE as string;

async function authHeaders(): Promise<HeadersInit> {
  const user = await getUserManager().getUser();
  return user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: await authHeaders() });
  if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}
```

- [ ] **Step 3: `queries.ts`**

`mun-sanandaj-web/src/lib/queries.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api";
import type { LogsFilter, MunReportLogPageDto, MunRunDetailDto, MunSyncRunDto, MunWorkerType } from "./types";

/** Polls fast (5s) so the dashboard reads as "live"; TanStack Query pauses polling while the tab is hidden. */
export function useRuns() {
  return useQuery({
    queryKey: ["mun-runs"],
    queryFn: () => apiGet<MunSyncRunDto[]>("/api/MunSanandaj/Runs"),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "Running") ? 5_000 : 30_000),
  });
}

export function useRunDetail(runId: string | undefined) {
  return useQuery({
    queryKey: ["mun-run", runId],
    queryFn: () => apiGet<MunRunDetailDto>(`/api/MunSanandaj/Runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (query) => (query.state.data?.run.status === "Running" ? 5_000 : false),
  });
}

export function useTriggerRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workerType: MunWorkerType) => apiPost<MunSyncRunDto>(`/api/MunSanandaj/Runs/${workerType}/trigger`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mun-runs"] }),
  });
}

export function useLogs(filter: LogsFilter) {
  const params = new URLSearchParams();
  if (filter.workerType) params.set("workerType", filter.workerType);
  if (filter.status) params.set("status", filter.status);
  if (filter.peygiri) params.set("peygiri", filter.peygiri);
  if (filter.projectNo) params.set("projectNo", filter.projectNo);
  params.set("page", String(filter.page ?? 1));
  params.set("pageSize", String(filter.pageSize ?? 50));

  return useQuery({
    queryKey: ["mun-logs", filter],
    queryFn: () => apiGet<MunReportLogPageDto>(`/api/MunSanandaj/Logs?${params.toString()}`),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add mun-sanandaj-web/src/lib
git commit -m "feat(mun-sanandaj-web): add API client + TanStack Query hooks"
```

---

### Task 14: Layout + Dashboard page

**Files:**
- Create: `mun-sanandaj-web/src/layout/AppLayout.tsx`
- Create: `mun-sanandaj-web/src/features/dashboard/Dashboard.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 12), `useRuns`/`useRunDetail`/`useTriggerRun` (Task 13), `MunSyncRunDto`/`MunReportLogDto` (Task 13).
- Produces: the `/` route's rendered page (referenced by `router.tsx`, Task 12).

- [ ] **Step 1: `AppLayout.tsx`**

`mun-sanandaj-web/src/layout/AppLayout.tsx`:
```tsx
import { Layout, Menu, Typography } from "antd";
import { DashboardOutlined, FileSearchOutlined, LogoutOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const { Header, Content } = Layout;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { key: "/", icon: <DashboardOutlined />, label: "داشبورد" },
    { key: "/logs", icon: <FileSearchOutlined />, label: "تاریخچه" },
    { key: "logout", icon: <LogoutOutlined />, label: "خروج" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Typography.Text strong style={{ color: "#fff", whiteSpace: "nowrap" }}>
          وب سرویس شهرداری سنندج
        </Typography.Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          style={{ flex: 1 }}
          onClick={({ key }) => (key === "logout" ? logout() : navigate(key))}
        />
        {user && <Typography.Text style={{ color: "#fff" }}>{user.name}</Typography.Text>}
      </Header>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
```

- [ ] **Step 2: `Dashboard.tsx`**

`mun-sanandaj-web/src/features/dashboard/Dashboard.tsx`:
```tsx
import { useState } from "react";
import { Button, Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { useRunDetail, useRuns, useTriggerRun } from "../../lib/queries";
import type { MunReportLogDto, MunWorkerType } from "../../lib/types";

const WORKER_LABEL: Record<MunWorkerType, string> = {
  SaveEngineerReport: "گزارش مهندس ناظر",
  SaveEngMap: "نقشه مهندسین",
};

export function Dashboard() {
  const { data: runs } = useRuns();
  const trigger = useTriggerRun();
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  const latestByWorker = (worker: MunWorkerType) => runs?.find((r) => r.workerType === worker);
  const activeRunId = selectedRunId ?? runs?.find((r) => r.status === "Running")?.runId ?? runs?.[0]?.runId;
  const { data: detail } = useRunDetail(activeRunId);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {(["SaveEngineerReport", "SaveEngMap"] as const).map((worker) => {
          const run = latestByWorker(worker);
          return (
            <Col span={12} key={worker}>
              <Card
                title={WORKER_LABEL[worker]}
                extra={
                  <Button
                    icon={<ReloadOutlined />}
                    loading={trigger.isPending}
                    onClick={() => trigger.mutate(worker)}
                  >
                    اجرای فوری
                  </Button>
                }
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="موفق" value={run?.successCount ?? 0} valueStyle={{ color: "#3f8600" }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="ناموفق" value={run?.failedCount ?? 0} valueStyle={{ color: "#cf1322" }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="کل" value={run?.totalRows ?? 0} />
                  </Col>
                </Row>
                {run && (
                  <Typography.Text
                    type="secondary"
                    style={{ display: "block", marginTop: 12, cursor: "pointer" }}
                    onClick={() => setSelectedRunId(run.runId)}
                  >
                    آخرین اجرا: {new Date(run.startedAt).toLocaleString("fa-IR")} —{" "}
                    <Tag color={run.status === "Running" ? "processing" : run.status === "Completed" ? "success" : "error"}>
                      {run.status}
                    </Tag>
                  </Typography.Text>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {runs && runs.length > 0 && (
        <Card title="روند اجراها" style={{ marginBottom: 24 }}>
          <ReactECharts
            style={{ height: 280 }}
            option={{
              tooltip: {},
              legend: { data: ["موفق", "ناموفق"] },
              xAxis: { type: "category", data: runs.map((r) => new Date(r.startedAt).toLocaleTimeString("fa-IR")).reverse() },
              yAxis: { type: "value" },
              series: [
                { name: "موفق", type: "bar", stack: "total", data: runs.map((r) => r.successCount).reverse(), color: "#3f8600" },
                { name: "ناموفق", type: "bar", stack: "total", data: runs.map((r) => r.failedCount).reverse(), color: "#cf1322" },
              ],
            }}
          />
        </Card>
      )}

      <Card title="جزئیات آخرین اجرا">
        <Table<MunReportLogDto>
          rowKey="id"
          size="small"
          dataSource={detail?.logs ?? []}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "پیگیری", dataIndex: "peygiri" },
            { title: "شماره پروژه", dataIndex: "projectNo" },
            {
              title: "وضعیت",
              dataIndex: "status",
              render: (status: string) => <Tag color={status === "Success" ? "success" : "error"}>{status}</Tag>,
            },
            { title: "تلاش", dataIndex: "attemptNumber" },
            { title: "خطا", dataIndex: "errorMessage" },
          ]}
        />
        <AnimatePresence>
          {detail?.logs.slice(0, 3).map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: "none" }}
            />
          ))}
        </AnimatePresence>
      </Card>
    </div>
  );
}
```

Note on the `AnimatePresence` block: it renders nothing visible (`display: "none"`) — its only purpose is to mount/unmount a `motion.div` keyed by `log.id` so framer-motion's enter transition actually fires when the polled table gets a new row, satisfying the "animate processing" requirement without hand-rolling a custom animated list. If this feels like dead weight once the table is visually verified in Task 16's browser check, replace it with a small animated badge (e.g. a pulsing dot next to "در حال اجرا") — either satisfies the requirement; do not leave both.

- [ ] **Step 3: Commit**

```bash
git add mun-sanandaj-web/src/layout mun-sanandaj-web/src/features/dashboard
git commit -m "feat(mun-sanandaj-web): add layout + live dashboard (KPIs, chart, run table)"
```

---

### Task 15: Logs page

**Files:**
- Create: `mun-sanandaj-web/src/features/logs/LogsPage.tsx`

**Interfaces:**
- Consumes: `useLogs` (Task 13), `MunReportLogDto`/`LogsFilter` (Task 13).
- Produces: the `/logs` route's rendered page (referenced by `router.tsx`, Task 12).

- [ ] **Step 1: Implement**

`mun-sanandaj-web/src/features/logs/LogsPage.tsx`:
```tsx
import { useState } from "react";
import { Card, Input, Select, Table, Tag } from "antd";
import { useLogs } from "../../lib/queries";
import type { LogsFilter, MunReportLogDto } from "../../lib/types";

export function LogsPage() {
  const [filter, setFilter] = useState<LogsFilter>({ page: 1, pageSize: 50 });
  const { data, isLoading } = useLogs(filter);

  return (
    <Card title="تاریخچه ارسال‌ها">
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="نوع عملیات"
          style={{ width: 200 }}
          options={[
            { value: "SaveEngineerReport", label: "گزارش مهندس ناظر" },
            { value: "SaveEngMap", label: "نقشه مهندسین" },
          ]}
          onChange={(workerType) => setFilter((f) => ({ ...f, workerType, page: 1 }))}
        />
        <Select
          allowClear
          placeholder="وضعیت"
          style={{ width: 160 }}
          options={[
            { value: "Success", label: "موفق" },
            { value: "Failed", label: "ناموفق" },
          ]}
          onChange={(status) => setFilter((f) => ({ ...f, status, page: 1 }))}
        />
        <Input.Search
          placeholder="جستجوی پیگیری"
          style={{ width: 220 }}
          onSearch={(peygiri) => setFilter((f) => ({ ...f, peygiri, page: 1 }))}
        />
        <Input.Search
          placeholder="جستجوی شماره پروژه"
          style={{ width: 220 }}
          onSearch={(projectNo) => setFilter((f) => ({ ...f, projectNo, page: 1 }))}
        />
      </div>

      <Table<MunReportLogDto>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        pagination={{
          current: filter.page ?? 1,
          pageSize: filter.pageSize ?? 50,
          total: data?.total ?? 0,
          onChange: (page, pageSize) => setFilter((f) => ({ ...f, page, pageSize })),
        }}
        columns={[
          { title: "پیگیری", dataIndex: "peygiri" },
          { title: "شماره پروژه", dataIndex: "projectNo" },
          { title: "کد ملک", dataIndex: "reqId" },
          {
            title: "وضعیت",
            dataIndex: "status",
            render: (status: string) => <Tag color={status === "Success" ? "success" : "error"}>{status}</Tag>,
          },
          { title: "تلاش", dataIndex: "attemptNumber" },
          { title: "شناسه ثبت", dataIndex: "remoteSubmissionId" },
          { title: "خطا", dataIndex: "errorMessage" },
          {
            title: "زمان",
            dataIndex: "startedAt",
            render: (v: string) => new Date(v).toLocaleString("fa-IR"),
          },
        ]}
      />
    </Card>
  );
}
```

- [ ] **Step 2: Build, typecheck, lint the whole app**

Run:
```bash
cd mun-sanandaj-web && npm run build && npm run lint
```
Expected: both succeed with 0 errors (build = typecheck + vite build; `--max-warnings 0` on lint).

- [ ] **Step 3: Commit**

```bash
git add mun-sanandaj-web/src/features/logs
git commit -m "feat(mun-sanandaj-web): add filterable Logs page"
```

---

### Task 16: Deploy files — Dockerfile, nginx, docker-compose, IdP client

**Files:**
- Create: `mun-sanandaj-web/deploy/Dockerfile.mun-sanandaj-web`, `mun-sanandaj-web/deploy/nginx.conf`
- Modify: `deploy/docker-compose.newserver.yml`
- Modify: `src/Auth/Data/AuthDbInitialiser.cs`

**Interfaces:**
- Consumes: the built `mun-sanandaj-web/dist` (Tasks 11-15); `KurdNezamDb`/`MunSanandaj:ApiToken` config keys (Task 8).
- Produces: a deployable `mun-sanandaj-web` container + `mun-sanandaj-web` seeded as an OIDC client — no code consumes this task's output; it's the deploy wiring itself.

- [ ] **Step 1: `Dockerfile.mun-sanandaj-web`**

`mun-sanandaj-web/deploy/Dockerfile.mun-sanandaj-web` (mirrors `analytics-web/deploy/Dockerfile.analytics-web`):
```dockerfile
# syntax=docker/dockerfile:1
# mun-sanandaj-web SPA -> static nginx. Build context = monorepo root (deploy/docker-compose.newserver.yml).
FROM node:24-alpine AS build
WORKDIR /app/mun-sanandaj-web

ARG VITE_API_BASE=https://api.mabhas19.myceo.ir
ARG VITE_AUTH_AUTHORITY=https://auth.myceo.ir
ARG VITE_AUTH_CLIENT_ID=mun-sanandaj-web
ARG VITE_AUTH_SCOPE="openid profile email roles mabhas19.api"
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_AUTH_AUTHORITY=$VITE_AUTH_AUTHORITY \
    VITE_AUTH_CLIENT_ID=$VITE_AUTH_CLIENT_ID \
    VITE_AUTH_SCOPE=$VITE_AUTH_SCOPE

COPY mun-sanandaj-web/package.json ./
RUN npm install

COPY mun-sanandaj-web/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/mun-sanandaj-web/dist /usr/share/nginx/html
COPY mun-sanandaj-web/deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: `nginx.conf`**

`mun-sanandaj-web/deploy/nginx.conf` (identical structure to `analytics-web/deploy/nginx.conf`):
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               application/xml text/xml image/svg+xml application/wasm font/woff2;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: `docker-compose.newserver.yml` — new service + env additions**

Edit `deploy/docker-compose.newserver.yml`. Add `ConnectionStrings__KurdNezamDb` and `MunSanandaj__ApiToken` to the `api` service's `environment:` block, right after `Cors__AllowedOrigins__1`:
```yaml
      Cors__AllowedOrigins__1: "https://${ANALYTICS_DOMAIN}"
      Cors__AllowedOrigins__2: "https://${MUN_SANANDAJ_DOMAIN}"
      # MunSanandaj: KurdNezam read-only SQL + mahyapardaz REST bearer token (empty = feature disabled).
      ConnectionStrings__KurdNezamDb: "${KURDNEZAM_DB_CONN:-}"
      MunSanandaj__ApiToken: "${MUN_SANANDAJ_API_TOKEN:-}"
```

Add `Clients__MunSanandajWeb__*` to the `auth` service's `environment:` block, right after the `Clients__AnalyticsWeb__*`/CORS lines:
```yaml
      # mun-sanandaj-web public PKCE client (mun-sanandaj.myceo.ir). Requires MUN_SANANDAJ_DOMAIN in
      # deploy/.env; the IdP seeder skips this client when its Redirect is unset.
      Clients__MunSanandajWeb__Redirect: "https://${MUN_SANANDAJ_DOMAIN}/auth/callback"
      Clients__MunSanandajWeb__Silent: "https://${MUN_SANANDAJ_DOMAIN}/auth/silent"
      Clients__MunSanandajWeb__PostLogout: "https://${MUN_SANANDAJ_DOMAIN}"
      Cors__AllowedOrigins__1: "https://${MUN_SANANDAJ_DOMAIN}"
```

Note: the `auth` service's existing `Cors__AllowedOrigins__0` is `"https://${ANALYTICS_DOMAIN}"` — adding `mun-sanandaj-web` needs its own CORS entry too; use index `1` as shown (this is the `auth` service's CORS list, a separate config array from the `api` service's `Cors__AllowedOrigins__1`/`__2` above — index numbering restarts per-service).

Add the new `mun-sanandaj-web` service, after the `analytics-web` service block and before `volumes:`:
```yaml
  # mun-sanandaj-web — the React/Vite monitoring SPA (mun-sanandaj.myceo.ir), served static by nginx.
  mun-sanandaj-web:
    build:
      context: ..
      dockerfile: mun-sanandaj-web/deploy/Dockerfile.mun-sanandaj-web
      args:
        VITE_API_BASE: "https://${API_DOMAIN}"
        VITE_AUTH_AUTHORITY: "https://${AUTH_DOMAIN}"
        VITE_AUTH_CLIENT_ID: "mun-sanandaj-web"
        VITE_AUTH_SCOPE: "openid profile email roles mabhas19.api"
    image: mabhas19-mun-sanandaj-web:newserver
    container_name: mabhas19-mun-sanandaj-web
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik"
      - "traefik.http.routers.m19munsanandaj.rule=Host(`${MUN_SANANDAJ_DOMAIN}`)"
      - "traefik.http.routers.m19munsanandaj.entrypoints=websecure"
      - "traefik.http.routers.m19munsanandaj.tls.certresolver=myresolver"
      - "traefik.http.routers.m19munsanandaj.service=m19munsanandaj"
      - "traefik.http.services.m19munsanandaj.loadbalancer.server.port=80"
    networks: [traefik]
```

- [ ] **Step 4: Verify the compose file parses**

Run: `docker compose -f deploy/docker-compose.newserver.yml config --quiet`
Expected: no output, exit code 0 (confirms valid YAML + no unescaped `$` interpolation mistakes — see this repo's earlier `$Ud30`-dropped-from-password incident).

- [ ] **Step 5: Seed the `mun-sanandaj-web` OIDC client**

Edit `src/Auth/Data/AuthDbInitialiser.cs` — add this block right after the existing `analytics-web` block (after its closing `}` from `if (!string.IsNullOrWhiteSpace(analyticsRedirect)) { ... }`, still inside the same seeding method):
```csharp
        // mun-sanandaj-web — Public, Authorization Code + PKCE, for mun-sanandaj.myceo.ir.
        // Optional: only seeded when its redirect URI is configured (same pattern as analytics-web).
        var munSanandajRedirect   = configuration["Clients:MunSanandajWeb:Redirect"]   ?? string.Empty;
        var munSanandajSilent     = configuration["Clients:MunSanandajWeb:Silent"]     ?? string.Empty;
        var munSanandajPostLogout = configuration["Clients:MunSanandajWeb:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(munSanandajRedirect))
        {
            var munSanandajClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "mun-sanandaj-web",
                ClientType  = ClientTypes.Public,
                DisplayName = "Mun Sanandaj Web",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            munSanandajClient.RedirectUris.Add(new Uri(munSanandajRedirect));
            if (!string.IsNullOrWhiteSpace(munSanandajSilent))
                munSanandajClient.RedirectUris.Add(new Uri(munSanandajSilent));
            if (!string.IsNullOrWhiteSpace(munSanandajPostLogout))
                munSanandajClient.PostLogoutRedirectUris.Add(new Uri(munSanandajPostLogout));

            await EnsureClientAsync(munSanandajClient);
        }
```

- [ ] **Step 6: Build and commit**

Run: `dotnet build src/Auth/Auth.csproj`
Expected: 0 errors/warnings.

```bash
git add mun-sanandaj-web/deploy deploy/docker-compose.newserver.yml src/Auth/Data/AuthDbInitialiser.cs
git commit -m "feat(mun-sanandaj): add deploy files (Dockerfile, nginx, compose, IdP client)"
```

---

### Task 17: Deploy scripts + env template + roadmap entry

**Files:**
- Modify: `scripts/deploy.ps1`, `scripts/remote-provision.sh`
- Modify: `roadmap/roadmap.json`

**Interfaces:**
- Consumes: nothing code-level — this task only extends operational scripts and the status board.

- [ ] **Step 1: `scripts/deploy.ps1`**

Edit `scripts/deploy.ps1` line 47 (the `rm -rf` cleanup list) — add `mun-sanandaj-web` alongside `analytics-web`:
```powershell
Remote "cd $AppPath && rm -rf src web analytics-web mun-sanandaj-web packages tests mobile docs 'Directory.Build.props' 'Directory.Packages.props' *.slnx package.json package-lock.json && tar -xzf /tmp/mabhas19-src.tar.gz -C $AppPath && rm -f /tmp/mabhas19-src.tar.gz"
```

Edit line 60 (the build loop) — add `"mun-sanandaj-web"` to the service array:
```powershell
foreach ($svc in @("api", "auth", "web", "analytics-web", "mun-sanandaj-web")) {
```

- [ ] **Step 2: `scripts/remote-provision.sh`**

Edit the `.env` heredoc — add `MUN_SANANDAJ_DOMAIN` next to `ANALYTICS_DOMAIN` (in the "Public hosts" block):
```bash
ANALYTICS_DOMAIN=analytic.myceo.ir
MUN_SANANDAJ_DOMAIN=mun-sanandaj.myceo.ir
```

Add a new block in "EXTERNAL INTEGRATIONS", after the `ANALYTICS_DB_CONN=` line:
```bash
# mun-sanandaj municipality integration (KurdNezam read-only SQL + mahyapardaz REST bearer token).
# NON-EMPTY KURDNEZAM_DB_CONN enables the two 12h sync workers; leave both empty to disable.
KURDNEZAM_DB_CONN=
MUN_SANANDAJ_API_TOKEN=
```

- [ ] **Step 3: `roadmap/roadmap.json`**

Edit `roadmap/roadmap.json` — add a new service object to the `"services"` array, after the `"analytic"` entry and before `"mabhas19"`:
```json
    {
      "id": "mun-sanandaj",
      "name": "Mun Sanandaj integration",
      "domain": "mun-sanandaj.myceo.ir",
      "kind": "planned",
      "items": [
        { "id": "mun-01", "title": "MunSyncRun/MunReportLog entities + migration", "desc": "mun_sync_runs (per-run) + mun_report_logs (append-only per-attempt) tables on the existing Mabhas19Db.", "status": "not-started", "area": "backend", "priority": "high", "effort": "M", "tags": ["ef-core", "schema"] },
        { "id": "mun-02", "title": "Field-mapping + gateway-response-parsing unit tests", "desc": "Pure sp2-row -> addEngineer/saveEngMap mapping, and saveEngineerReport/saveEngMap/addEngineer response parsers, golden-tested against the exact spec JSON.", "status": "not-started", "area": "backend", "priority": "high", "effort": "M", "tags": ["testing", "mapping"] },
        { "id": "mun-03", "title": "KurdNezam SQL reader (sp1/sp2)", "desc": "Raw ADO.NET against ConnectionStrings:KurdNezamDb for WebS_GetListRepToShahrdari + WebS_GetReportFullInfo.", "status": "not-started", "area": "backend", "priority": "high", "effort": "M", "tags": ["sql", "external"] },
        { "id": "mun-04", "title": "mahyapardaz gateway client", "desc": "Bearer-auth HttpClient (long timeout, Aspire-resilience bypass) for saveEngineerReport/saveEngMap/addEngineer.", "status": "not-started", "area": "backend", "priority": "high", "effort": "M", "tags": ["http", "external"] },
        { "id": "mun-05", "title": "Sync orchestration + addEngineer-retry flow", "desc": "IMunSanandajSyncService: skip already-succeeded Peygiris, run both flows, auto-create+retry on 'مهندس یافت نشد'.", "status": "not-started", "area": "backend", "priority": "high", "effort": "L", "tags": ["orchestration"] },
        { "id": "mun-06", "title": "12h background workers + gated DI", "desc": "SaveEngineerReportWorker/SaveEngMapWorker BackgroundServices, feature-gated on ConnectionStrings:KurdNezamDb.", "status": "not-started", "area": "backend", "priority": "high", "effort": "S", "tags": ["hosted-service"] },
        { "id": "mun-07", "title": "Runs + Logs admin API", "desc": "GET Runs/Runs/{id}, POST Runs/{workerType}/trigger, GET Logs (paginated/filterable) — Administrator-only.", "status": "not-started", "area": "backend", "priority": "high", "effort": "M", "tags": ["api", "admin"] },
        { "id": "mun-08", "title": "mun-sanandaj-web dashboard", "desc": "New Vite/React/AntD/ECharts/framer-motion SPA: live-polling dashboard (KPIs, run chart, live row table) + filterable logs page.", "status": "not-started", "area": "frontend", "priority": "high", "effort": "L", "tags": ["react", "dashboard"] },
        { "id": "mun-09", "title": "OIDC auth (Administrator-gated)", "desc": "oidc-client-ts PKCE against the central IdP; mun-sanandaj-web seeded as a public client, gated to the Administrator role.", "status": "not-started", "area": "frontend", "priority": "high", "effort": "M", "tags": ["auth", "oidc"] },
        { "id": "mun-10", "title": "Deploy to mun-sanandaj.myceo.ir", "desc": "New service on the 185.206.94.116 stack behind shared Traefik; DNS A-record + KurdNezam/mahyapardaz secrets in deploy/.env.", "status": "not-started", "area": "devops", "priority": "high", "effort": "M", "tags": ["deploy", "traefik"] }
      ]
    },
```

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.ps1 scripts/remote-provision.sh roadmap/roadmap.json
git commit -m "chore(mun-sanandaj): extend deploy scripts + roadmap board"
```

---

## Post-plan deployment (manual, not part of task automation)

Once all 17 tasks are merged, deploying live requires the user to:
1. Add DNS: `mun-sanandaj.myceo.ir` → `185.206.94.116` in ArvanCloud (CDN mode ON, matching `analytic.myceo.ir`).
2. Fill `KURDNEZAM_DB_CONN` and `MUN_SANANDAJ_API_TOKEN` into `deploy/.env` on the server (via `scripts/remote-provision.sh` having already added the empty placeholders — see Task 17).
3. Run `pwsh -File scripts/deploy.ps1` (already includes `mun-sanandaj-web` in its build loop after Task 17).
4. Rotate the KurdNezam DB password and mahyapardaz bearer token that were pasted in chat, since third-party credentials shared in plaintext should not stay live indefinitely (the user's call on timing).
