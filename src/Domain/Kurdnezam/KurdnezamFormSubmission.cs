using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A member's submission of a <see cref="KurdnezamForm"/>.
/// </summary>
/// <remarks>
/// Nothing about the shape is fixed here. The five columns this once had — name, national id,
/// membership no, mobile, notes — are now ordinary <see cref="KurdnezamFormField"/> rows, so a form
/// asks for whatever its administrator decided.
/// </remarks>
public class KurdnezamFormSubmission : BaseAuditableEntity
{
    public int FormId { get; set; }

    public KurdnezamForm? Form { get; set; }

    /// <summary>Set once an administrator has processed the submission.</summary>
    public bool IsHandled { get; set; }

    /// <summary>What the member typed, one row per text field of the form.</summary>
    public ICollection<KurdnezamFormAnswer> Answers { get; set; } = new List<KurdnezamFormAnswer>();

    /// <summary>What the member attached, one row per file.</summary>
    public ICollection<KurdnezamFormAttachment> Attachments { get; set; } = new List<KurdnezamFormAttachment>();
}
