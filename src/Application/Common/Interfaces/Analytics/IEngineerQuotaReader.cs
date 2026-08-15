using Mabhas19.Application.Analytics.Reports;

namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>
/// Reads engineer quota consumption for one city and discipline.
/// </summary>
/// <remarks>
/// Its own interface rather than a method on <see cref="IQueryEngine"/>: the engine's contract is
/// "execute a report definition", and this has no definition to execute. It calls a stored procedure
/// with two parameters and returns one wide row.
/// </remarks>
public interface IEngineerQuotaReader
{
    /// <param name="cityId">City id as the procedure numbers them — 1 بانه … 25 بیجار, with gaps.</param>
    /// <param name="reshte">Discipline id, 1 معماری … 7 ترافیک.</param>
    Task<EngineerQuotaDto> GetAsync(int cityId, int reshte, CancellationToken cancellationToken = default);
}
