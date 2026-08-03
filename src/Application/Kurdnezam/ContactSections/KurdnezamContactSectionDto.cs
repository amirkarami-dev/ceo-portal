namespace Mabhas19.Application.Kurdnezam.ContactSections;

/// <summary>A block of contact details on <c>/p/tamas</c>, with its rows nested.</summary>
public sealed class KurdnezamContactSectionDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Description { get; init; }

    /// <summary>An icon key the site maps to a lucide icon; unknown or null falls back to a default.</summary>
    public string? Icon { get; init; }

    public int SortOrder { get; init; }

    public bool IsActive { get; init; }

    public IReadOnlyList<KurdnezamContactChannelDto> Channels { get; init; } = [];
}

/// <summary>
/// One row inside a section. <see cref="Kind"/> tells the site three things at once: which icon to
/// draw, whether to force <c>dir="ltr"</c> on the value, and whether it becomes a
/// <c>tel:</c> / <c>mailto:</c> / external link.
/// </summary>
public sealed class KurdnezamContactChannelDto
{
    public int Id { get; init; }

    public string Kind { get; init; } = string.Empty;

    /// <summary>Optional qualifier beside the value — «داخلی ۱۰۳».</summary>
    public string? Label { get; init; }

    public string Value { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
