using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Projects;
using Mabhas19.Domain.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.External;

/// <summary>
/// Provisions a project from the FarsNezam (نظام مهندسی فارس) external SQL Server.
/// Reads tblProject for the project fields and tblHoghoghiProjectList (joined conceptually
/// with tblMap_TypMohandes) for the engineer-discipline list that becomes the editable
/// assessment sections. Read-only; the connection string lives in ConnectionStrings:FarsNezamDb.
/// </summary>
public class FarsNezamProjectProvider : IExternalProjectProvider
{
    // tblMap_TypMohandes ids → Mabhas19 assessment section keys.
    private static readonly IReadOnlyDictionary<int, string> TypToSection = new Dictionary<int, string>
    {
        [1] = "env",  // طراح معماری
        [3] = "elec", // طراح برق
        [4] = "mech", // طراح مکانیک
    };

    private readonly string? _connectionString;
    private readonly FarsNezamOptions _options;
    private readonly ILogger<FarsNezamProjectProvider> _logger;

    public FarsNezamProjectProvider(
        IConfiguration config,
        IOptions<FarsNezamOptions> options,
        ILogger<FarsNezamProjectProvider> logger)
    {
        _options = options.Value;
        _connectionString = config.GetConnectionString("FarsNezamDb");
        _logger = logger;
    }

    public ProjectSource Source => ProjectSource.FarsNezam;

    public async Task<ExternalProjectDto?> FetchAsync(string externalId, CancellationToken ct = default)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_connectionString))
        {
            _logger.LogWarning("FarsNezam import skipped — not configured (Enabled={Enabled}).", _options.Enabled);
            return null;
        }

        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);

            var dto = await ReadProjectAsync(conn, externalId, ct);
            if (dto is null) return null;

            var sections = await ReadAllowedSectionsAsync(conn, externalId, ct);
            return dto with { AllowedSections = string.Join(",", sections) };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FarsNezam import error for ProjectNo {Pno}", externalId);
            return null;
        }
    }

    private async Task<ExternalProjectDto?> ReadProjectAsync(SqlConnection conn, string pno, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandTimeout = _options.CommandTimeoutSeconds;
        cmd.CommandText =
            "SELECT TOP 1 karfarma, TedadVahed, TedadSaghf, Zirbana, masahat, AddressMahal, shomarehpelak, Qate " +
            "FROM tblProject WHERE ProjectNo = @pno";
        cmd.Parameters.Add(new SqlParameter("@pno", pno));

        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;

        string? Str(int i) => r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i))?.Trim();
        double Dbl(int i) => r.IsDBNull(i) ? 0d : Convert.ToDouble(r.GetValue(i));
        int Int(int i) => r.IsDBNull(i) ? 0 : Convert.ToInt32(r.GetValue(i));

        var zirbana = Dbl(3);
        var masahat = Dbl(4);

        return new ExternalProjectDto
        {
            Title = $"پروژه {pno}",
            Client = Str(0),
            UnitCount = Int(1),
            FloorCount = Int(2),
            TotalArea = zirbana > 0 ? zirbana : masahat,
            Address = Str(5),
            Deed = Str(6),
            Parcel = Str(7),
            City = _options.DefaultCity,
            ClimateCode = _options.DefaultClimateCode,
            SystemId = pno,
        };
    }

    private async Task<List<string>> ReadAllowedSectionsAsync(SqlConnection conn, string pno, CancellationToken ct)
    {
        var sections = new List<string>();
        await using var cmd = conn.CreateCommand();
        cmd.CommandTimeout = _options.CommandTimeoutSeconds;
        cmd.CommandText = "SELECT DISTINCT Typ FROM tblHoghoghiProjectList WHERE ProjectNo = @pno AND Active = 1";
        cmd.Parameters.Add(new SqlParameter("@pno", pno));

        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            if (r.IsDBNull(0)) continue;
            var typ = Convert.ToInt32(r.GetValue(0));
            if (TypToSection.TryGetValue(typ, out var section) && !sections.Contains(section))
            {
                sections.Add(section);
            }
        }
        return sections;
    }
}
