namespace Mabhas19.Application.Common.Interfaces;

/// <summary>
/// An engineer as the org's membership DB knows them — the snapshot a welfare reservation stores.
/// </summary>
public sealed record EngineerInfo(
    string NationalCode,
    string FirstName,
    string LastName,
    string ReshteCode,
    string? Mobile,
    /// <summary>
    /// <c>Vazeyat</c> — membership status. <b>0 means active</b>; anything else is not.
    /// Null when the column was absent or empty, which must be treated as NOT active.
    /// </summary>
    int? MembershipStatus = null,
    /// <summary>
    /// <c>PrvExp</c> — پروانه expiry as a <b>Jalali</b> string, e.g. <c>1405/05/01</c>.
    /// Never parse this with <c>DateTime.Parse</c>; use <c>JalaliDate.Parse</c>.
    /// </summary>
    string? LicenceExpiryJalali = null,
    /// <summary><c>MadrakNam</c> — مقطع تحصیلی, used to auto-fill a candidate.</summary>
    string? EducationLevel = null)
{
    public string FullName => $"{FirstName} {LastName}".Trim();

    /// <summary>True only when <c>Vazeyat</c> is exactly 0. Null or any other value is not active.</summary>
    public bool IsActiveMember => MembershipStatus == 0;
}

/// <summary>Read-only lookup into the KurdNezam membership DB (WebS_GetEngineerInfo).</summary>
public interface IEngineerDirectory
{
    /// <summary>Null when the کد ملی is unknown to the org or the directory is unconfigured.</summary>
    Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default);
}
