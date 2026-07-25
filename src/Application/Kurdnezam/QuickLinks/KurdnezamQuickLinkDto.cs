namespace Mabhas19.Application.Kurdnezam.QuickLinks;

/// <summary>A quick link (header dock / footer shortcut) as served to the public site and the admin panel.</summary>
public sealed class KurdnezamQuickLinkDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Href { get; init; } = string.Empty;

    /// <summary>An icon key from <c>KurdnezamIcons</c>; the frontend maps it to a lucide icon.</summary>
    public string Icon { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
