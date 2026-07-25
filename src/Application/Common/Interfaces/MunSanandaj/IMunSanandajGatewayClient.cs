namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>One entry of the saveEngMap "engineers" array.</summary>
public sealed record MunEngMapEngineer(string CodeMeli, int Branch, int Task);

/// <summary>
/// Uniform result for saveEngineerReport / saveEngMap.
/// <paramref name="FailedEngineerMessages"/> is non-null only for saveEngMap when one or more
/// engineers came back with success:false (code_meli -> msg) — the caller uses this to drive
/// the addEngineer-then-retry flow.
/// </summary>
public sealed record MunGatewayResult(
    bool Success,
    string? RemoteSubmissionId,
    string RawResponse,
    string? ErrorMessage,
    IReadOnlyDictionary<string, string>? FailedEngineerMessages);

public sealed record MunAddEngineerResult(bool Success, string? ErrorMessage);

/// <summary>The mahyapardaz REST API (Bearer auth via MunSanandaj:ApiToken).</summary>
public interface IMunSanandajGatewayClient
{
    Task<MunGatewayResult> SaveEngineerReportAsync(string projectNo, string reqId, string pdfBase64, CancellationToken ct = default);

    Task<MunGatewayResult> SaveEngMapAsync(string projectNo, IReadOnlyList<MunEngMapEngineer> engineers, string pdfBase64, CancellationToken ct = default);

    Task<MunAddEngineerResult> AddEngineerAsync(MunEngineerInfoDto engineer, CancellationToken ct = default);
}
