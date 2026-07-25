using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

/// <summary>Kinds of welfare service the org offers. Only pool tickets exist today.</summary>
public enum WelfareServiceType
{
    PoolTicket = 1
}

/// <summary>
/// One welfare offering (خدمت رفاهی) — e.g. "بلیط استخر" — with the window it runs in.
/// Dates are Jalali strings exactly as the admin types them (e.g. <c>۱۴۰۵/۰۵/۰۱</c>), with
/// Gregorian shadows for querying, same convention as KurdnezamNews.DateJalali.
/// </summary>
public class WelfareService : BaseAuditableEntity
{
    public WelfareServiceType Type { get; set; } = WelfareServiceType.PoolTicket;

    public string Title { get; set; } = string.Empty;

    /// <summary>تاریخ شروع (Jalali, as displayed).</summary>
    public string StartDateJalali { get; set; } = string.Empty;

    /// <summary>تاریخ پایان (Jalali, as displayed).</summary>
    public string EndDateJalali { get; set; } = string.Empty;

    /// <summary>تاریخ فعال‌سازی (Jalali, as displayed) — when engineers first see it.</summary>
    public string ActivationDateJalali { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public DateOnly ActivationDate { get; set; }

    /// <summary>قابل دسترس برای مهندسین — the admin's on/off switch.</summary>
    public bool IsAccessible { get; set; } = true;

    public ICollection<WelfarePool> Pools { get; set; } = new List<WelfarePool>();
}
