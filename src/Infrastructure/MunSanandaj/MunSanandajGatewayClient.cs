using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// The mahyapardaz REST API. Static HttpClient with a long timeout (NOT the DI typed client) so
/// base64 PDF uploads over a slow municipal link bypass Aspire's 10s-per-attempt resilience
/// handler — same fix already applied to ArvanReportAiService for the analogous reason.
/// </summary>
internal sealed class MunSanandajGatewayClient : IMunSanandajGatewayClient
{
    // The saveEngineerReport/saveEngMap endpoints are reached by raw IP (185.172.68.98) whose TLS
    // certificate does not match the IP (RemoteCertificateNameMismatch), so default validation fails.
    // Accept the server certificate for THIS client only — same trust posture as TrustServerCertificate=True
    // on the SQL connections; this client only ever talks to the fixed municipal mahyapardaz hosts.
    private static readonly HttpClient Http = new(new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
    })
    { Timeout = TimeSpan.FromSeconds(120) };

    private const string MahyapardazBase = "https://185.172.68.98/cakephp/mahyapardaz/services/restapi";
    private const string EeshahrBase = "https://eeshahr.sanandaj.ir/cakephp/mahyapardaz/services/restapi";

    private readonly MunSanandajOptions _options;
    private readonly ILogger<MunSanandajGatewayClient> _logger;

    public MunSanandajGatewayClient(IOptions<MunSanandajOptions> options, ILogger<MunSanandajGatewayClient> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<MunGatewayResult> SaveEngineerReportAsync(string projectNo, string reqId, string pdfBase64, CancellationToken ct = default)
    {
        var url = $"{MahyapardazBase}?method=saveEngineerReport&darkhast_id={projectNo}&melk_id={reqId}";
        var body = new { supervising_engineers_report = new { file = $"data:image/jpg;base64,{pdfBase64}" } };
        var raw = await PostAsync(url, body, ct);
        return ParseSaveEngineerReportResponse(raw);
    }

    public async Task<MunGatewayResult> SaveEngMapAsync(string projectNo, IReadOnlyList<MunEngMapEngineer> engineers, string pdfBase64, CancellationToken ct = default)
    {
        var url = $"{MahyapardazBase}?method=saveEngMap&darkhast_id={projectNo}";
        var body = new
        {
            engineers = engineers.Select(e => new { code_meli = e.CodeMeli, branch = e.Branch, task = e.Task }),
            engReport = new { file = $"data:image/jpeg;base64,{pdfBase64}" },
        };
        var raw = await PostAsync(url, body, ct);
        return ParseSaveEngMapResponse(raw);
    }

    public async Task<MunAddEngineerResult> AddEngineerAsync(MunEngineerInfoDto engineer, CancellationToken ct = default)
    {
        var url = $"{EeshahrBase}?method=addEngineer";
        var body = MunFieldMapper.BuildAddEngineerPayload(engineer);
        var raw = await PostAsync(url, body, ct);
        return ParseAddEngineerResponse(raw);
    }

    private async Task<string> PostAsync(string url, object body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiToken);
        using var response = await Http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);
        // Log the municipal response (status + url + body) so integration issues are diagnosable.
        // The URL carries only method/darkhast_id/melk_id (no secret — the token is in the header).
        _logger.LogInformation("mahyapardaz {Status} {Url} -> {Body}",
            (int)response.StatusCode, url, Truncate(raw, 1500));
        return raw;
    }

    private static string Truncate(string s, int max = 400) =>
        string.IsNullOrEmpty(s) ? "(empty response)" : (s.Length <= max ? s : s[..max] + "…");

    /// <summary>Parses <paramref name="raw"/> as JSON; returns false (not throws) on a non-JSON body
    /// so a bad municipal response fails just that row instead of crashing the whole run.</summary>
    private static bool TryParseJson(string raw, out JsonDocument doc)
    {
        try
        {
            doc = JsonDocument.Parse(raw);
            return true;
        }
        catch (JsonException)
        {
            doc = null!;
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Pure response parsers (also exercised directly by unit tests)
    // ------------------------------------------------------------------

    internal static MunGatewayResult ParseSaveEngineerReportResponse(string raw)
    {
        if (!TryParseJson(raw, out var doc))
            return new MunGatewayResult(false, null, raw, $"non-JSON response from city: {Truncate(raw)}", null);
        using var _ = doc;
        var root = doc.RootElement;

        if (root.TryGetProperty("supervising_engineers_report", out var result)
            && result.TryGetProperty("success", out var successEl) && successEl.GetBoolean())
        {
            var peigiri = result.TryGetProperty("peigiri", out var p) ? p.ToString() : null;
            return new MunGatewayResult(true, peigiri, raw, null, null);
        }

        var error = root.TryGetProperty("error", out var e) ? e.GetString() : "saveEngineerReport failed";
        return new MunGatewayResult(false, null, raw, error, null);
    }

    internal static MunGatewayResult ParseSaveEngMapResponse(string raw)
    {
        if (!TryParseJson(raw, out var doc))
            return new MunGatewayResult(false, null, raw, $"non-JSON response from city: {Truncate(raw)}", null);
        using var _ = doc;
        var root = doc.RootElement;

        // Shape 1: top-level error (e.g. invalid darkhast_id).
        if (root.TryGetProperty("error", out var errorEl))
            return new MunGatewayResult(false, null, raw, errorEl.GetString(), null);

        // Shape 2: per-engineer failures inside "engineers" -> caller must addEngineer + retry.
        Dictionary<string, string>? failedEngineers = null;
        if (root.TryGetProperty("engineers", out var engineersEl) && engineersEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in engineersEl.EnumerateObject())
            {
                if (prop.Value.TryGetProperty("success", out var s) && !s.GetBoolean())
                {
                    failedEngineers ??= new Dictionary<string, string>();
                    failedEngineers[prop.Name] = prop.Value.TryGetProperty("msg", out var msg) ? msg.GetString() ?? "" : "";
                }
            }
        }

        if (failedEngineers is not null)
            return new MunGatewayResult(false, null, raw, "one or more engineers not found", failedEngineers);

        // Shape 3: success -> files.building.{success,peigiri}.
        string? submissionId = null;
        if (root.TryGetProperty("files", out var filesEl)
            && filesEl.TryGetProperty("building", out var buildingEl)
            && buildingEl.TryGetProperty("success", out var bs) && bs.GetBoolean()
            && buildingEl.TryGetProperty("peigiri", out var pg))
        {
            submissionId = pg.ToString();
        }

        return new MunGatewayResult(true, submissionId, raw, null, null);
    }

    internal static MunAddEngineerResult ParseAddEngineerResponse(string raw)
    {
        if (!TryParseJson(raw, out var doc))
            return new MunAddEngineerResult(false, $"non-JSON response from city: {Truncate(raw)}");
        using var _ = doc;
        var root = doc.RootElement;

        // Failure shape: { "success": false, "msg": "..." }
        if (root.TryGetProperty("success", out var successEl) && !successEl.GetBoolean())
        {
            var msg = root.TryGetProperty("msg", out var m) ? m.GetString() : "addEngineer failed";
            return new MunAddEngineerResult(false, msg);
        }

        // Success shape: { "<national_code>": { "success": true } }
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Object
                && prop.Value.TryGetProperty("success", out var s) && s.GetBoolean())
            {
                return new MunAddEngineerResult(true, null);
            }
        }

        return new MunAddEngineerResult(false, $"unexpected addEngineer response shape: {raw}");
    }
}
