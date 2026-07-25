using System.Data;
using Microsoft.Data.SqlClient;

namespace Mabhas19.Auth.External;

/// <summary>
/// An engineer resolved from the KurdNezam membership database via
/// <c>[dbo].[WebS_GetEngineerInfo]</c>. Only what login provisioning needs.
/// </summary>
/// <param name="CodeMeli">National code — becomes the auth username verbatim.</param>
/// <param name="Mob">Mobile as stored by the org; OTP goes here.</param>
public sealed record KurdNezamEngineer(
    string CodeMeli,
    string FirstName,
    string LastName,
    string? Mob,
    string? Email);

public interface IKurdNezamDirectory
{
    /// <summary>Look up an engineer by national code. Null when not found or unconfigured.</summary>
    Task<KurdNezamEngineer?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default);
}

/// <summary>
/// Read-only directory over the KurdNezam (نظام مهندسی کردستان) SQL Server, used by the IdP to
/// provision an engineer's login from a کد ملی — the welfare-service counterpart of
/// <see cref="FarsNezamDirectory"/>. Connection string lives in ConnectionStrings:KurdNezamDb
/// (env in prod; the API's mun-sanandaj sync uses the same server, so the secret already exists
/// in deploy/.env as KURDNEZAM_DB_CONN).
/// </summary>
public sealed class KurdNezamDirectory(IConfiguration config, ILogger<KurdNezamDirectory> logger)
    : IKurdNezamDirectory
{
    private readonly string? _connectionString = config.GetConnectionString("KurdNezamDb");

    public async Task<KurdNezamEngineer?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            logger.LogWarning("KurdNezam directory not configured (ConnectionStrings:KurdNezamDb empty).");
            return null;
        }

        var code = nationalCode.Trim();
        // A national code is exactly 10 digits; reject anything else before it reaches SQL.
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
            if (string.IsNullOrWhiteSpace(codeMeli)) return null; // no username without a national code

            // Nam/NameKhanevadegi are the filled Persian names; FirstName/LastName are often empty.
            return new KurdNezamEngineer(
                codeMeli!,
                S("Nam") is { Length: > 0 } nam ? nam : S("FirstName") ?? string.Empty,
                S("NameKhanevadegi") is { Length: > 0 } fam ? fam : S("LastName") ?? string.Empty,
                S("Mob"),
                S("Email"));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "KurdNezam directory lookup failed for national code {Code}", code);
            return null;
        }
    }
}
