using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A static organisation page served at <c>/p/{slug}</c> (arkan, modir, hayatraise, …).
/// When <see cref="Group"/> is set the page renders the people in that group beneath
/// <see cref="Intro"/>. Previously a hard-coded TypeScript map with no editor.
/// </summary>
/// <remarks>
/// A page with a <see cref="ParentSlug"/> is <b>also</b> a card on its parent's page and an entry in
/// the parent's navigation dropdown — one row drives all three. That is why there is no separate
/// "cards" table: a card and the page it opens could then drift apart, and the header dropdown would
/// stay hard-coded.
/// </remarks>
public class KurdnezamOrgPage : BaseAuditableEntity
{
    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    /// <summary>Optional <see cref="KurdnezamPersonGroups"/> value; null for prose-only pages.</summary>
    public string? Group { get; set; }

    public string Intro { get; set; } = string.Empty;

    /// <summary>
    /// The <see cref="Slug"/> of the hub page this one sits under — <c>arkan</c> for the five
    /// organs. Null for a top-level page. A plain string rather than a self-referencing key: the
    /// slug is already the site's stable public identifier, and it survives a re-seed.
    /// </summary>
    public string? ParentSlug { get; set; }

    /// <summary>A <see cref="KurdnezamContactIcons"/> key for the card; null falls back to a default.</summary>
    public string? Icon { get; set; }

    /// <summary>The one-line card text on the parent page. Empty for pages that are never a card.</summary>
    public string Summary { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
