using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Reports.Commands.UpdateReport;

/// <summary>
/// Updates a saved report in place.
///
/// Reports had no update path at all: <c>POST /api/Reports</c> always calls <c>Add</c>, so anything
/// that looked like an edit — renaming a report, correcting a label — silently created a second
/// report and left the original untouched. Dashboards hit exactly this and fixed it with an upsert
/// (see SaveDashboardCommandHandler, "the old always-Add duplicated the dashboard on every save").
/// This is the same fix for reports, as its own verb so POST keeps meaning "create".
///
/// There is deliberately no separate <c>Name</c> here. The name is stored twice — the
/// <c>AnalyticsReport.Name</c> column and again inside <c>DefinitionJson</c> — and the frontend
/// reconciles them at read time. Taking both would let a caller set them to different values; taking
/// only the definition makes drift structurally impossible.
/// </summary>
[Authorize]
public record UpdateReportCommand(
    int Id,
    ReportDefinitionDto Definition,
    string? Visibility = null) : IRequest;

public class UpdateReportCommandHandler : IRequestHandler<UpdateReportCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public UpdateReportCommandHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task Handle(UpdateReportCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        // Scoped by tenant in the same predicate as the id, so a report belonging to another tenant
        // reads as "not found" rather than "forbidden" — the same shape GetReports already presents,
        // and it does not confirm that the id exists.
        var report = await _context.AnalyticsReports
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == request.Id, cancellationToken);

        Ardalis.GuardClauses.Guard.Against.NotFound(request.Id, report);

        report.Name = request.Definition.Name;
        report.DefinitionJson = JsonSerializer.Serialize(request.Definition);

        // Absent means "leave it alone". Visibility is a separate decision from editing the content,
        // and a rename should not quietly re-scope who can see the report.
        if (!string.IsNullOrWhiteSpace(request.Visibility))
        {
            report.Visibility = request.Visibility;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
