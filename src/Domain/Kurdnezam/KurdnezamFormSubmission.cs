using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A member's submission of a <see cref="KurdnezamForm"/>. Field names mirror the public
/// registration form (name / national id / membership no / mobile / notes), which previously
/// only called <c>preventDefault()</c> and stored nothing.
/// </summary>
public class KurdnezamFormSubmission : BaseAuditableEntity
{
    public int FormId { get; set; }

    public KurdnezamForm? Form { get; set; }

    /// <summary>نام و نام خانوادگی</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>کد ملی</summary>
    public string NationalId { get; set; } = string.Empty;

    /// <summary>شماره عضویت</summary>
    public string MembershipNo { get; set; } = string.Empty;

    public string Mobile { get; set; } = string.Empty;

    public string? Notes { get; set; }

    /// <summary>Set once an administrator has processed the submission.</summary>
    public bool IsHandled { get; set; }

    /// <summary>What the member typed, one row per text field of the form.</summary>
    public ICollection<KurdnezamFormAnswer> Answers { get; set; } = new List<KurdnezamFormAnswer>();

    /// <summary>What the member attached, one row per file.</summary>
    public ICollection<KurdnezamFormAttachment> Attachments { get; set; } = new List<KurdnezamFormAttachment>();
}
