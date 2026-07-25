namespace Mabhas19.Application.Kurdnezam.FooterLinks;

/// <summary>A link rendered in the site footer, as served to the public site and the admin panel.</summary>
public sealed class KurdnezamFooterLinkDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Href { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
