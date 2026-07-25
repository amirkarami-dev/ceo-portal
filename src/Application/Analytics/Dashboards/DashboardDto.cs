using System.Text.Json.Nodes;

namespace Mabhas19.Application.Analytics.Dashboards;

public sealed class DashboardDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public JsonArray Widgets { get; init; } = [];
    public JsonArray Layout { get; init; } = [];
    public string? OwnerName { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
