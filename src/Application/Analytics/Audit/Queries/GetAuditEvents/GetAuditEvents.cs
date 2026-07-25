using System.Text.Json.Nodes;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;

namespace Mabhas19.Application.Analytics.Audit.Queries.GetAuditEvents;

[Authorize(Roles = Roles.Administrator)]
public record GetAuditEventsQuery(string? Type = null, string? Status = null) : IRequest<IReadOnlyList<AuditEventDto>>;

public class GetAuditEventsQueryHandler : IRequestHandler<GetAuditEventsQuery, IReadOnlyList<AuditEventDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public GetAuditEventsQueryHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<IReadOnlyList<AuditEventDto>> Handle(GetAuditEventsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var query = _context.AnalyticsAuditEvents
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(request.Type))
            query = query.Where(e => e.Type == request.Type);

        // Status is stored inside DetailJson; filter in memory if requested
        var rows = await query
            .OrderByDescending(e => e.OccurredAtUtc)
            .Select(e => new { e.Id, e.Type, e.ActorName, e.DetailJson, e.OccurredAtUtc })
            .ToListAsync(cancellationToken);

        var dtos = rows.Select(e =>
        {
            var detailNode = JsonNode.Parse(e.DetailJson)?.AsObject() ?? [];
            var status     = detailNode["status"]?.GetValue<string>();
            return new AuditEventDto
            {
                Id             = e.Id,
                Type           = e.Type,
                ActorName      = e.ActorName,
                Detail         = detailNode,
                OccurredAtUtc  = e.OccurredAtUtc,
                Status         = status
            };
        });

        if (!string.IsNullOrWhiteSpace(request.Status))
            dtos = dtos.Where(e => string.Equals(e.Status, request.Status, StringComparison.OrdinalIgnoreCase));

        return dtos.ToList();
    }
}
