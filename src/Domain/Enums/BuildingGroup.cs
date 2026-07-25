namespace Mabhas19.Domain.Enums;

/// <summary>
/// Section 19 building classification by floors / area / units.
/// Codes match the legacy calculator: A=الف, B=ب, Bp=ب+, C=ج, Cp=ج+, Cpp=ج++, D=د.
/// </summary>
public enum BuildingGroup
{
    A = 0,
    B = 1,
    Bp = 2,
    C = 3,
    Cp = 4,
    Cpp = 5,
    D = 6
}
