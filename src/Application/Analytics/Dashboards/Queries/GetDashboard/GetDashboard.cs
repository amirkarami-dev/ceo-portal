using System.Text.Json.Nodes;
using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Dashboards.Queries.GetDashboard;

[Authorize]
public record GetDashboardQuery(int Id) : IRequest<DashboardDto>;

public class GetDashboardQueryHandler : IRequestHandler<GetDashboardQuery, DashboardDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public GetDashboardQueryHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<DashboardDto> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var d = await _context.AnalyticsDashboards
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Id == request.Id)
            .Select(x => new { x.Id, x.Name, x.WidgetsJson, x.LayoutJson, x.OwnerName, x.LastModified })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, d);

        return new DashboardDto
        {
            Id        = d.Id,
            Name      = d.Name,
            Widgets   = JsonNode.Parse(d.WidgetsJson)?.AsArray()  ?? [],
            Layout    = JsonNode.Parse(d.LayoutJson)?.AsArray()   ?? [],
            OwnerName = d.OwnerName,
            UpdatedAt = d.LastModified
        };
    }
}
