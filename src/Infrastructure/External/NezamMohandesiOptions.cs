namespace Mabhas19.Infrastructure.External;

public class NezamMohandesiOptions
{
    public const string SectionName = "ExternalImport:NezamMohandesi";

    /// <summary>Base URL of the Building Engineering System Organization API.</summary>
    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }

    /// <summary>When true and no BaseUrl is configured, returns deterministic mock data.</summary>
    public bool AllowMock { get; set; } = true;
}
