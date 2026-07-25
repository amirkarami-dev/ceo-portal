using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A single entry inside a <see cref="KurdnezamTabGroup"/>. An item without an
/// <see cref="Href"/> renders as a disabled "coming soon" chip.
/// </summary>
public class KurdnezamTabItem : BaseAuditableEntity
{
    public int TabGroupId { get; set; }

    public KurdnezamTabGroup? TabGroup { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Href { get; set; }

    public string? Note { get; set; }

    public int SortOrder { get; set; }
}
