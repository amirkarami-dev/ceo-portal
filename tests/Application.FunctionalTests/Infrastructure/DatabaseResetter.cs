using Microsoft.Data.SqlClient;
using Respawn;
using Respawn.Graph;
using System.Data.Common;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

internal sealed class DatabaseResetter : IAsyncDisposable
{
    private readonly DbConnection _connection;
    private readonly Respawner _respawner;

    private DatabaseResetter(DbConnection connection, Respawner respawner)
    {
        _connection = connection;
        _respawner = respawner;
    }

    public static async Task<DatabaseResetter> CreateAsync(string connectionString)
    {
        var connection = new SqlConnection(connectionString);

        await connection.OpenAsync();
        // Protect the EF migration history table so that any WebApplicationFactory
        // started after a reset can still detect already-applied migrations and skip
        // re-running them (MigrateAsync is idempotent only when the history is intact).
        var respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            TablesToIgnore = [new Table("__EFMigrationsHistory")]
        });
        await connection.CloseAsync();
        return new DatabaseResetter(connection, respawner);
    }

    public async Task ResetAsync()
    {
        await _connection.OpenAsync();
        await _respawner.ResetAsync(_connection);
        await _connection.CloseAsync();
    }

    public async ValueTask DisposeAsync() => await _connection.DisposeAsync();
}
