namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// The organisation bodies a <see cref="KurdnezamPerson"/> can belong to. These values are a
/// contract with the frontend: they are the <c>/p/{slug}</c> route slugs and the
/// <c>PersonGroup</c> union in the site's TypeScript.
/// </summary>
public static class KurdnezamPersonGroups
{
    /// <summary>هیئت مدیره — board of directors.</summary>
    public const string Modir = "modir";

    /// <summary>هیئت رئیسه — executive board.</summary>
    public const string HayatRaise = "hayatraise";

    /// <summary>بازرسین — inspectors.</summary>
    public const string Bazrsin = "bazrsin";

    /// <summary>شورای انتظامی — disciplinary council.</summary>
    public const string ShorayeEntezami = "shorayeentezami";

    /// <summary>مجمع عمومی — general assembly.</summary>
    public const string MajmaeOmumi = "majmaeomumi";

    public static readonly string[] All = { Modir, HayatRaise, Bazrsin, ShorayeEntezami, MajmaeOmumi };

    public static bool IsValid(string? group) => group is not null && All.Contains(group);
}

/// <summary>Icon keys a <see cref="KurdnezamQuickLink"/> may use; mapped to lucide icons in the UI.</summary>
public static class KurdnezamIcons
{
    public const string Engineer = "engineer";
    public const string Owner = "owner";
    public const string Badge = "badge";
    public const string Membership = "membership";
    public const string Automation = "automation";
    public const string Gas = "gas";
    public const string Power = "power";

    public static readonly string[] All = { Engineer, Owner, Badge, Membership, Automation, Gas, Power };

    public static bool IsValid(string? icon) => icon is not null && All.Contains(icon);
}
