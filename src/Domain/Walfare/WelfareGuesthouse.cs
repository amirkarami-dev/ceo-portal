using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

/// <summary>
/// One مهمانسرا the organisation refers members to. Sits under a <see cref="WelfareService"/>
/// exactly as <see cref="WelfarePool"/> does, so the admin gets the same on/off switch and the same
/// activation window without a second kind of management screen.
/// </summary>
public class WelfareGuesthouse : BaseAuditableEntity
{
    public int ServiceId { get; set; }

    public WelfareService? Service { get; set; }

    /// <summary>«مهمانسرای ...» — printed on the referral letter.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>شهرستان.</summary>
    public string City { get; set; } = string.Empty;

    /// <summary>«مسئول محترم مهمانسرای ...» — who the letter is addressed to.</summary>
    public string ManagerName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>Beds available. NULL means "not tracked", which is every guesthouse today.</summary>
    /// <remarks>
    /// Deliberately unused: this service is a referral, not a booking engine — nothing on the paper
    /// form implies rooms or a calendar. The column exists so that if guesthouses do start filling
    /// up, the rule is an overlap query over data we already hold rather than a migration.
    /// </remarks>
    public int? Capacity { get; set; }

    public ICollection<GuesthouseRequest> Requests { get; set; } = new List<GuesthouseRequest>();
}
