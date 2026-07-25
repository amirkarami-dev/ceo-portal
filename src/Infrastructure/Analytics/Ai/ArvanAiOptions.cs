namespace Mabhas19.Infrastructure.Analytics.Ai;

/// <summary>
/// Configuration for the ArvanCloud AI gateway (OpenAI-compatible).
/// Bind from the <c>AnalyticsAi</c> config section.
/// </summary>
public sealed class ArvanAiOptions
{
    public const string SectionName = "AnalyticsAi";

    /// <summary>
    /// The base URL of the AI gateway ending in <c>/v1</c>.
    /// This is a signed credential — set via user-secrets or environment variable, NEVER commit the real value.
    /// </summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// API key for the <c>apikey</c> Authorization scheme.
    /// Set via user-secrets or environment variable, NEVER commit the real value.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Model identifier to pass in the chat-completions request.</summary>
    public string Model { get; set; } = "DeepSeek-R1-qwen-7b-awq";
}
