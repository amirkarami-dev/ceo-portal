using Mabhas19.Domain.Services;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Domain.UnitTests.Services;

public class ClimateDataTests
{
    [Test]
    public void GetCityClimateResolvesKnownCity()
    {
        ClimateData.GetCityClimate("تهران").ShouldBe("3B");
        ClimateData.GetCityClimate("تبریز").ShouldBe("5");
    }

    [Test]
    public void GetCityClimateFallsBackToColdZone()
    {
        ClimateData.GetCityClimate("ناکجاآباد").ShouldBe("4");
    }

    [Test]
    public void OpaqueTargetForBaselineZoneMatchesTable()
    {
        ClimateData.GetOpaqueTargetR("wall_ext_open", "3B").ShouldBe(1.43);
        ClimateData.GetOpaqueTargetR("roof_flat", "3B").ShouldBe(4.55);
    }

    [Test]
    public void OpaqueTargetScalesWithClimate()
    {
        // wall_ext_open multiplier is 1.0 (== base), so equals the zone base R.
        ClimateData.GetOpaqueTargetR("wall_ext_open", "1").ShouldBe(0.55);
        ClimateData.GetOpaqueTargetR("wall_ext_open", "5").ShouldBe(2.27);
    }

    [TestCase("1", 0.0, 0.4)]    // warm, no shading
    [TestCase("2", 0.6, 0.6)]    // warm, pf in 0.5-0.75 band
    [TestCase("4", 0.0, 0.3)]    // normal, no shading
    [TestCase("4", 1.0, 0.58)]   // normal, deep shading
    public void ShgcLimitsMatchTable(string climate, double pf, double expected)
    {
        ClimateData.GetTransShgcLimit(climate, pf).ShouldBe(expected);
    }

    [Test]
    public void TransULimitsArePresent()
    {
        ClimateData.TransULimitByType["fixed"].ShouldBe(2.38);
        ClimateData.TransULimitByType["door"].ShouldBe(3.84);
    }
}
