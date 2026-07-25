namespace Mabhas19.Application.Kurdnezam.Categories;

/// <summary>A news category as served to the public site and the admin panel.</summary>
public sealed class KurdnezamCategoryDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public int SortOrder { get; init; }

    /// <summary>How many articles reference this category — a category in use cannot be deleted.</summary>
    public int NewsCount { get; init; }
}
