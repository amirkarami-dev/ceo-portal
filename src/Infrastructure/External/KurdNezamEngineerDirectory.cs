using System.Data;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Infrastructure.External;

/// <summary>
/// The API-side twin of the IdP's KurdNezamDirectory: calls <c>[dbo].[WebS_GetEngineerInfo]</c>
/// on the org's membership SQL Server to snapshot who is reserving (name, رشته, mobile).
/// Uses the same ConnectionStrings:KurdNezamDb secret the mun-sanandaj sync already ships.
/// </summary>
public sealed class KurdNezamEngineerDirectory(
    IConfiguration config,
    ILogger<KurdNezamEngineerDirectory> logger) : IEngineerDirectory
{
    private readonly string? _connectionString = config.GetConnectionString("KurdNezamDb");

    public async Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            logger.LogWarning("KurdNezam engineer directory not configured (ConnectionStrings:KurdNezamDb empty).");
            return null;
        }

        var code = nationalCode.Trim();
        if (code.Length != 10 || !code.All(char.IsAsciiDigit)) return null;

        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "dbo.WebS_GetEngineerInfo";
            // @Code MUST be 0 (not null) for a national-code lookup — that is how the SP
            // switches to searching by CodeMeli.
            // NOTE: never write `new SqlParameter("@Code", 0)`. The literal 0 binds to the
            // (string, SqlDbType) overload instead of (string, object), so the parameter is
            // declared with NO value and SQL Server answers "expects parameter '@Code',
            // which was not supplied" — every lookup then silently returned "not found".
            cmd.Parameters.Add(new SqlParameter("@Code", SqlDbType.Int) { Value = 0 });
            cmd.Parameters.Add(new SqlParameter("@NationalCode", SqlDbType.NVarChar, 20) { Value = code });

            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;

            string? S(string column)
            {
                var i = r.GetOrdinal(column);
                return r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i))?.Trim();
            }

            var codeMeli = S("CodeMeli");
            if (string.IsNullOrWhiteSpace(codeMeli)) return null;

            // Nam/NameKhanevadegi hold the Persian names; FirstName/LastName are usually empty.
            return new EngineerInfo(
                codeMeli!,
                S("Nam") is { Length: > 0 } nam ? nam : S("FirstName") ?? string.Empty,
                S("NameKhanevadegi") is { Length: > 0 } fam ? fam : S("LastName") ?? string.Empty,
                S("ReshteID") ?? string.Empty,
                S("Mob"));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "KurdNezam engineer lookup failed for national code {Code}", code);
            return null;
        }
    }
}
