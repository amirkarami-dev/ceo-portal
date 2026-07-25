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
        IApplicationDbContext context, HttpContext httpContext, string workerType, CancellationToken ct)
    {
        if (!Enum.TryParse<MunWorkerType>(workerType, ignoreCase: true, out var type))
            return TypedResults.BadRequest("workerType must be 'SaveEngineerReport' or 'SaveEngMap'.");

        var syncService = httpContext.RequestServices.GetService<IMunSanandajSyncService>();
        if (syncService is null)
            return TypedResults.BadRequest("MunSanandaj is not configured on this server (ConnectionStrings:KurdNezamDb is empty).");

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
