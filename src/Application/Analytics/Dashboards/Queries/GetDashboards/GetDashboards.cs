using System.Text.Json;
using System.Text.Json.Nodes;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Dashboards.Queries.GetDashboards;

[Authorize]
public record GetDashboardsQuery : IRequest<IReadOnlyList<DashboardDto>>;

public class GetDashboardsQueryHandler : IRequestHandler<GetDashboardsQuery, IReadOnlyList<DashboardDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public GetDashboardsQueryHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<IReadOnlyList<DashboardDto>> Handle(GetDashboardsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var rows = await _context.AnalyticsDashboards
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.LastModified)
            .Select(d => new { d.Id, d.Name, d.WidgetsJson, d.LayoutJson, d.OwnerName, d.LastModified })
            .ToListAsync(cancellationToken);

        return rows.Select(d => new DashboardDto
        {
            Id         = d.Id,
            Name       = d.Name,
            Widgets    = JsonNode.Parse(d.WidgetsJson)?.AsArray()  ?? [],
            Layout     = JsonNode.Parse(d.LayoutJson)?.AsArray()   ?? [],
            OwnerName  = d.OwnerName,
            UpdatedAt  = d.LastModified
        }).ToList();
    }
}
