using System.Text.Json.Nodes;

namespace Mabhas19.Application.Analytics.Audit;

public sealed class AuditEventDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string? ActorName { get; init; }
    public JsonObject Detail { get; init; } = [];
    public DateTimeOffset OccurredAtUtc { get; init; }
    public string? Status { get; init; }
}
