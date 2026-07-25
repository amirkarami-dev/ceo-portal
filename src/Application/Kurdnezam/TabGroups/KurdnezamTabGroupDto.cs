namespace Mabhas19.Application.Kurdnezam.TabGroups;

/// <summary>A tab in the home bento panel, with its entries nested.</summary>
public sealed class KurdnezamTabGroupDto
{
    public int Id { get; init; }

    /// <summary>Stable string key the UI switches on (the old TypeScript model used it as the id).</summary>
    public string Slug { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public int SortOrder { get; init; }

    public IReadOnlyList<KurdnezamTabItemDto> Items { get; init; } = [];
}

/// <summary>A single entry inside a tab group. A null <see cref="Href"/> renders as a disabled chip.</summary>
public sealed class KurdnezamTabItemDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string? Href { get; init; }

    public string? Note { get; init; }

    public int SortOrder { get; init; }
}
