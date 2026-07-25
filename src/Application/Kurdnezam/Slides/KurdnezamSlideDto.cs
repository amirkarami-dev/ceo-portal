namespace Mabhas19.Application.Kurdnezam.Slides;

/// <summary>A hero-slider slide as served to the public site and the admin panel.</summary>
public sealed class KurdnezamSlideDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Subtitle { get; init; } = string.Empty;

    public string Image { get; init; } = string.Empty;

    /// <summary>Target news article the slide links to.</summary>
    public int NewsId { get; init; }

    /// <summary>Denormalised so the admin panel can show which article the slide points at.</summary>
    public string? NewsTitle { get; init; }

    public string Badge { get; init; } = string.Empty;

    public int SortOrder { get; init; }
}
