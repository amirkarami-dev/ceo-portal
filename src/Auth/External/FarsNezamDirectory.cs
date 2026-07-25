using Microsoft.Data.SqlClient;

namespace Mabhas19.Auth.External;

/// <summary>An engineer record resolved from FarsNezam's tblAzayeSazmanMain.</summary>
public sealed record FarsEngineer(string CodeMeli, string FirstName, string LastName, string? Mob);

public interface IFarsNezamDirectory
{
    /// <summary>Look up an engineer by membership code (CodeOzveyat). Null when not found/unconfigured.</summary>
    Task<FarsEngineer?> GetByCodeOzveyatAsync(string codeOzveyat, CancellationToken ct = default);
}

/// <summary>
/// Read-only directory over the FarsNezam (نظام مهندسی فارس) SQL Server, used by the IdP to
/// provision an engineer's login account from a CodeOzveyat. Connection string lives in
/// ConnectionStrings:FarsNezamDb (env/SOPS in prod).
/// </summary>
public sealed class FarsNezamDirectory(IConfiguration config, ILogger<FarsNezamDirectory> logger)
    : IFarsNezamDirectory
{
    private readonly string? _connectionString = config.GetConnectionString("FarsNezamDb");

    public async Task<FarsEngineer?> GetByCodeOzveyatAsync(string codeOzveyat, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            logger.LogWarning("FarsNezam directory not configured (ConnectionStrings:FarsNezamDb empty).");
            return null;
        }
        // CodeOzveyat is a bigint — reject anything non-numeric early.
        if (!long.TryParse(codeOzveyat.Trim(), out var co)) return null;

        try
        {
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT TOP 1 CodeMeli, FirstName, LastName, Mob FROM tblAzayeSazmanMain WHERE CodeOzveyat = @co";
            cmd.Parameters.Add(new SqlParameter("@co", co));

            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;

            string? S(int i) => r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i))?.Trim();
            var codeMeli = S(0);
            if (string.IsNullOrWhiteSpace(codeMeli)) return null; // can't form a username without a national code

            return new FarsEngineer(codeMeli!, S(1) ?? string.Empty, S(2) ?? string.Empty, S(3));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "FarsNezam directory lookup failed for CodeOzveyat {Co}", codeOzveyat);
            return null;
        }
    }
}
