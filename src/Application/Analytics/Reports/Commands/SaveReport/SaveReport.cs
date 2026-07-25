using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Analytics;

namespace Mabhas19.Application.Analytics.Reports.Commands.SaveReport;

/// <summary>Persists a report definition under the current tenant.</summary>
[Authorize]
public record SaveReportCommand(
    ReportDefinitionDto Definition,
    string Name,
    string Visibility) : IRequest<int>;

public class SaveReportCommandHandler : IRequestHandler<SaveReportCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;
    private readonly IUser _user;

    public SaveReportCommandHandler(
        IApplicationDbContext context,
        ITenantContext tenant,
        IUser user)
    {
        _context = context;
        _tenant = tenant;
        _user = user;
    }

    public async Task<int> Handle(SaveReportCommand request, CancellationToken cancellationToken)
    {
        var definitionJson = JsonSerializer.Serialize(request.Definition);

        var report = new AnalyticsReport
        {
            TenantId = _tenant.TenantId ?? "default",
            Name = request.Name,
            DefinitionJson = definitionJson,
            OwnerName = _user.Id,
            Visibility = request.Visibility
        };

        _context.AnalyticsReports.Add(report);
        await _context.SaveChangesAsync(cancellationToken);

        return report.Id;
    }
}
