using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.Reports.Commands.SaveReport;
using Mabhas19.Application.Analytics.Reports.Queries.ExecuteReport;
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
        groupBuilder.MapPost(GenerateReportFromPrompt, "generate");
        groupBuilder.MapGet(GetReports, string.Empty);
        groupBuilder.MapPost(SaveReport, string.Empty);
    }

    public static async Task<Ok<ReportResultDto>> ExecuteReport(ISender sender, ReportDefinitionDto definition)
        => TypedResults.Ok(await sender.Send(new ExecuteReportQuery(definition)));

    public static async Task<Ok<ReportDefinitionDto>> GenerateReportFromPrompt(ISender sender, GenerateReportRequest request)
        => TypedResults.Ok(await sender.Send(new GenerateReportQuery(request.Prompt, request.SemanticModelId)));

    public static async Task<Ok<IReadOnlyList<SavedReportDto>>> GetReports(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetReportsQuery()));

    public static async Task<Ok<int>> SaveReport(ISender sender, SaveReportRequest request)
        => TypedResults.Ok(await sender.Send(new SaveReportCommand(request.Definition, request.Name, request.Visibility)));
}

/// <summary>Request body for POST /api/Reports/generate.</summary>
public sealed record GenerateReportRequest(string Prompt, string SemanticModelId);

/// <summary>Request body for POST /api/Reports (save a report).</summary>
public sealed record SaveReportRequest(ReportDefinitionDto Definition, string Name, string Visibility);
