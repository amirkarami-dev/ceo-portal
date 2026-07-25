using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>An external link rendered in the site footer.</summary>
public class KurdnezamFooterLink : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Href { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
