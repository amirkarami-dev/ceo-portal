namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// Configuration for the SQL-backed FarsNezam analytics path.
/// Bound from <c>ConnectionStrings:AnalyticsDb</c>.
/// Set this to a non-empty value to activate SQL mode; leave empty for in-memory sample mode.
/// </summary>
public sealed class SqlAnalyticsOptions
{
    /// <summary>
    /// SQL Server connection string for the FarsNezam database.
    /// Must come from user-secrets or an environment variable — never hard-coded.
    /// Key: <c>ConnectionStrings:AnalyticsDb</c>.
    /// </summary>
    public string ConnectionString { get; init; } = string.Empty;

    /// <summary>Per-query timeout in seconds. Defaults to 60.</summary>
    public int CommandTimeoutSeconds { get; init; } = 60;

    /// <summary>Default row cap when no <c>limit</c> is specified. Defaults to 1 000.</summary>
    public int DefaultRowLimit { get; init; } = 1_000;
}
