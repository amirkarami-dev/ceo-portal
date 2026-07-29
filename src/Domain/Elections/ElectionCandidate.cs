using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Elections;

/// <summary>
/// One candidate on a ballot: نام و نام خانوادگی، توضیحات، رشته، مقطع تحصیلی.
/// </summary>
/// <remarks>
/// These are a SNAPSHOT taken when the admin added the candidate — same convention as
/// <see cref="Walfare.WelfarePoolReservation"/>. The ballot must keep saying who stood even if the
/// org record changes later.
/// <para>
/// The admin enters a کد ملی and the fields are filled from the membership directory
/// (<c>Nam</c>/<c>NameKhanevadegi</c>, <c>Reshte</c>, <c>MadrakNam</c>), then stay editable for
/// someone the directory does not know. Typing them by hand invites typos and a رشته that disagrees
/// with the org record.
/// </para>
/// <para>
/// There is deliberately no <c>IsWithdrawn</c>. A mid-election withdrawal is a way to suppress a
/// candidate after voting opened; a genuine withdrawal means cancel and re-run.
/// </para>
/// </remarks>
public class ElectionCandidate : BaseAuditableEntity
{
    public int ElectionId { get; set; }

    public Election? Election { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>توضیحات — free text shown next to the name on the ballot.</summary>
    public string? Description { get; set; }

    /// <summary>
    /// The candidate's own discipline code, for display only. This is NOT an eligibility field —
    /// who may vote is decided by <see cref="Election.EligibleReshtes"/>, never by a candidate's رشته.
    /// </summary>
    public string? ReshteCode { get; set; }

    /// <summary>مقطع تحصیلی, from the directory's <c>MadrakNam</c>.</summary>
    public string? EducationLevel { get; set; }

    /// <summary>Ballot order, so the list does not shuffle between page loads.</summary>
    public int SortOrder { get; set; }
}
