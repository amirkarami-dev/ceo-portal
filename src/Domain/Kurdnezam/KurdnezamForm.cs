using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A registration form advertised on the site (<c>/forms/{id}</c>), e.g. pool sign-up or the
/// membership/licence guide. Members submit it as a <see cref="KurdnezamFormSubmission"/>.
/// </summary>
public class KurdnezamForm : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Note { get; set; } = string.Empty;

    /// <summary>Deadline as displayed, e.g. <c>۲۵ خرداد ۱۴۰۵</c>.</summary>
    public string Deadline { get; set; } = string.Empty;

    public string Image { get; set; } = string.Empty;

    /// <summary>When false the form is listed but closed to new submissions.</summary>
    public bool IsOpen { get; set; } = true;

    public int SortOrder { get; set; }

    public ICollection<KurdnezamFormSubmission> Submissions { get; set; } = new List<KurdnezamFormSubmission>();
}
