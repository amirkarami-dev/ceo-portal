using System.Text.Json.Nodes;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Analytics;
using Mabhas19.Domain.Constants;

namespace Mabhas19.Application.Analytics.AiProviders.Commands.UpsertAiProvider;

/// <summary>
/// Create or update an AI provider config for the current tenant.
/// NEVER include raw API secrets in Config — use a key-reference string only.
/// </summary>
[Authorize(Roles = Roles.Administrator)]
public record UpsertAiProviderCommand(
    string Type,
    bool Enabled,
    JsonObject Config) : IRequest<int>;

public class UpsertAiProviderCommandHandler : IRequestHandler<UpsertAiProviderCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;

    public UpsertAiProviderCommandHandler(IApplicationDbContext context, ITenantContext tenant)
    {
        _context = context;
        _tenant = tenant;
    }

    public async Task<int> Handle(UpsertAiProviderCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId ?? "default";

        var existing = await _context.AnalyticsAiProviders
            .Where(p => p.TenantId == tenantId && p.Type == request.Type)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            existing = new AiProvider
            {
                TenantId   = tenantId,
                Type       = request.Type,
                Enabled    = request.Enabled,
                ConfigJson = request.Config.ToJsonString()
            };
            _context.AnalyticsAiProviders.Add(existing);
        }
        else
        {
            existing.Enabled    = request.Enabled;
            existing.ConfigJson = request.Config.ToJsonString();
        }

        await _context.SaveChangesAsync(cancellationToken);
        return existing.Id;
    }
}
