using System.Text.Json.Nodes;

namespace Mabhas19.Application.Analytics.AiProviders;

/// <summary>
/// DTO for an AI provider config. Config is a JSON object WITHOUT raw secrets —
/// only key references (secret-manager path/name) may appear in the config.
/// </summary>
public sealed class AiProviderDto
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public bool Enabled { get; init; }
    /// <summary>Parsed ConfigJson. Raw secrets must NOT appear here.</summary>
    public JsonObject Config { get; init; } = [];
}
