using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Reports.Queries.GetReports;

/// <summary>Returns the list of saved analytics reports for the current tenant.</summary>
[Authorize]
public record GetReportsQuery : IRequest<IReadOnlyList<SavedReportDto>>;

public class GetReportsQueryHandler : IRequestHandler<GetReportsQuery, IReadOnlyList<SavedReportDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public GetReportsQueryHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<IReadOnlyList<SavedReportDto>> Handle(
        GetReportsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        return await _context.AnalyticsReports
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderByDescending(r => r.LastModified)
            .Select(r => new SavedReportDto(
                r.Id,
                r.Name,
                r.OwnerName,
                r.Visibility,
                r.LastModified))
            .ToListAsync(cancellationToken);
    }
}
