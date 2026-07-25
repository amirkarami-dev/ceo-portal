using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

/// <summary>
/// A pool (استخر) an engineer can reserve, defined under a <see cref="WelfareService"/> of type
/// <see cref="WelfareServiceType.PoolTicket"/>.
/// </summary>
public class WelfarePool : BaseAuditableEntity
{
    public int ServiceId { get; set; }

    public WelfareService? Service { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// روزهای فعال در هفته — a bitmask where bit 0 = شنبه (Saturday) … bit 6 = جمعه (Friday),
    /// matching the Jalali week the calendar shows. 127 = every day.
    /// </summary>
    public int ActiveDays { get; set; } = 127;

    public string Description { get; set; } = string.Empty;

    /// <summary>وضعیت — inactive pools stay in the admin list but never show to engineers.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>مبلغ قابل پرداخت (ریال).</summary>
    public long PriceRials { get; set; }

    /// <summary>ساعت شروع رزرو، مثل <c>08:00</c>.</summary>
    public string ReserveStartTime { get; set; } = string.Empty;

    /// <summary>ساعت پایان رزرو، مثل <c>22:00</c>.</summary>
    public string ReserveEndTime { get; set; } = string.Empty;

    /// <summary>ظرفیت تعداد رزرو for each calendar day.</summary>
    public int Capacity { get; set; }

    public ICollection<WelfarePoolReservation> Reservations { get; set; } = new List<WelfarePoolReservation>();
}
