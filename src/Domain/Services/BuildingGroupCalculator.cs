using Mabhas19.Domain.Enums;

namespace Mabhas19.Domain.Services;

/// <summary>
/// Classifies a building into a Section 19 group from area (m²), floor count and unit count.
/// Faithful port of the legacy <c>calcBuildingGroup</c> client logic.
/// </summary>
public static class BuildingGroupCalculator
{
    public static BuildingGroup Calculate(double area, int floors, int units)
    {
        var areaNum = area < 0 ? 0 : area;
        var floorNum = floors < 0 ? 0 : floors;
        var unitNum = units < 0 ? 0 : units;

        if (floorNum > 10 || areaNum > 5000)
        {
            return BuildingGroup.D;
        }

        if ((floorNum >= 6 && floorNum <= 10) || (areaNum > 2000 && areaNum <= 5000))
        {
            if (unitNum > 30)
            {
                return areaNum < 3000 ? BuildingGroup.Cp : BuildingGroup.Cpp;
            }

            return BuildingGroup.C;
        }

        if ((floorNum >= 3 && floorNum <= 5) || (areaNum > 600 && areaNum <= 2000))
        {
            return unitNum > 30 ? BuildingGroup.Bp : BuildingGroup.B;
        }

        if (floorNum <= 2 && areaNum <= 600)
        {
            return BuildingGroup.A;
        }

        return BuildingGroup.B;
    }

    /// <summary>Persian label used in reports / UI (الف, ب, ب+, ج, ج+, ج++, د).</summary>
    public static string PersianLabel(BuildingGroup group) => group switch
    {
        BuildingGroup.A => "الف",
        BuildingGroup.B => "ب",
        BuildingGroup.Bp => "ب+",
        BuildingGroup.C => "ج",
        BuildingGroup.Cp => "ج+",
        BuildingGroup.Cpp => "ج++",
        BuildingGroup.D => "د",
        _ => "ب"
    };
}
