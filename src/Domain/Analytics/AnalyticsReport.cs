using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>
/// A user-saved analytics report. The full <c>ReportDefinitionDto</c> is stored as
/// JSON in <see cref="DefinitionJson"/> so the schema can evolve without migrations.
/// </summary>
public class AnalyticsReport : BaseAuditableEntity
{
    /// <summary>Owning tenant. Defaults to "default" for single-tenant deployments.</summary>
    public string TenantId { get; set; } = "default";

    public string Name { get; set; } = string.Empty;

    /// <summary>Serialised <c>ReportDefinitionDto</c> (nvarchar(max)).</summary>
    public string DefinitionJson { get; set; } = "{}";

    /// <summary>Display name of the user who saved the report.</summary>
    public string? OwnerName { get; set; }

    /// <summary>Visibility scope: "private" or "tenant".</summary>
    public string Visibility { get; set; } = "private";
}
