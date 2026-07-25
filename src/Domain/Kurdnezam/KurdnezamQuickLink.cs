using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A shortcut to an external engineering portal, rendered in the header dock and footer.
/// <see cref="Icon"/> is a key the frontend maps to a lucide icon
/// (engineer, owner, badge, membership, automation, gas, power).
/// </summary>
public class KurdnezamQuickLink : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Href { get; set; } = string.Empty;

    public string Icon { get; set; } = KurdnezamIcons.Badge;

    public int SortOrder { get; set; }
}
