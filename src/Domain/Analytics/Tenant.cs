using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>Logical analytics tenant for multi-tenant isolation.</summary>
public class Tenant : BaseAuditableEntity
{
    /// <summary>Stable external slug used in JWT claims and API routes.</summary>
    public string Slug { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Subscription plan identifier, e.g. "free", "pro".</summary>
    public string Plan { get; set; } = "free";

    /// <summary>Account status, e.g. "active", "suspended".</summary>
    public string Status { get; set; } = "active";

    /// <summary>JSON branding overrides (logo URL, colours, etc.) — nvarchar(max).</summary>
    public string BrandingJson { get; set; } = "{}";
}
