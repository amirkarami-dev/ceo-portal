using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.Reports.Commands.SaveReport;
using Mabhas19.Application.Analytics.Reports.Commands.UpdateReport;
using Mabhas19.Application.Analytics.Reports.Queries.ExecuteReport;
using Mabhas19.Application.Analytics.Reports.Queries.GetEngineerQuota;
using Mabhas19.Application.Analytics.Reports.Queries.GenerateReport;
using Mabhas19.Application.Analytics.Reports.Queries.GetReports;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Analytics;

/// <summary>
/// Analytics report endpoints. Auto-mapped to <c>/api/Reports</c> by
/// <see cref="Mabhas19.Web.Infrastructure.IEndpointGroup"/> conventions.
/// </summary>
public class Reports : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapPost(ExecuteReport, "execute");
        groupBuilder.MapPost(GetEngineerQuota, "custom/engineer-quota");
        groupBuilder.MapPost(GenerateReportFromPrompt, "generate");
        groupBuilder.MapGet(GetReports, string.Empty);
        groupBuilder.MapPost(SaveReport, string.Empty);
        groupBuilder.MapPut(UpdateReport, "{id}");
    }

    public static async Task<Ok<ReportResultDto>> ExecuteReport(ISender sender, ReportDefinitionDto definition)
        => TypedResults.Ok(await sender.Send(new ExecuteReportQuery(definition)));

    /// <summary>
    /// «وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته» — one wide row from a stored procedure.
    /// </summary>
    /// <remarks>
    /// Under <c>custom/</c> because it is not a report definition the engine can execute: its data is
    /// a procedure, its dimension is in the column names, and its parameters are procedure arguments.
    /// The route is the contract <c>analytics-web</c>'s custom-report registry already calls — see
    /// <c>docs/design/2026-08-15-custom-reports-engineer-quota.md</c>.
    ///
    /// POST rather than GET despite being a read: it keeps the two ids in a typed body next to the
    /// other analytics endpoints, all of which post.
    /// </remarks>
    public static async Task<Ok<EngineerQuotaDto>> GetEngineerQuota(ISender sender, EngineerQuotaRequest request)
        => TypedResults.Ok(await sender.Send(new GetEngineerQuotaQuery(request.CityId, request.Reshte)));

    public static async Task<Ok<ReportDefinitionDto>> GenerateReportFromPrompt(ISender sender, GenerateReportRequest request)
        => TypedResults.Ok(await sender.Send(new GenerateReportQuery(request.Prompt, request.SemanticModelId)));

    public static async Task<Ok<IReadOnlyList<SavedReportDto>>> GetReports(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetReportsQuery()));

    public static async Task<Ok<int>> SaveReport(ISender sender, SaveReportRequest request)
        => TypedResults.Ok(await sender.Send(new SaveReportCommand(request.Definition, request.Name, request.Visibility)));

    /// <summary>
    /// Updates a saved report in place. POST creates, PUT edits — without this, editing a report
    /// went through POST and produced a duplicate instead of a change.
    /// </summary>
    public static async Task<NoContent> UpdateReport(ISender sender, int id, UpdateReportRequest request)
    {
        await sender.Send(new UpdateReportCommand(id, request.Definition, request.Visibility));
        return TypedResults.NoContent();
    }
}

/// <summary>Request body for POST /api/Reports/custom/engineer-quota.</summary>
public sealed record EngineerQuotaRequest(int CityId, int Reshte);

/// <summary>Request body for POST /api/Reports/generate.</summary>
public sealed record GenerateReportRequest(string Prompt, string SemanticModelId);

/// <summary>Request body for POST /api/Reports (save a report).</summary>
public sealed record SaveReportRequest(ReportDefinitionDto Definition, string Name, string Visibility);

/// <summary>
/// Request body for PUT /api/Reports/{id}. No <c>Name</c>: the report's name is taken from the
/// definition, because it is stored in two places and accepting both invites them to disagree.
/// A null <c>Visibility</c> leaves the current scope untouched.
/// </summary>
public sealed record UpdateReportRequest(ReportDefinitionDto Definition, string? Visibility = null);
