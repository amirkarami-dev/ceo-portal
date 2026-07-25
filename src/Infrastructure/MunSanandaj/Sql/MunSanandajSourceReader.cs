using System.Data;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Mabhas19.Infrastructure.MunSanandaj.Sql;

/// <summary>Read-only access to the KurdNezam SQL Server (ConnectionStrings:KurdNezamDb).</summary>
internal sealed class MunSanandajSourceReader : IMunSanandajSourceReader
{
    private readonly string _connectionString;

    public MunSanandajSourceReader(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("KurdNezamDb")
            ?? throw new InvalidOperationException("ConnectionStrings:KurdNezamDb is not configured.");
    }

    public async Task<IReadOnlyList<MunSourceRowDto>> GetPendingReportsAsync(CancellationToken ct = default)
    {
        var rows = new List<MunSourceRowDto>();
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("[dbo].[WebS_GetListRepToShahrdari]", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new MunSourceRowDto(
                Peygiri: reader["Peygiri"].ToString() ?? string.Empty,
                ProjectNo: reader["ProjectNo"].ToString() ?? string.Empty,
                Nosazi: reader["Nosazi"] == DBNull.Value ? null : reader["Nosazi"].ToString(),
                ReqId: reader["ReqId"].ToString() ?? string.Empty));
        }
        return rows;
    }

    public async Task<IReadOnlyList<MunEngineerInfoDto>> GetEngineersAsync(string peygiri, CancellationToken ct = default)
    {
        var rows = new List<MunEngineerInfoDto>();
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("[dbo].[WebS_GetReportFullInfo]", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("@TraceCode", peygiri);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            rows.Add(new MunEngineerInfoDto(
                Ozviat: reader["Ozviat"].ToString() ?? string.Empty,
                ShomarehNezam: reader["ShomarehNezam"].ToString() ?? string.Empty,
                FName: reader["FName"].ToString() ?? string.Empty,
                LName: reader["LName"].ToString() ?? string.Empty,
                TarikhSodur: reader["TarikhSodur"].ToString() ?? string.Empty,
                TarikhTamdid: reader["TarikhTamdid"].ToString() ?? string.Empty,
                TarikhPayanEtebar: reader["TarikhPayanEtebar"].ToString() ?? string.Empty,
                PesronTyp: reader["PesronTyp"].ToString() ?? string.Empty,
                NationalId: reader["NationalId"].ToString() ?? string.Empty,
                Mob: reader["Mob"].ToString() ?? string.Empty,
                PayehNezaratTemp: reader["Payeh_Nezarat_Temp"].ToString() ?? string.Empty,
                Major: reader["Major"].ToString() ?? string.Empty));
        }
        return rows;
    }

    public async Task MarkReportSentAsync(string peygiri, string sabt, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new SqlCommand("[dbo].[WebS_AddSabtNoToReport]", conn)
        {
            CommandType = CommandType.StoredProcedure
        };
        cmd.Parameters.AddWithValue("@Rahgiri", peygiri);
        cmd.Parameters.AddWithValue("@Sabt", sabt);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
