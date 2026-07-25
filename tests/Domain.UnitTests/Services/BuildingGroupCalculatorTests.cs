using Mabhas19.Domain.Enums;
using Mabhas19.Domain.Services;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Domain.UnitTests.Services;

public class BuildingGroupCalculatorTests
{
    [TestCase(6000, 3, 4, BuildingGroup.D)]   // area > 5000
    [TestCase(1000, 12, 4, BuildingGroup.D)]  // floors > 10
    [TestCase(3000, 8, 10, BuildingGroup.C)]  // 6-10 floors, few units
    [TestCase(2500, 8, 35, BuildingGroup.Cp)] // many units, area < 3000
    [TestCase(4000, 8, 35, BuildingGroup.Cpp)]// many units, area >= 3000
    [TestCase(1000, 4, 10, BuildingGroup.B)]  // 3-5 floors
    [TestCase(1000, 4, 40, BuildingGroup.Bp)] // 3-5 floors, many units
    [TestCase(500, 2, 2, BuildingGroup.A)]    // small building
    public void ClassifiesGroupsAsLegacy(double area, int floors, int units, BuildingGroup expected)
    {
        BuildingGroupCalculator.Calculate(area, floors, units).ShouldBe(expected);
    }

    [Test]
    public void PersianLabelsMatchRegulation()
    {
        BuildingGroupCalculator.PersianLabel(BuildingGroup.A).ShouldBe("الف");
        BuildingGroupCalculator.PersianLabel(BuildingGroup.Cpp).ShouldBe("ج++");
        BuildingGroupCalculator.PersianLabel(BuildingGroup.D).ShouldBe("د");
    }
}
