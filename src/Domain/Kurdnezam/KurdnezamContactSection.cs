using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A block of contact details on <c>/p/tamas</c> — «دفتر مرکزی», «روابط عمومی», «واحد حقوقی» …
/// </summary>
/// <remarks>
/// Deliberately <b>not</b> the same list as <see cref="KurdnezamUnit"/>. A contact block and a
/// department are different things: «دفتر مرکزی» is not a unit, and a unit may have no public
/// number. Tying them would force every unit onto the page and forbid anything that is not one.
/// </remarks>
public class KurdnezamContactSection : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    /// <summary>One line under the title; optional.</summary>
    public string? Description { get; set; }

    /// <summary>A <see cref="KurdnezamContactIcons"/> key, resolved to a lucide icon by the site.</summary>
    public string? Icon { get; set; }

    public int SortOrder { get; set; }

    /// <summary>Lets a section come off the page for a while without deleting its channels.</summary>
    public bool IsActive { get; set; } = true;

    public ICollection<KurdnezamContactChannel> Channels { get; set; } = new List<KurdnezamContactChannel>();
}
