namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>One row returned by sp1 [dbo].[WebS_GetListRepToShahrdari].</summary>
public sealed record MunSourceRowDto(string Peygiri, string ProjectNo, string? Nosazi, string ReqId);

/// <summary>One row returned by sp2 [dbo].[WebS_GetReportFullInfo] @TraceCode.</summary>
public sealed record MunEngineerInfoDto(
    string Ozviat,
    string ShomarehNezam,
    string FName,
    string LName,
    string TarikhSodur,
    string TarikhTamdid,
    string TarikhPayanEtebar,
    string PesronTyp,
    string NationalId,
    string Mob,
    string PayehNezaratTemp,
    string Major);

/// <summary>
/// Access to the KurdNezam SQL Server (ConnectionStrings:KurdNezamDb). Reads the pending list
/// and engineer info, and writes back one "mark as sent" record so a successfully-sent report
/// stops appearing in the pending list (city-side de-duplication).
/// </summary>
public interface IMunSanandajSourceReader
{
    /// <summary>Calls sp1 — every row currently pending report/map submission.</summary>
    Task<IReadOnlyList<MunSourceRowDto>> GetPendingReportsAsync(CancellationToken ct = default);

    /// <summary>Calls sp2 for one Peygiri — every engineer assigned to that project (may be more than one).</summary>
    Task<IReadOnlyList<MunEngineerInfoDto>> GetEngineersAsync(string peygiri, CancellationToken ct = default);

    /// <summary>
    /// Calls sp [dbo].[WebS_AddSabtNoToReport] to record that a report was accepted by the city, so
    /// sp1 (WebS_GetListRepToShahrdari) stops returning it — preventing duplicate sends.
    /// </summary>
    /// <param name="peygiri">Tracking code from sp1 → <c>@Rahgiri</c>.</param>
    /// <param name="sabt">Submission id returned by <c>saveEngineerReport</c> → <c>@Sabt</c>.</param>
    Task MarkReportSentAsync(string peygiri, string sabt, CancellationToken ct = default);
}
