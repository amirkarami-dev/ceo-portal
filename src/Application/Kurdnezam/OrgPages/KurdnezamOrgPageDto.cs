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

    public int SortOrder { get; init; }
}
