using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A tab in the home bento panel (offices, specialist groups, education, statistics, tariffs…).
/// </summary>
/// <remarks>
/// <see cref="Slug"/> is the stable string key the UI switches on (the old TypeScript model used it
/// as the entity's <c>id</c>). The <c>units</c> tab is special-cased by the UI: it ignores
/// <see cref="Items"/> and renders <see cref="KurdnezamUnit"/> instead.
/// </remarks>
public class KurdnezamTabGroup : BaseAuditableEntity
{
    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public ICollection<KurdnezamTabItem> Items { get; set; } = new List<KurdnezamTabItem>();
}
