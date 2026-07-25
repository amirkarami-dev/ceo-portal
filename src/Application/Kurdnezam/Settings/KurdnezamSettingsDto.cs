namespace Mabhas19.Application.Kurdnezam.Settings;

/// <summary>
/// Site settings exactly as the landing site consumes them: phones and footer links are
/// flattened into arrays, and <see cref="Stats"/> carries real counters.
/// </summary>
public sealed class KurdnezamSettingsDto
{
    public string NameFa { get; init; } = string.Empty;

    public string NameKu { get; init; } = string.Empty;

    public string NameEn { get; init; } = string.Empty;

    public string Tagline { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public IReadOnlyList<string> Phones { get; init; } = [];

    public string PostalCode { get; init; } = string.Empty;

    public string Telegram { get; init; } = string.Empty;

    public string Instagram { get; init; } = string.Empty;

    public IReadOnlyList<KurdnezamFooterLinkItemDto> FooterLinks { get; init; } = [];

    public KurdnezamStatsDto Stats { get; init; } = new();
}

/// <summary>
/// The footer's view of a link — title + href only. (The admin CRUD DTO additionally carries
/// Id and SortOrder; the public site needs neither.)
/// </summary>
public sealed record KurdnezamFooterLinkItemDto(string Title, string Href);

/// <summary>
/// Visit counters. These are <b>numbers</b>, not the pre-formatted Persian-numeral strings the
/// mock shipped — the site formats them with <c>toLocaleString("fa-IR")</c>.
/// </summary>
public sealed class KurdnezamStatsDto
{
    public int TotalVisits { get; init; }

    public int TodayVisits { get; init; }

    /// <summary>Distinct sessions seen in the last few minutes.</summary>
    public int Online { get; init; }
}
