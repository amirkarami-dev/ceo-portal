using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>Describes a queryable dataset exposed to the AI query engine.</summary>
public class SemanticModel : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Unique key used to reference this model in prompts and report definitions.</summary>
    public string ModelKey { get; set; } = string.Empty;

    /// <summary>Natural-language description of the dataset for AI context.</summary>
    public string? Description { get; set; }

    public string? TenantId { get; set; }
}
