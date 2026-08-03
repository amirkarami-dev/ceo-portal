using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// One line inside a <see cref="KurdnezamContactSection"/> — a number, an address, an email,
/// opening hours.
/// </summary>
public class KurdnezamContactChannel : BaseAuditableEntity
{
    public int SectionId { get; set; }

    public KurdnezamContactSection? Section { get; set; }

    /// <summary>A <see cref="KurdnezamContactChannelKinds"/> value.</summary>
    public string Kind { get; set; } = KurdnezamContactChannelKinds.Phone;

    /// <summary>Optional qualifier shown beside the value — «داخلی ۱۰۳», «فقط صبح‌ها».</summary>
    public string? Label { get; set; }

    public string Value { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}

/// <summary>
/// What a <see cref="KurdnezamContactChannel"/> holds. This drives three things in the UI at once:
/// the icon, whether the value is forced to <c>dir="ltr"</c>, and whether it becomes a
/// <c>tel:</c> / <c>mailto:</c> / external link.
/// </summary>
/// <remarks>
/// Strings, not a C# enum, and on purpose: this API serialises enums as <b>numbers</b>, so an enum
/// would put "3" in the admin dropdown and in the JSON. See GOTCHAS.
/// </remarks>
public static class KurdnezamContactChannelKinds
{
    /// <summary>تلفن ثابت.</summary>
    public const string Phone = "phone";

    /// <summary>تلفن همراه.</summary>
    public const string Mobile = "mobile";

    /// <summary>دورنگار.</summary>
    public const string Fax = "fax";

    /// <summary>پست الکترونیک.</summary>
    public const string Email = "email";

    /// <summary>نشانی.</summary>
    public const string Address = "address";

    /// <summary>کدپستی.</summary>
    public const string Postal = "postal";

    /// <summary>ساعات کاری.</summary>
    public const string Hours = "hours";

    public const string Telegram = "telegram";

    public const string Instagram = "instagram";

    /// <summary>Any other link.</summary>
    public const string Website = "website";

    public static readonly string[] All =
    [
        Phone, Mobile, Fax, Email, Address, Postal, Hours, Telegram, Instagram, Website
    ];

    public static bool IsValid(string? kind) => kind is not null && All.Contains(kind);
}

/// <summary>
/// Icon keys a <see cref="KurdnezamContactSection"/> or a <see cref="KurdnezamOrgPage"/> card may
/// use. The site maps each to a lucide icon.
/// </summary>
/// <remarks>
/// A fixed list, because <c>lucide-react</c> cannot resolve an arbitrary runtime string without
/// bundling the entire library. An unknown or empty key falls back to a default icon rather than
/// crashing the page.
/// </remarks>
public static class KurdnezamContactIcons
{
    public static readonly string[] All =
    [
        // general
        "building", "landmark", "briefcase", "users", "user-round", "headset", "info",
        // contact
        "phone", "mail", "map-pin", "clock", "printer", "globe",
        // organs (the arkan cards)
        "vote", "users-round", "gavel", "scroll-text", "shield-check", "scale",
        // work areas
        "hard-hat", "zap", "flame", "ruler", "file-text", "wrench"
    ];

    public static bool IsValid(string? icon) => icon is not null && All.Contains(icon);
}
