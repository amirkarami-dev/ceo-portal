using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>A named collection of widgets, layout stored as JSON.</summary>
public class Dashboard : BaseAuditableEntity
{
    public string TenantId { get; set; } = "default";

    public string Name { get; set; } = string.Empty;

    /// <summary>JSON-serialised widget descriptors (nvarchar(max)).</summary>
    public string WidgetsJson { get; set; } = "[]";

    /// <summary>JSON-serialised layout grid config (nvarchar(max)).</summary>
    public string LayoutJson { get; set; } = "{}";

    /// <summary>Display name of the owner.</summary>
    public string? OwnerName { get; set; }
}
