using System.Globalization;

namespace Mabhas19.Application.Common;

/// <summary>
/// Jalali (شمسی) date plumbing. The UI and the org's databases talk Jalali strings; window and
/// expiry checks need Gregorian <see cref="DateOnly"/>, so both are kept side by side.
/// </summary>
/// <remarks>
/// Moved here from the welfare module when the election service became a second consumer. A Jalali
/// string must NEVER go through <c>DateTime.Parse</c> — <c>1405/05/01</c> would be read as Gregorian
/// year 1405. Always come through <see cref="Parse"/>.
/// </remarks>
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

    /// <summary>Weekday bit: bit 0 = شنبه … bit 6 = جمعه.</summary>
    public static int WeekdayBit(DateOnly date) =>
        date.DayOfWeek == DayOfWeek.Saturday ? 0 : (int)date.DayOfWeek + 1;

    public static bool IsActiveOn(int activeDaysMask, DateOnly date) =>
        (activeDaysMask & (1 << WeekdayBit(date))) != 0;

    /// <summary>Largest input that may go on the stack. Above this, rent from the heap.</summary>
    /// <remarks>
    /// <c>stackalloc</c> sized by the caller's string was a remote kill switch. This is called on
    /// attacker-controlled text — a Bale bot message arrives through an anonymous webhook — and a
    /// megabyte of text asks for two megabytes of stack. <see cref="StackOverflowException"/> cannot be
    /// caught: the whole API process dies, taking every other service on it down mid-election.
    /// </remarks>
    private const int MaxStackDigits = 256;

    /// <summary>Persian/Arabic digits arrive from fa keyboards; parsing wants Latin.</summary>
    public static string NormalizeDigits(string value)
    {
        if (value.Length > MaxStackDigits)
        {
            return NormalizeDigitsOnHeap(value);
        }

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

    /// <summary>Same transformation, heap-allocated, for inputs too long to put on the stack.</summary>
    private static string NormalizeDigitsOnHeap(string value)
    {
        var trimmed = value.Trim();
        var buffer = new char[trimmed.Length];
        var n = 0;

        foreach (var ch in trimmed)
        {
            buffer[n++] = ch switch
            {
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                _ => ch
            };
        }

        return new string(buffer, 0, n);
    }
}

/// <summary>
/// Iran's civil clock, as a fixed <c>+03:30</c> offset.
/// </summary>
/// <remarks>
/// Deliberately NOT <c>TimeZoneInfo.FindSystemTimeZoneById</c>: the id is <c>"Iran Standard Time"</c>
/// on Windows and <c>"Asia/Tehran"</c> in the Linux container, so that call works on a dev machine and
/// throws on the server — the worst possible place to find out. Iran has had no DST since 1401, so a
/// fixed offset is correct for any date this system will handle.
/// </remarks>
public static class IranTime
{
    public static readonly TimeSpan Offset = TimeSpan.FromMinutes(210); // +03:30

    /// <summary>A local Iran date + time as an absolute instant.</summary>
    public static DateTimeOffset ToInstant(DateOnly date, TimeOnly time) =>
        new(date.Year, date.Month, date.Day, time.Hour, time.Minute, time.Second, Offset);

    /// <summary>
    /// Today, in Iran. Used for licence-expiry comparisons: a پروانه expires at the end of an Iranian
    /// calendar day, so UTC's date would be wrong for 3.5 hours out of every 24.
    /// </summary>
    public static DateOnly Today(DateTimeOffset nowUtc) =>
        DateOnly.FromDateTime(nowUtc.ToOffset(Offset).DateTime);
}
