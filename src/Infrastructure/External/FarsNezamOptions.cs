namespace Mabhas19.Infrastructure.External;

/// <summary>
/// Configuration for the FarsNezam (نظام مهندسی فارس) external SQL Server integration.
/// The connection string is read separately from <c>ConnectionStrings:FarsNezamDb</c> (kept
/// out of this section so it can live in SOPS / env without leaking into appsettings).
/// </summary>
public class FarsNezamOptions
{
    public const string SectionName = "ExternalImport:FarsNezam";

    /// <summary>When false, the provider returns null (feature disabled).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>tblProject has no city column (Fars province), so imported projects default to this city.</summary>
    public string DefaultCity { get; set; } = "شیراز";

    /// <summary>Climate code applied to imported projects (Shiraz / Fars = 3B).</summary>
    public string DefaultClimateCode { get; set; } = "3B";

    public int CommandTimeoutSeconds { get; set; } = 30;
}
