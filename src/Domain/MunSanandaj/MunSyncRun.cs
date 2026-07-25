using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.MunSanandaj;

/// <summary>One row per worker execution (a 12h timer tick or a manual "run now").</summary>
public class MunSyncRun : BaseEntity
{
    /// <summary>Public identifier used by the API/frontend (internal Id is EF-only).</summary>
    public Guid RunId { get; set; }

    public MunWorkerType WorkerType { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public MunRunStatus Status { get; set; }

    /// <summary>Rows returned by sp1 (WebS_GetListRepToShahrdari) for this run.</summary>
    public int TotalRows { get; set; }

    public int SuccessCount { get; set; }

    public int FailedCount { get; set; }

    public MunRunTrigger TriggeredBy { get; set; }

    /// <summary>Admin email, only set when TriggeredBy == Manual.</summary>
    public string? TriggeredByUser { get; set; }
}
