using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A member of one of the organisation's bodies. <see cref="Group"/> selects which
/// <c>/p/{slug}</c> page the person appears on — see <see cref="KurdnezamPersonGroups"/>.
/// </summary>
public class KurdnezamPerson : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    /// <summary>Optional portrait; the UI falls back to a glyph when absent.</summary>
    public string? Image { get; set; }

    public string Group { get; set; } = KurdnezamPersonGroups.Modir;

    public int SortOrder { get; set; }
}
