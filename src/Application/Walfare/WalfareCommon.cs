using System.Globalization;
using Mabhas19.Domain.Walfare;

namespace Mabhas19.Application.Walfare;

/// <summary>
/// Jalali (شمسی) date plumbing for the welfare module. The UI talks Jalali strings; capacity and
/// window checks need Gregorian <see cref="DateOnly"/>, so both are stored side by side.
/// </summary>
public static class JalaliDate
{
    private static readonly PersianCalendar Persian = new();

    /// <summary>"۱۴۰۵/۵/۱" یا "1405/05/01" → Gregorian date. Null when unparseable.</summary>
    public static DateOnly? Parse(string? jalali)
    {
        if (string.IsNullOrWhiteSpace(jalali)) return null;

        var parts = NormalizeDigits(jalali).Split('/', '-');
        if (parts.Length != 3) return null;
        if (!int.TryParse(parts[0], out var y) ||
            !int.TryParse(parts[1], out var m) ||
            !int.TryParse(parts[2], out var d)) return null;
        if (y is < 1300 or > 1500 || m is < 1 or > 12 || d is < 1 or > 31) return null;

        try
        {
            return DateOnly.FromDateTime(Persian.ToDateTime(y, m, d, 0, 0, 0, 0));
        }
        catch (ArgumentOutOfRangeException)
        {
            return null;
        }
    }

    /// <summary>Gregorian → "1405/05/01" (Latin digits; the UI localises digits itself).</summary>
    public static string Format(DateOnly date)
    {
        var dt = date.ToDateTime(TimeOnly.MinValue);
        return $"{Persian.GetYear(dt):0000}/{Persian.GetMonth(dt):00}/{Persian.GetDayOfMonth(dt):00}";
    }

    /// <summary>
    /// Weekday bit for <see cref="WelfarePool.ActiveDays"/>: bit 0 = شنبه … bit 6 = جمعه.
    /// </summary>
    public static int WeekdayBit(DateOnly date) =>
        date.DayOfWeek == DayOfWeek.Saturday ? 0 : (int)date.DayOfWeek + 1;

    public static bool IsActiveOn(int activeDaysMask, DateOnly date) =>
        (activeDaysMask & (1 << WeekdayBit(date))) != 0;

    /// <summary>Persian/Arabic digits arrive from fa keyboards; parsing wants Latin.</summary>
    public static string NormalizeDigits(string value)
    {
        Span<char> buffer = stackalloc char[value.Length];
        var n = 0;
        foreach (var ch in value.Trim())
        {
            buffer[n++] = ch switch
            {
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                _ => ch
            };
        }
        return new string(buffer[..n]);
    }
}

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
