namespace Mabhas19.Infrastructure.Storage;

public class MinioOptions
{
    public const string SectionName = "Minio";

    public string Endpoint { get; set; } = "localhost:9000";
    public string AccessKey { get; set; } = "minioadmin";
    public string SecretKey { get; set; } = "minioadmin";
    public string Bucket { get; set; } = "mabhas19";
    public bool UseSSL { get; set; } = false;

    /// <summary>Optional public endpoint used when building presigned URLs (e.g. behind Traefik).</summary>
    public string? PublicEndpoint { get; set; }
}
