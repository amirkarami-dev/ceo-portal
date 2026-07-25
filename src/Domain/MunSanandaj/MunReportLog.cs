using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.MunSanandaj;

/// <summary>
/// One row per ATTEMPT at posting a single source row (Peygiri) to the municipality API.
/// Append-only — never updated after insert. The current status of a Peygiri is its latest
/// row (highest Id) for that WorkerType.
/// </summary>
public class MunReportLog : BaseEntity
{
    /// <summary>FK to MunSyncRun.Id (the internal int Id, not the public RunId).</summary>
    public int RunId { get; set; }

    /// <summary>Denormalized copy of the owning run's WorkerType, for simpler queries.</summary>
    public MunWorkerType WorkerType { get; set; }

    /// <summary>Tracking code from sp1, e.g. "90038565090216074508".</summary>
    public string Peygiri { get; set; } = string.Empty;

    /// <summary>darkhast_id.</summary>
    public string ProjectNo { get; set; } = string.Empty;

    /// <summary>melk_id.</summary>
    public string ReqId { get; set; } = string.Empty;

    public string? Nosazi { get; set; }

    public MunLogStatus Status { get; set; }

    /// <summary>1-based count of attempts at this (WorkerType, Peygiri) across all runs.</summary>
    public int AttemptNumber { get; set; }

    /// <summary>The "peigiri" value the endpoint returns on success.</summary>
    public string? RemoteSubmissionId { get; set; }

    /// <summary>Raw JSON response body, for debugging.</summary>
    public string? ResponseBody { get; set; }

    public string? ErrorMessage { get; set; }

    /// <summary>Comma-separated code_meli values auto-created via addEngineer during this attempt (SaveEngMap only).</summary>
    public string? CreatedEngineerCodes { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public DateTimeOffset CompletedAt { get; set; }
}
