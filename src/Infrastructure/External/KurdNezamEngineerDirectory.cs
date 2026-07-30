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

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_connectionString);

    /// <inheritdoc/>
    public async Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default)
        => (await LookupAsync(nationalCode, ct)).Engineer;

    public async Task<DirectoryResult> LookupAsync(string nationalCode, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            logger.LogWarning("KurdNezam engineer directory not configured (ConnectionStrings:KurdNezamDb empty).");
            return new(DirectoryOutcome.Unavailable, null);
        }

        var code = nationalCode.Trim();

        // A malformed code is genuinely "not this org's member", not an outage — the SP is never asked.
        if (code.Length != 10 || !code.All(char.IsAsciiDigit))
        {
            return new(DirectoryOutcome.NotFound, null);
        }

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
            if (!await r.ReadAsync(ct)) return new(DirectoryOutcome.NotFound, null);

            string? S(string column)
            {
                var i = r.GetOrdinal(column);
                return r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i))?.Trim();
            }

            var codeMeli = S("CodeMeli");
            if (string.IsNullOrWhiteSpace(codeMeli)) return new(DirectoryOutcome.NotFound, null);

            // The SP takes an int @Code AS WELL AS a national code, and this repo has already been
            // burned once by getting @Code wrong (see the note above). It is a black box: a fallback
            // branch, a LIKE, or a person holding two membership rows could answer with someone else.
            // If that ever happens during an election, engineer A's ballot would consume engineer B's
            // one-vote slot and B would later be told they had already voted. So verify the answer is
            // about the person we asked about, and refuse a multi-row answer outright.
            if (!string.Equals(codeMeli.Trim(), code, StringComparison.Ordinal))
            {
                logger.LogError("KurdNezam directory answered with a different national code than requested.");
                return new(DirectoryOutcome.Unavailable, null);
            }

            if (await r.ReadAsync(ct))
            {
                logger.LogError("KurdNezam directory returned more than one row for a single national code.");
                return new(DirectoryOutcome.Unavailable, null);
            }

            // Vazeyat: 0 = active, anything else = not active. Read as a nullable int so a missing or
            // non-numeric value stays null, which IsActiveMember treats as NOT active — failing closed.
            int? status = null;
            if (int.TryParse(S("Vazeyat"), out var parsedStatus))
            {
                status = parsedStatus;
            }

            // Nam/NameKhanevadegi hold the Persian names; FirstName/LastName are usually empty.
            return new(DirectoryOutcome.Found, new EngineerInfo(
                codeMeli!,
                S("Nam") is { Length: > 0 } nam ? nam : S("FirstName") ?? string.Empty,
                S("NameKhanevadegi") is { Length: > 0 } fam ? fam : S("LastName") ?? string.Empty,
                S("ReshteID") ?? string.Empty,
                S("Mob"),
                status,
                // Jalali string, e.g. 1405/05/01. Kept as text on purpose — parsing it here with
                // DateTime would read 1405 as a Gregorian year.
                S("PrvExp"),
                S("MadrakNam")));
        }
        catch (Exception ex)
        {
            // Deliberately NOT logging the national code. This line runs on any transient SQL error,
            // and during an election it would accumulate a plaintext list of exactly the people who
            // tried to vote, with timestamps. See ISecretRequest.
            logger.LogError(ex, "KurdNezam engineer lookup failed");

            // Unavailable, NOT NotFound. Returning "not found" here is what would tell every voter
            // «این کد ملی یافت نشد» during a database outage.
            return new(DirectoryOutcome.Unavailable, null);
        }
    }
}
