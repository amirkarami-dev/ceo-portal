namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Configuration for the mahyapardaz REST API. The KurdNezam SQL connection string is bound
/// separately from ConnectionStrings:KurdNezamDb (kept out of this section, same reasoning as
/// FarsNezamOptions, so it can live in env/.env without leaking into appsettings).
/// </summary>
public class MunSanandajOptions
{
    public const string SectionName = "MunSanandaj";

    /// <summary>Bearer token for the mahyapardaz REST API.</summary>
    public string ApiToken { get; set; } = string.Empty;

    /// <summary>Hours between automatic sync runs. Defaults to 12.</summary>
    public int IntervalHours { get; set; } = 12;
}
