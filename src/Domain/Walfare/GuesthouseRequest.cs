using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

public enum GuesthouseRequestStatus
{
    /// <summary>Created by the member or by an admin. No price yet, nothing to pay.</summary>
    Submitted = 0,

    /// <summary>The admin confirmed it and set the amount. The payment token exists from here.</summary>
    Priced = 1,

    /// <summary>The gateway verified server-to-server. Terminal; the referral letter unlocks.</summary>
    Paid = 2,

    Rejected = 3,

    Cancelled = 4
}

/// <summary>Drives «جناب آقای» / «سرکار خانم» on the referral letter.</summary>
public enum ApplicantGender
{
    Male = 0,
    Female = 1
}

/// <summary>نسبت — the fixed list from the paper form.</summary>
public enum CompanionRelation
{
    Spouse = 0,
    Child = 1,
    Father = 2,
    Mother = 3,
    Brother = 4,
    Sister = 5,
    Other = 6
}

/// <summary>
/// One member's request to stay at a guesthouse, from submission through to a printed referral.
/// </summary>
/// <remarks>
/// The person fields are a SNAPSHOT taken at write time — from <c>WebS_GetEngineerInfo</c> for a
/// member, or typed by an admin for somebody the membership database has never heard of. The letter
/// must keep saying who it was issued to even if the org record changes later.
/// </remarks>
public class GuesthouseRequest : BaseAuditableEntity
{
    public int GuesthouseId { get; set; }

    public WelfareGuesthouse? Guesthouse { get; set; }

    /// <summary>
    /// OIDC subject of the member's auth account. NULL when an admin created this for somebody with
    /// no account — which also means the row can never appear in a "my requests" list, so the SMS
    /// link is that person's only door.
    /// </summary>
    public string? UserId { get; set; }

    public bool CreatedByAdmin { get; set; }

    public GuesthouseRequestStatus Status { get; set; } = GuesthouseRequestStatus.Submitted;

    // ── applicant snapshot ───────────────────────────────────────────────────
    public string FullName { get; set; } = string.Empty;

    /// <summary>کد ملی. NOT unique — an admin may type the same person in twice.</summary>
    public string NationalCode { get; set; } = string.Empty;

    public string MembershipNumber { get; set; } = string.Empty;

    public string Mobile { get; set; } = string.Empty;

    /// <summary>
    /// NULL until the admin sets it. The gender select sits on the OFFICE's half of the paper form,
    /// so a member submitting a request never fills it in; the letter refuses to print without it
    /// rather than guessing from a name.
    /// </summary>
    public ApplicantGender? Gender { get; set; }

    // ── the stay ─────────────────────────────────────────────────────────────
    /// <summary>تاریخ ورود, Jalali as displayed (e.g. <c>1405/05/27</c>).</summary>
    public string CheckInDateJalali { get; set; } = string.Empty;

    /// <summary>تاریخ خروج, Jalali as displayed.</summary>
    public string CheckOutDateJalali { get; set; } = string.Empty;

    /// <summary>Gregorian shadow of <see cref="CheckInDateJalali"/> — every query groups by this.</summary>
    public DateOnly CheckInDate { get; set; }

    public DateOnly CheckOutDate { get; set; }

    // ── pricing ──────────────────────────────────────────────────────────────
    /// <summary>Set by the admin when confirming. 0 until then.</summary>
    public long AmountRials { get; set; }

    public string AdminNote { get; set; } = string.Empty;

    // ── payment ──────────────────────────────────────────────────────────────
    /// <summary>
    /// Opaque bearer token for the SMS link. Minted when the request is priced — never at
    /// submission, which would publish a payable link for an amount nobody has set.
    /// </summary>
    public string? PaymentToken { get; set; }

    public DateTimeOffset? PaymentTokenExpiresUtc { get; set; }

    public int? PaymentTransactionId { get; set; }

    public DateTimeOffset? PaidAtUtc { get; set; }

    /// <summary>
    /// شماره فیش. Filled from the gateway's retrieval reference on success, and editable — some
    /// payments still arrive as a bank transfer the admin enters by hand.
    /// </summary>
    public string ReceiptNumber { get; set; } = string.Empty;

    public ICollection<GuesthouseCompanion> Companions { get; set; } = new List<GuesthouseCompanion>();

    /// <summary>
    /// Nights stayed, derived rather than stored — a stored copy is one more thing that can disagree
    /// with the dates beside it. Never negative.
    /// </summary>
    public int Nights => Math.Max(0, CheckOutDate.DayNumber - CheckInDate.DayNumber);

    /// <summary>The applicant plus companions. Infants are not counted.</summary>
    public int GuestCount => 1 + Companions.Count(c => !c.IsInfant);
}

/// <summary>
/// One name travelling with the applicant.
/// </summary>
/// <remarks>
/// One table, not two. The form separates «اسامی همراهان» from «اسامی کودکان زیر دو سال», but both
/// are just a name — the only real difference is that an infant has no نسبت and is not counted for
/// pricing. A boolean says that in one place; two tables would duplicate every query and every form
/// control to express it.
/// </remarks>
public class GuesthouseCompanion : BaseEntity
{
    public int RequestId { get; set; }

    public GuesthouseRequest? Request { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>NULL for an infant, who has no نسبت column on the form.</summary>
    public CompanionRelation? Relation { get; set; }

    /// <summary>«کودک زیر دو سال» — listed separately on the form, not counted for pricing.</summary>
    public bool IsInfant { get; set; }
}
