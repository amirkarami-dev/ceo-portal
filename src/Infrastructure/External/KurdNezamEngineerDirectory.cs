using System.Data;
using System.Data.Common;
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

            var row = await MapAsync(r, code, logger, ct);
            if (row.Outcome != DirectoryOutcome.Found || row.Engineer is null)
            {
                return new(row.Outcome, null);
            }

            // The reader has to be finished before another command can run on this connection.
            await r.CloseAsync();

            var reshte = await ReadReshteAsync(conn, row.CodeOzveyat, ct);

            return new(DirectoryOutcome.Found, row.Engineer with { ReshteCode = reshte ?? string.Empty });
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

    /// <summary>
    /// The discipline (رشته), which does <b>not</b> come from the stored procedure.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The real path is <c>WebS_GetEngineerInfo.CodeOzveyat</c> → <c>tblDW_OzviatInfo.Ozviat</c> →
    /// <c>Reshte</c>, and <c>Reshte</c> is the org's 1–7 code (1 معماری … 7 ترافیک) per its own data
    /// dictionary. That is the same table and column the analytics semantic model has read in
    /// production since long before the election service existed.
    /// </para>
    /// <para>
    /// The SP does return columns called <c>ReshteID</c> and <c>Reshte</c>, and <b>neither is this</b>.
    /// <c>ReshteID</c> is a رشته-گرایش id — a live row carries <c>3000</c> — and matching an election's
    /// «۴ = مکانیک» against it would refuse every mechanical engineer from their own election.
    /// </para>
    /// <para>
    /// Null when the membership row has no matching warehouse row. That leaves
    /// <see cref="EngineerInfo.ReshteCode"/> empty, which fails <i>closed</i> for a discipline-restricted
    /// election — the safe direction. A SQL failure instead throws, and the caller's catch reports
    /// Unavailable, so an outage is never mistaken for "wrong discipline".
    /// </para>
    /// </remarks>
    private static async Task<string?> ReadReshteAsync(
        SqlConnection conn, string? codeOzveyat, CancellationToken ct)
    {
        if (!int.TryParse(codeOzveyat, out var ozviat))
        {
            return null;
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 [Reshte] FROM [dbo].[tblDW_OzviatInfo] WHERE [Ozviat] = @oz";
        cmd.Parameters.Add(new SqlParameter("@oz", SqlDbType.Int) { Value = ozviat });

        var value = await cmd.ExecuteScalarAsync(ct);

        return value is null or DBNull ? null : Convert.ToString(value)?.Trim();
    }

    /// <summary>The first row of the stored procedure, before the discipline is resolved.</summary>
    /// <remarks><see cref="EngineerInfo.ReshteCode"/> is empty here — see <see cref="ReadReshteAsync"/>.</remarks>
    internal sealed record EngineerRow(DirectoryOutcome Outcome, EngineerInfo? Engineer, string? CodeOzveyat);

    /// <summary>
    /// Turns the row the reader is currently on into a result. Extracted so it can be tested against
    /// a one-row and a two-row reader without a database — the ordering below is the whole point.
    /// </summary>
    /// <param name="r">Positioned on the first row already.</param>
    internal static async Task<EngineerRow> MapAsync(
        DbDataReader r, string code, ILogger logger, CancellationToken ct)
    {
            string? S(string column)
            {
                var i = r.GetOrdinal(column);
                return r.IsDBNull(i) ? null : Convert.ToString(r.GetValue(i))?.Trim();
            }

            // ── EVERY field comes out of THIS row, before the reader is touched again. ──
            //
            // The multi-row check below calls ReadAsync, which ADVANCES the reader. For the normal
            // single-row answer it returns false — and leaves the reader positioned past the end, so
            // any S(...) after it throws "Invalid attempt to read when no data is present". That
            // exception was caught below and reported as Unavailable, which
            // GetByNationalCodeAsync flattens to null, which the welfare page renders as
            // «این حساب، حساب مهندس نیست».
            //
            // So a reader-position slip told every engineer on the platform that they were not a
            // member. Read first, advance second; do not reorder these.
            var codeMeli   = S("CodeMeli");
            var nam        = S("Nam");
            var famName    = S("NameKhanevadegi");
            var firstName  = S("FirstName");
            var lastName   = S("LastName");
            // The membership number, and the ONLY thing here that leads to the discipline. Neither
            // of the SP's own رشته-ish columns is the code an election matches on — see
            // ReadReshteAsync, which joins this to tblDW_OzviatInfo.
            var codeOzveyat = S("CodeOzveyat");
            var mobile     = S("Mob");
            var vazeyat    = S("Vazeyat");
            // Jalali string, e.g. 1405/05/01. Kept as text on purpose — parsing it here with
            // DateTime would read 1405 as a Gregorian year.
            var prvExp     = S("PrvExp");
            var madrakNam  = S("MadrakNam");

            if (string.IsNullOrWhiteSpace(codeMeli)) return new(DirectoryOutcome.NotFound, null, null);

            // The SP takes an int @Code AS WELL AS a national code, and this repo has already been
            // burned once by getting @Code wrong (see the note above). It is a black box: a fallback
            // branch, a LIKE, or a person holding two membership rows could answer with someone else.
            // If that ever happens during an election, engineer A's ballot would consume engineer B's
            // one-vote slot and B would later be told they had already voted. So verify the answer is
            // about the person we asked about, and refuse a multi-row answer outright.
            if (!string.Equals(codeMeli.Trim(), code, StringComparison.Ordinal))
            {
                logger.LogError("KurdNezam directory answered with a different national code than requested.");
                return new(DirectoryOutcome.Unavailable, null, null);
            }

            // Safe now: every value above is already captured.
            if (await r.ReadAsync(ct))
            {
                logger.LogError("KurdNezam directory returned more than one row for a single national code.");
                return new(DirectoryOutcome.Unavailable, null, null);
            }

            // Vazeyat: 0 = active, anything else = not active. Read as a nullable int so a missing or
            // non-numeric value stays null, which IsActiveMember treats as NOT active — failing closed.
            int? status = null;
            if (int.TryParse(vazeyat, out var parsedStatus))
            {
                status = parsedStatus;
            }

            // Nam/NameKhanevadegi hold the Persian names; FirstName/LastName are usually empty.
            // ReshteCode is left empty here on purpose — the caller resolves it from CodeOzveyat.
            return new(
                DirectoryOutcome.Found,
                new EngineerInfo(
                    codeMeli!,
                    nam is { Length: > 0 } ? nam : firstName ?? string.Empty,
                    famName is { Length: > 0 } ? famName : lastName ?? string.Empty,
                    string.Empty,
                    mobile,
                    status,
                    prvExp,
                    madrakNam),
                codeOzveyat);
    }
}
