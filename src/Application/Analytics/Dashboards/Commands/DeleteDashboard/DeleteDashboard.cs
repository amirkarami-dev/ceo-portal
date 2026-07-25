using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Dashboards.Commands.DeleteDashboard;

[Authorize]
public record DeleteDashboardCommand(int Id) : IRequest;

public class DeleteDashboardCommandHandler : IRequestHandler<DeleteDashboardCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public DeleteDashboardCommandHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task Handle(DeleteDashboardCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var dashboard = await _context.AnalyticsDashboards
            .Where(d => d.TenantId == tenantId && d.Id == request.Id)
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dashboard);

        _context.AnalyticsDashboards.Remove(dashboard);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
