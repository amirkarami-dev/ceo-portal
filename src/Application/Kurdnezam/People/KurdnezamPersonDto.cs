namespace Mabhas19.Application.Kurdnezam.People;

/// <summary>A member of one of the organisation's bodies, as served to the public site and the admin panel.</summary>
public sealed class KurdnezamPersonDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    /// <summary>Optional portrait; the UI falls back to a glyph when absent.</summary>
    public string? Image { get; init; }

    /// <summary>One of <see cref="Mabhas19.Domain.Kurdnezam.KurdnezamPersonGroups"/> — also the <c>/p/{slug}</c> route.</summary>
    public string Group { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
