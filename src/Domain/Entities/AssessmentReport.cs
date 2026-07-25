namespace Mabhas19.Domain.Entities;

/// <summary>Metadata for a generated PDF report stored in object storage (MinIO/S3).</summary>
public class AssessmentReport : BaseAuditableEntity
{
    public int AssessmentId { get; set; }

    public Assessment Assessment { get; set; } = null!;

    /// <summary>Object key within the storage bucket.</summary>
    public required string StorageKey { get; set; }

    public required string FileName { get; set; }

    public long Size { get; set; }

    public string ContentType { get; set; } = "application/pdf";
}
