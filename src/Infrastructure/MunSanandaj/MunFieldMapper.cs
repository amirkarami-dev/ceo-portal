using Mabhas19.Application.Common.Interfaces.MunSanandaj;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Pure mapping helpers from a KurdNezam sp2 engineer row to the two municipality payload
/// shapes. No I/O — kept static and side-effect-free so they're directly unit-testable.
/// </summary>
internal static class MunFieldMapper
{
    public static MunEngMapEngineer ToEngMapEngineer(MunEngineerInfoDto e) =>
        new(e.NationalId, ParseIntOrZero(e.PesronTyp), 1);

    /// <summary>
    /// Builds the addEngineer request body — a JSON array containing exactly one engineer,
    /// per the source spec's example. Comments below mark "// map from X" (authoritative
    /// source field) vs "// hardcoded" (literal constant) per the design spec.
    /// </summary>
    public static object BuildAddEngineerPayload(MunEngineerInfoDto e) => new object[]
    {
        new
        {
            first_name = e.FName,
            last_name = e.LName,
            father_name = "none", // hardcoded
            code_persontype_id = 1, // hardcoded
            national_code = e.NationalId,
            mobile = e.Mob,
            membership_number = e.Ozviat,
            membership_date = e.TarikhSodur,
            renewal_date = e.TarikhSodur, // from TarikhSodur per spec, NOT TarikhTamdid
            membership_expire_date = e.TarikhPayanEtebar,
            license = new object[]
            {
                new
                {
                    license_number = e.Ozviat,
                    license_issue_date = e.TarikhSodur,
                    license_renewal_date = e.TarikhSodur,
                    license_expire_date = e.TarikhPayanEtebar,
                    economic_code = "41123456789", // hardcoded
                    signature_code = "SGN-4589", // hardcoded
                    description = "none", // hardcoded
                    branch = new object[]
                    {
                        new
                        {
                            code_engineeringbase_id = ParseIntOrZero(e.PayehNezaratTemp),
                            code_engineeringbranch_id = 1, // hardcoded
                            code_engineeringtask_id = ParseIntOrZero(e.PesronTyp),
                            issue_date = e.TarikhSodur,
                            expire_date = e.TarikhPayanEtebar,
                        }
                    }
                }
            }
        }
    };

    private static int ParseIntOrZero(string s) => int.TryParse(s, out var v) ? v : 0;
}
