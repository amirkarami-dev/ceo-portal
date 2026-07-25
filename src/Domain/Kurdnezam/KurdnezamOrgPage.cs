using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A static organisation page served at <c>/p/{slug}</c> (arkan, modir, hayatraise, …).
/// When <see cref="Group"/> is set the page renders the people in that group beneath
/// <see cref="Intro"/>. Previously a hard-coded TypeScript map with no editor.
/// </summary>
public class KurdnezamOrgPage : BaseAuditableEntity
{
    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    /// <summary>Optional <see cref="KurdnezamPersonGroups"/> value; null for prose-only pages.</summary>
    public string? Group { get; set; }

    public string Intro { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
