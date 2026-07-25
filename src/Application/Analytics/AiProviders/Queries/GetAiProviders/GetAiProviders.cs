using System.Text.Json.Nodes;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;

namespace Mabhas19.Application.Analytics.AiProviders.Queries.GetAiProviders;

[Authorize(Roles = Roles.Administrator)]
public record GetAiProvidersQuery : IRequest<IReadOnlyList<AiProviderDto>>;

public class GetAiProvidersQueryHandler : IRequestHandler<GetAiProvidersQuery, IReadOnlyList<AiProviderDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public GetAiProvidersQueryHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<IReadOnlyList<AiProviderDto>> Handle(GetAiProvidersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var rows = await _context.AnalyticsAiProviders
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .OrderBy(p => p.Type)
            .Select(p => new { p.Id, p.Type, p.Enabled, p.ConfigJson })
            .ToListAsync(cancellationToken);

        return rows.Select(p => new AiProviderDto
        {
            Id      = p.Id,
            Type    = p.Type,
            Enabled = p.Enabled,
            Config  = JsonNode.Parse(p.ConfigJson)?.AsObject() ?? []
        }).ToList();
    }
}
