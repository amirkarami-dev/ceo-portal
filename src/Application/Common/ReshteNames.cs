namespace Mabhas19.Application.Common;

/// <summary>
/// The organisation's engineering disciplines (رشته), by the code the membership database stores.
/// </summary>
/// <remarks>
/// <para>
/// There are exactly **seven**. The four names that appear in service documents — سازه، ژئوتکنیک،
/// زه‌کشی، سازه نگهبان — are صلاحیت, not رشته: no column in the org database carries them, so nothing
/// here can resolve them.
/// </para>
/// <para>
/// This is the single source of truth for the mapping. It matters beyond cosmetics: a voting card that
/// says «۴» instead of «مکانیک» is a card a voter cannot read, and the Bale bot renders the same
/// candidates as plain text with no client-side table to fall back on.
/// </para>
/// </remarks>
public static class ReshteNames
{
    private static readonly IReadOnlyDictionary<string, string> ByCode =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["1"] = "معماری",
            ["2"] = "شهرسازی",
            ["3"] = "عمران",
            ["4"] = "مکانیک",
            ["5"] = "برق",
            ["6"] = "نقشه‌برداری",
            ["7"] = "ترافیک",
        };

    /// <summary>Every known code, for anything that needs to offer the full list.</summary>
    public static IEnumerable<KeyValuePair<string, string>> All => ByCode;

    /// <summary>
    /// The Persian name for a code, or <c>null</c> when the code is blank.
    /// </summary>
    /// <remarks>
    /// An **unknown** code degrades to «رشتهٔ {code}» rather than to null. The codes are stored as
    /// opaque strings precisely so an eighth discipline needs no migration, and a card that silently
    /// dropped the field would hide that it happened.
    /// </remarks>
    public static string? Describe(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var normalised = JalaliDate.NormalizeDigits(code).Trim();
        return ByCode.TryGetValue(normalised, out var name) ? name : $"رشتهٔ {normalised}";
    }
}
