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

/// <summary>Why a directory lookup produced no engineer.</summary>
public enum DirectoryOutcome
{
    Found = 0,

    /// <summary>The directory answered, and does not know this کد ملی.</summary>
    NotFound,

    /// <summary>
    /// The directory could not answer — unconfigured, unreachable, or it threw.
    /// </summary>
    /// <remarks>
    /// This MUST stay distinct from <see cref="NotFound"/>. `GOTCHAS.md` records
    /// «این کد ملی یافت نشد» once being shown for a SQL parameter bug; if an outage reused that
    /// wording during an election, every voter would be told they are not a member and the office
    /// would spend the day fielding calls about a database problem.
    /// </remarks>
    Unavailable
}

public sealed record DirectoryResult(DirectoryOutcome Outcome, EngineerInfo? Engineer)
{
    public bool IsFound => Outcome == DirectoryOutcome.Found && Engineer is not null;
}

/// <summary>Read-only lookup into the KurdNezam membership DB (WebS_GetEngineerInfo).</summary>
public interface IEngineerDirectory
{
    /// <summary>Null when the کد ملی is unknown to the org or the directory is unconfigured.</summary>
    /// <remarks>
    /// Cannot tell "unknown" apart from "unavailable". Fine for the welfare flow, which refuses either
    /// way — but NOT for voting. Use <see cref="LookupAsync"/> there.
    /// </remarks>
    Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default);

    /// <summary>
    /// Same lookup, but says WHY it found nothing. Used where the difference changes what the user is
    /// told — see <see cref="DirectoryOutcome.Unavailable"/>.
    /// </summary>
    Task<DirectoryResult> LookupAsync(string nationalCode, CancellationToken ct = default);

    /// <summary>False when no connection string is configured, so the caller can fail loudly up front.</summary>
    bool IsConfigured { get; }
}
