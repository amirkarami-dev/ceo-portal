using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Analytics;

/// <summary>
/// Configuration record for an AI completion provider.
/// Raw secrets are NEVER stored here — only a key reference (e.g. a secret-manager path).
/// </summary>
public class AiProvider : BaseAuditableEntity
{
    public string TenantId { get; set; } = "default";

    /// <summary>Provider type tag, e.g. "openai", "azure", "anthropic".</summary>
    public string Type { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    /// <summary>
    /// JSON config (nvarchar(max)): endpoint, deployment name, model, token limit, etc.
    /// Must NOT contain raw API keys — store only a key REFERENCE (secret-manager path/name).
    /// </summary>
    public string ConfigJson { get; set; } = "{}";
}
