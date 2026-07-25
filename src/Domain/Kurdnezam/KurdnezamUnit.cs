using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// An organisational unit (واحد). Surfaced at <c>/tab-item/{id}</c> and in the "units" tab
/// of the home bento panel. <c>Head</c> is flattened to two columns so it stays editable in admin.
/// </summary>
public class KurdnezamUnit : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? HeadName { get; set; }

    public string? HeadRole { get; set; }

    public int SortOrder { get; set; }

    public ICollection<KurdnezamNews> News { get; set; } = new List<KurdnezamNews>();
}
