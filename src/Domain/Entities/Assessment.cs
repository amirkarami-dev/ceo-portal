using Mabhas19.Domain.Enums;

namespace Mabhas19.Domain.Entities;

/// <summary>
/// The Section 19 energy assessment for a project. The detailed inputs and per-tool
/// results are persisted as JSON (SQL Server nvarchar(max)); summary scores are denormalised
/// for querying and reporting.
/// </summary>
public class Assessment : BaseAuditableEntity
{
    public int ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    /// <summary>Raw inputs for all six checklists (JSON).</summary>
    public string InputJson { get; set; } = "{}";

    /// <summary>Per-tool results: { toolKey: { score, maxScore, details } } (JSON).</summary>
    public string ResultJson { get; set; } = "{}";

    public int TotalScore { get; set; }

    public int MaxScore { get; set; }

    public AssessmentStatus Status { get; set; } = AssessmentStatus.Draft;

    public ICollection<AssessmentReport> Reports { get; } = new List<AssessmentReport>();
}
