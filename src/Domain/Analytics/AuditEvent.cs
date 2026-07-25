using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>Immutable audit log entry — no update after insert.</summary>
public class AuditEvent : BaseEntity
{
    public string TenantId { get; set; } = "default";

    /// <summary>Action type, e.g. "report.saved", "report.executed", "dashboard.viewed".</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Display name (or ID) of the actor who triggered the event.</summary>
    public string? ActorName { get; set; }

    /// <summary>JSON payload with action-specific details (nvarchar(max)).</summary>
    public string DetailJson { get; set; } = "{}";

    public DateTimeOffset OccurredAtUtc { get; set; }
}
