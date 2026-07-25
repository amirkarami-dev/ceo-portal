using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Domain.Analytics;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Infrastructure.Analytics;

/// <summary>
/// Persists audit events to the <see cref="AnalyticsAuditEvents"/> table.
/// Swallows exceptions so callers are never interrupted by audit failures.
/// </summary>
internal sealed class AuditLogger : IAuditLogger
{
    private readonly IApplicationDbContext _context;
    private readonly ITenantContext _tenant;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(IApplicationDbContext context, ITenantContext tenant, ILogger<AuditLogger> logger)
    {
        _context = context;
        _tenant  = tenant;
        _logger  = logger;
    }

    public async Task LogAsync(string type, string? actorName, object? detail, CancellationToken cancellationToken = default)
    {
        try
        {
            var ev = new AuditEvent
            {
                TenantId      = _tenant.TenantId ?? "default",
                Type          = type,
                ActorName     = actorName,
                DetailJson    = detail is null ? "{}" : JsonSerializer.Serialize(detail),
                OccurredAtUtc = DateTimeOffset.UtcNow
            };

            _context.AnalyticsAuditEvents.Add(ev);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit event '{Type}' for actor '{Actor}'", type, actorName);
        }
    }
}
