using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>A news category. Drives the news filter pills and the home news rail.</summary>
public class KurdnezamCategory : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public ICollection<KurdnezamNews> News { get; set; } = new List<KurdnezamNews>();
}
