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
        pageSize = Math.Clamp(pageSize, 1, 200);

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
