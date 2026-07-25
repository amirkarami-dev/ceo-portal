namespace Mabhas19.Domain.Services;

/// <summary>
/// Section 19 climate-zone reference data and thermal target formulas.
/// Faithful port of the legacy <c>climate.js</c> module. Values are the regulation's.
/// </summary>
public static class ClimateData
{
    public static readonly IReadOnlyDictionary<string, string> Definitions = new Dictionary<string, string>
    {
        ["1"] = "گرم و خشک (زمستان گرم)",
        ["2"] = "گرم و مرطوب",
        ["3A"] = "معتدل و مرطوب",
        ["3B"] = "چهارفصل و کم باران",
        ["4"] = "سرد",
        ["5"] = "خیلی سرد"
    };

    public record CityClimate(string Province, string City, string ClimateCode);

    public static readonly IReadOnlyList<CityClimate> Cities = new List<CityClimate>
    {
        new("آذربایجان شرقی", "تبریز", "5"),
        new("آذربایجان غربی", "ارومیه", "5"),
        new("اردبیل", "اردبیل", "5"),
        new("اصفهان", "اصفهان", "3B"),
        new("البرز", "کرج", "3B"),
        new("ایلام", "ایلام", "3B"),
        new("بوشهر", "بوشهر", "2"),
        new("تهران", "تهران", "3B"),
        new("چهارمحال و بختیاری", "شهرکرد", "5"),
        new("خراسان جنوبی", "بیرجند", "4"),
        new("خراسان رضوی", "مشهد", "4"),
        new("خراسان شمالی", "بجنورد", "5"),
        new("خوزستان", "اهواز", "1"),
        new("زنجان", "زنجان", "4"),
        new("سمنان", "سمنان", "4"),
        new("سیستان و بلوچستان", "زاهدان", "3B"),
        new("فارس", "شیراز", "3B"),
        new("قزوین", "قزوین", "3B"),
        new("قم", "قم", "3B"),
        new("کردستان", "سنندج", "4"),
        new("کرمان", "کرمان", "1"),
        new("کرمانشاه", "کرمانشاه", "4"),
        new("کهگیلویه و بویراحمد", "یاسوج", "5"),
        new("گلستان", "گرگان", "3A"),
        new("گیلان", "رشت", "3A"),
        new("لرستان", "خرم آباد", "4"),
        new("مازندران", "ساری", "3A"),
        new("مرکزی", "اراک", "4"),
        new("هرمزگان", "بندرعباس", "2"),
        new("همدان", "همدان", "5"),
        new("یزد", "یزد", "1")
    };

    public static readonly IReadOnlyDictionary<string, double> OpaqueBaseRByClimate = new Dictionary<string, double>
    {
        ["1"] = 0.55,
        ["2"] = 0.88,
        ["3A"] = 1.14,
        ["3B"] = 1.43,
        ["4"] = 1.87,
        ["5"] = 2.27
    };

    public static readonly IReadOnlyDictionary<string, double> OpaqueTargetBy3B = new Dictionary<string, double>
    {
        ["wall_ext_open"] = 1.43,
        ["wall_ext_semi"] = 1.19,
        ["wall_soil"] = 0.15,
        ["roof_flat"] = 4.55,
        ["roof_semi"] = 3.85,
        ["floor_pilot"] = 2.38,
        ["floor_semi"] = 2.0,
        ["floor_soil"] = 0.27,
        ["door_opaque"] = 0.48,
        ["door_garage"] = 0.57
    };

    public static readonly IReadOnlyDictionary<string, double> TransULimitByType = new Dictionary<string, double>
    {
        ["fixed"] = 2.38,
        ["operable"] = 3.03,
        ["door"] = 3.84,
        ["skylight"] = 2.38
    };

    public static string GetCityClimate(string cityName)
    {
        var match = Cities.FirstOrDefault(c => c.City == cityName);
        return match?.ClimateCode ?? "4";
    }

    public static bool IsWarmClimate(string climateCode) => climateCode is "1" or "2";

    /// <summary>Required R-value for an opaque target type at a given climate zone.</summary>
    public static double GetOpaqueTargetR(string targetKey, string climateCode)
    {
        var climateBase = OpaqueBaseRByClimate.TryGetValue(climateCode, out var b) ? b : OpaqueBaseRByClimate["3B"];
        var multiplier = OpaqueTargetBy3B.TryGetValue(targetKey, out var t) ? t / OpaqueBaseRByClimate["3B"] : 1.0;
        return Math.Round(climateBase * multiplier, 2);
    }

    private static readonly (double MaxPf, double Limit)[] ShgcWarm =
    {
        (0.2, 0.4), (0.5, 0.5), (0.75, 0.6), (double.PositiveInfinity, 0.7)
    };

    private static readonly (double MaxPf, double Limit)[] ShgcNormal =
    {
        (0.2, 0.3), (0.5, 0.36), (0.75, 0.48), (double.PositiveInfinity, 0.58)
    };

    /// <summary>Maximum allowed SHGC for a transparent element given climate and projection factor.</summary>
    public static double GetTransShgcLimit(string climateCode, double pf)
    {
        var table = IsWarmClimate(climateCode) ? ShgcWarm : ShgcNormal;
        foreach (var entry in table)
        {
            if (pf < entry.MaxPf) return entry.Limit;
        }
        return table[^1].Limit;
    }
}
