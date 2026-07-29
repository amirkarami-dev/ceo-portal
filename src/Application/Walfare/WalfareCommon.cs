using Mabhas19.Application.Common;
using Mabhas19.Domain.Walfare;

namespace Mabhas19.Application.Walfare;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed class WelfareServiceDto
{
    public int Id { get; init; }
    public WelfareServiceType Type { get; init; }
    public string Title { get; init; } = string.Empty;
    public string StartDate { get; init; } = string.Empty;
    public string EndDate { get; init; } = string.Empty;
    public string ActivationDate { get; init; } = string.Empty;
    public bool IsAccessible { get; init; }
    public int PoolCount { get; init; }
}

public sealed class WelfarePoolDto
{
    public int Id { get; init; }
    public int ServiceId { get; init; }
    public string Name { get; init; } = string.Empty;
    public int ActiveDays { get; init; }
    public string Description { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public long PriceRials { get; init; }
    public string ReserveStartTime { get; init; } = string.Empty;
    public string ReserveEndTime { get; init; } = string.Empty;
    public int Capacity { get; init; }
}

/// <summary>A pool as offered for ONE specific day, with live remaining capacity.</summary>
public sealed class PoolAvailabilityDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public long PriceRials { get; init; }
    public string ReserveStartTime { get; init; } = string.Empty;
    public string ReserveEndTime { get; init; } = string.Empty;
    public int Capacity { get; init; }
    public int Reserved { get; init; }
    public int Remaining { get; init; }
}

/// <summary>
/// What the booking calendar needs to mark days BEFORE a day is picked: the service window plus
/// the union of its active pools' weekday masks. One call covers every month the user browses —
/// the per-day pool list (with live capacity) still comes from <c>pools/for-date</c>.
/// </summary>
public sealed class ServiceCalendarDto
{
    public int ServiceId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string StartDate { get; init; } = string.Empty;
    public string EndDate { get; init; } = string.Empty;
    public bool IsAccessible { get; init; }
    /// <summary>Union of every ACTIVE pool's ActiveDays bitmask; bit 0 = شنبه … bit 6 = جمعه.</summary>
    public int ActiveDays { get; init; }
    public int PoolCount { get; init; }
    public long? MinPriceRials { get; init; }
}

/// <summary>The signed-in engineer as the org's membership DB knows them.</summary>
public sealed class WalfareEngineerDto
{
    public string FullName { get; init; } = string.Empty;
    public string NationalCode { get; init; } = string.Empty;
    public string ReshteCode { get; init; } = string.Empty;
    public string? Mobile { get; init; }
}

public sealed class ReservationDto
{
    public int Id { get; init; }
    public int PoolId { get; init; }
    public string PoolName { get; init; } = string.Empty;
    public string Date { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string NationalCode { get; init; } = string.Empty;
    public string ReshteCode { get; init; } = string.Empty;
    public string Mobile { get; init; } = string.Empty;
    public long AmountRials { get; init; }
    public ReservationStatus Status { get; init; }
    public string? TrackingCode { get; init; }
    public DateTimeOffset Created { get; init; }
}

public sealed class PaymentTransactionDto
{
    public int Id { get; init; }
    public PaymentGateway Gateway { get; init; }
    public long AmountRials { get; init; }
    public string PaymentId { get; init; } = string.Empty;
    public PaymentStatus Status { get; init; }
    public string TargetType { get; init; } = string.Empty;
    public int TargetId { get; init; }
    public string PayerName { get; init; } = string.Empty;
    public string PayerNationalCode { get; init; } = string.Empty;
    public string? MaskedPan { get; init; }
    public string? RetrievalReferenceNumber { get; init; }
    public string? SystemTraceAuditNumber { get; init; }
    public string? Description { get; init; }
    public DateTimeOffset Created { get; init; }
    public DateTimeOffset? VerifiedAt { get; init; }
}

/// <summary>Paged wrapper reused by the admin lists.</summary>
public sealed class WalfarePagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(Total / (double)PageSize);
}
