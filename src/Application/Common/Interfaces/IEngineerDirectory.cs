namespace Mabhas19.Application.Common.Interfaces;

/// <summary>
/// An engineer as the org's membership DB knows them — the snapshot a welfare reservation stores.
/// </summary>
public sealed record EngineerInfo(
    string NationalCode,
    string FirstName,
    string LastName,
    string ReshteCode,
    string? Mobile)
{
    public string FullName => $"{FirstName} {LastName}".Trim();
}

/// <summary>Read-only lookup into the KurdNezam membership DB (WebS_GetEngineerInfo).</summary>
public interface IEngineerDirectory
{
    /// <summary>Null when the کد ملی is unknown to the org or the directory is unconfigured.</summary>
    Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default);
}
