using System.Data;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// Calls <c>[dbo].[F_ShowQuataInCity]</c> on the KurdNezam warehouse.
/// </summary>
/// <remarks>
/// A stored procedure, not generated SQL, so none of <see cref="SqlQueryEngine"/>'s whitelisting
/// applies or is needed: the procedure name is a constant in this file and the two arguments are
/// typed <see cref="SqlDbType.Int"/> parameters. Nothing from the request reaches the command text.
/// </remarks>
internal sealed class EngineerQuotaReader : IEngineerQuotaReader
{
    private const string ProcedureName = "[dbo].[F_ShowQuataInCity]";

    private readonly SqlAnalyticsOptions _options;

    public EngineerQuotaReader(IOptions<SqlAnalyticsOptions> options) => _options = options.Value;

    public async Task<EngineerQuotaDto> GetAsync(
        int cityId,
        int reshte,
        CancellationToken cancellationToken = default)
    {
        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(ProcedureName, conn)
        {
            CommandType    = CommandType.StoredProcedure,
            CommandTimeout = _options.CommandTimeoutSeconds,
        };
        cmd.Parameters.Add("@CityId", SqlDbType.Int).Value = cityId;
        cmd.Parameters.Add("@Reshte", SqlDbType.Int).Value = reshte;

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);

        // One wide row, or none. A city and discipline with no registrations at all returns nothing
        // rather than zeroes, and an all-zero DTO is the right answer for that — the report then
        // draws four full rings, which is true.
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new EngineerQuotaDto();
        }

        return new EngineerQuotaDto
        {
            UsedInTarahi_4 = Dec(reader, "UsedInTarahi_4"),
            UsedInNezart_4 = Dec(reader, "UsedInNezart_4"),
            CntEngin_4     = Int(reader, "CntEngin_4"),

            UsedInTarahi_1 = Dec(reader, "UsedInTarahi_1"),
            UsedInNezart_1 = Dec(reader, "UsedInNezart_1"),
            CntEngin_1     = Int(reader, "CntEngin_1"),

            UsedInTarahi_2 = Dec(reader, "UsedInTarahi_2"),
            UsedInNezart_2 = Dec(reader, "UsedInNezart_2"),
            CntEngin_2     = Int(reader, "CntEngin_2"),

            UsedInTarahi_3 = Dec(reader, "UsedInTarahi_3"),
            UsedInNezart_3 = Dec(reader, "UsedInNezart_3"),
            CntEngin_3     = Int(reader, "CntEngin_3"),
        };
    }

    /// <summary>
    /// Read a numeric column by name, tolerating NULL and whichever numeric type the procedure
    /// happens to return.
    /// </summary>
    /// <remarks>
    /// <c>Convert.ToDecimal</c> rather than <c>(decimal)reader[name]</c>: a direct unbox throws
    /// <see cref="InvalidCastException"/> if the procedure ever returns <c>float</c> or <c>money</c>
    /// where <c>decimal</c> was expected, and that would surface as a 500 on a working database.
    /// The column names are the contract; their exact SQL type is not.
    /// </remarks>
    private static decimal Dec(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is null or DBNull ? 0m : Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static int Int(SqlDataReader reader, string name)
    {
        var value = reader[name];
        return value is null or DBNull ? 0 : Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
    }
}

/// <summary>
/// What the reader is when the analytics warehouse is not configured.
/// </summary>
/// <remarks>
/// The SQL path is config-gated: with no <c>ConnectionStrings:AnalyticsDb</c> the app runs an
/// in-memory sample engine. There is no in-memory stand-in for a stored procedure, so rather than
/// leaving <see cref="IEngineerQuotaReader"/> unregistered — which fails at DI resolution with a
/// message about a missing service — this says what is actually wrong.
/// </remarks>
internal sealed class UnconfiguredEngineerQuotaReader : IEngineerQuotaReader
{
    public Task<EngineerQuotaDto> GetAsync(int cityId, int reshte, CancellationToken cancellationToken = default)
        => throw new InvalidOperationException(
            "The engineer quota report needs the KurdNezam warehouse. Set ConnectionStrings:AnalyticsDb.");
}
