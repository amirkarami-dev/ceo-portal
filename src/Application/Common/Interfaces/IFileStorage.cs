namespace Mabhas19.Application.Common.Interfaces;

/// <summary>S3-compatible object storage (MinIO in this deployment).</summary>
public interface IFileStorage
{
    Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default);

    Task<Stream> GetAsync(string key, CancellationToken ct = default);

    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>A time-limited download URL for the object.</summary>
    Task<string> GetPresignedUrlAsync(string key, TimeSpan expiry, CancellationToken ct = default);
}
