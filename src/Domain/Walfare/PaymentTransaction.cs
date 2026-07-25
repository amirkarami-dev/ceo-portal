using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

public enum PaymentGateway
{
    IranKish = 1
}

public enum PaymentStatus
{
    /// <summary>Token requested; the payer was sent to the gateway.</summary>
    Initiated = 0,

    /// <summary>The gateway called back and the purchase VERIFIED successfully.</summary>
    Succeeded = 1,

    /// <summary>The gateway reported failure, or verification failed.</summary>
    Failed = 2
}

/// <summary>
/// One attempt to pay through a gateway. This is the payment subsystem's ledger row — welfare pool
/// tickets write here today, and any future paid service reuses it via <see cref="TargetType"/> /
/// <see cref="TargetId"/> instead of adding its own transaction table. Admin payment reports read
/// this table only.
/// </summary>
public class PaymentTransaction : BaseAuditableEntity
{
    public PaymentGateway Gateway { get; set; } = PaymentGateway.IranKish;

    /// <summary>Amount in ریال.</summary>
    public long AmountRials { get; set; }

    /// <summary>Our merchant-side id, sent to the gateway as PaymentId (unique per attempt).</summary>
    public string PaymentId { get; set; } = string.Empty;

    /// <summary>Gateway token for this attempt; the callback echoes it back.</summary>
    public string? Token { get; set; }

    public PaymentStatus Status { get; set; } = PaymentStatus.Initiated;

    /// <summary>What was paid for, e.g. <c>pool-reservation</c>. Lets one ledger serve many features.</summary>
    public string TargetType { get; set; } = string.Empty;

    public int TargetId { get; set; }

    /// <summary>OIDC subject of the payer.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Payer identity snapshot, so reports read without joining external systems.</summary>
    public string PayerName { get; set; } = string.Empty;

    public string PayerNationalCode { get; set; } = string.Empty;

    // ── gateway results (filled by the callback / verify) ────────────────────
    public string? ResponseCode { get; set; }

    /// <summary>شماره ارجاع بانکی.</summary>
    public string? RetrievalReferenceNumber { get; set; }

    /// <summary>شماره پیگیری — surfaces to the user as the tracking code.</summary>
    public string? SystemTraceAuditNumber { get; set; }

    public string? MaskedPan { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }
}
