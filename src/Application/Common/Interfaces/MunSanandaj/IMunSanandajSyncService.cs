using Mabhas19.Domain.MunSanandaj;

namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>
/// Orchestrates one full sync pass for a worker type. Returns the public RunId of the
/// mun_sync_runs row it created — callers (the timer workers and the manual-trigger endpoint)
/// use this to look up the run's final state.
/// </summary>
public interface IMunSanandajSyncService
{
    Task<Guid> RunSaveEngineerReportAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default);

    Task<Guid> RunSaveEngMapAsync(MunRunTrigger trigger, string? triggeredByUser, CancellationToken ct = default);
}
