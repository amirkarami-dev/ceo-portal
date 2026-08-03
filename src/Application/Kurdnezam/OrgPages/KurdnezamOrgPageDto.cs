namespace Mabhas19.Application.Kurdnezam.OrgPages;

/// <summary>A static organisation page as served to the public site and the admin panel.</summary>
public sealed class KurdnezamOrgPageDto
{
    public int Id { get; init; }

    /// <summary>Route key of <c>/p/{slug}</c>; unique.</summary>
    public string Slug { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    /// <summary>A <see cref="Mabhas19.Domain.Kurdnezam.KurdnezamPersonGroups"/> value, or null for prose-only pages.</summary>
    public string? Group { get; init; }

    public string Intro { get; init; } = string.Empty;

    /// <summary>
    /// Slug of the hub page this one sits under — <c>arkan</c> for the five organs, null for a
    /// top-level page. The site builds both the hub's card grid and its nav dropdown from this.
    /// </summary>
    public string? ParentSlug { get; init; }

    /// <summary>An icon key the site maps to a lucide icon; unknown or null falls back to a default.</summary>
    public string? Icon { get; init; }

    /// <summary>One-line card text on the parent page. Empty for pages that are never a card.</summary>
    public string Summary { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
