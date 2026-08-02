using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

public enum ReservationStatus
{
    /// <summary>Created; the engineer has not completed payment yet.</summary>
    PendingPayment = 0,

    /// <summary>Payment verified; <see cref="WelfarePoolReservation.TrackingCode"/> is set.</summary>
    Paid = 1,

    Cancelled = 2
}

/// <summary>
/// One engineer's reservation of a pool for a specific day.
/// </summary>
/// <remarks>
/// The person fields are a SNAPSHOT taken from <c>WebS_GetEngineerInfo</c> at reservation time —
/// the ticket must keep saying who bought it even if the org record changes later.
/// </remarks>
public class WelfarePoolReservation : BaseAuditableEntity
{
    public int PoolId { get; set; }

    public WelfarePool? Pool { get; set; }

    /// <summary>OIDC subject of the engineer's auth account.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Reserved day, Jalali as displayed (e.g. <c>۱۴۰۵/۰۵/۰۱</c>).</summary>
    public string DateJalali { get; set; } = string.Empty;

    /// <summary>Gregorian shadow of <see cref="DateJalali"/> — capacity checks group by this.</summary>
    public DateOnly Date { get; set; }

    // ── snapshot from the membership DB ──────────────────────────────────────
    public string FullName { get; set; } = string.Empty;

    public string NationalCode { get; set; } = string.Empty;

    /// <summary>
    /// کد رشته — the org's 1–7 discipline code (<c>tblDW_OzviatInfo.Reshte</c>), snapshotted at
    /// booking time.
    /// </summary>
    /// <remarks>
    /// Rows written before 2026-08-01 hold the stored procedure's <c>ReshteID</c> instead (e.g.
    /// <c>3000</c> rather than <c>3</c>) — the directory read that column until then. This field is
    /// display-only on a historical ticket, so those rows are left as they are rather than migrated.
    /// </remarks>
    public string ReshteCode { get; set; } = string.Empty;

    public string Mobile { get; set; } = string.Empty;

    // ── payment ──────────────────────────────────────────────────────────────
    /// <summary>Price at reservation time, so a later price change never re-bills a ticket.</summary>
    public long AmountRials { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.PendingPayment;

    public int? PaymentTransactionId { get; set; }

    public PaymentTransaction? PaymentTransaction { get; set; }

    /// <summary>کد رهگیری — the bank's SystemTraceAuditNumber, set when payment verifies.</summary>
    public string? TrackingCode { get; set; }
}
