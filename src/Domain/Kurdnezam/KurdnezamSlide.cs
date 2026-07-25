using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A hero-slider slide. First-class content (its own title/subtitle/image/badge) that merely
/// links to a news article via <see cref="NewsId"/> — it is not derived from
/// <see cref="KurdnezamNews.Featured"/>.
/// </summary>
public class KurdnezamSlide : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Subtitle { get; set; } = string.Empty;

    public string Image { get; set; } = string.Empty;

    /// <summary>Target news article the slide links to.</summary>
    public int NewsId { get; set; }

    public KurdnezamNews? News { get; set; }

    public string Badge { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
